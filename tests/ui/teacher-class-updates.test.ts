import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ channel: vi.fn(), remove: vi.fn(), on: vi.fn(), subscribe: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ channel: mocks.channel, removeChannel: mocks.remove }) }));
import { subscribeTeacherClass } from "@/lib/teacher-class-updates";
const cleanups: (() => void)[] = [];
const subscribe = (id: string, listener = vi.fn()) => {
  const close = subscribeTeacherClass(id, listener);
  cleanups.push(close);
  return close;
};
beforeEach(() => {
  vi.resetAllMocks();
  const channel = { on: mocks.on, subscribe: mocks.subscribe };
  mocks.channel.mockReturnValue(channel);
  mocks.on.mockReturnValue(channel);
  mocks.remove.mockResolvedValue("ok");
});
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
afterEach(async () => { cleanups.splice(0).forEach(close => close()); await flush(); });

describe("private class subscriptions", () => {
  it("shares one private channel per class across views and removes it after the last listener", async () => {
    const first = subscribe("one");
    const second = subscribe("one");
    expect(mocks.channel).toHaveBeenCalledExactlyOnceWith("teacher-class:one", { config: { private: true } });
    first();
    expect(mocks.remove).not.toHaveBeenCalled();
    second();
    await flush();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    // Do not invoke these cleanup closures twice.
    cleanups.length = 0;
  });
  it("isolates classes, validates hints, and notifies all listeners on reconnect", () => {
    const first = vi.fn(), second = vi.fn(), other = vi.fn();
    subscribe("one", first); subscribe("one", second); subscribe("two", other);
    const receive = mocks.on.mock.calls[0][2];
    receive({ payload: { kind: "progress", assignmentId: "selected", studentName: "ignored" } });
    expect(first).toHaveBeenCalledWith({ kind: "progress", assignmentId: "selected" });
    expect(second).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    for (const payload of [null, "invalid", {}, { kind: "spoofed" }]) receive({ payload });
    expect(first).toHaveBeenCalledTimes(1);
    const status = mocks.subscribe.mock.calls[0][0];
    status("SUBSCRIBED"); status("CHANNEL_ERROR"); status("SUBSCRIBED");
    expect(first).toHaveBeenCalledTimes(3);
    expect(first).toHaveBeenLastCalledWith({ kind: "sync" });
  });
  it("catches up a view added to an already subscribed shared channel", () => {
    const first = vi.fn(), added = vi.fn();
    subscribe("one", first);
    mocks.subscribe.mock.calls[0][0]("SUBSCRIBED");
    subscribe("one", added);
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    expect(added).toHaveBeenCalledExactlyOnceWith({ kind: "sync" });
  });
  it("waits for asynchronous teardown before rejoining the same topic", async () => {
    let finish!: (value: string) => void;
    mocks.remove.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const close = subscribe("one");
    close();
    await flush();
    subscribe("one");
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    finish("ok");
    await flush();
    expect(mocks.channel).toHaveBeenCalledTimes(2);
  });
  it("cleans up failed subscriptions so another attempt can recover", async () => {
    mocks.subscribe.mockImplementationOnce(() => { throw new Error("unavailable"); });
    expect(() => subscribeTeacherClass("one", vi.fn())).toThrow("unavailable");
    subscribe("one");
    await flush();
    expect(mocks.channel).toHaveBeenCalledTimes(2);
  });
});
