// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ disable: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/classes/actions", () => ({ disableClass: mocks.disable }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
import DisableClassControl from "@/app/admin/classes/DisableClassControl";
import type { DisableClassState } from "@/app/admin/classes/actions";
const classId = "11111111-1111-4111-8111-111111111111";
const success: DisableClassState = { status: "success", message: "Class disabled. Classroom data has been kept." };
const failure: DisableClassState = { status: "error", message: "The class could not be disabled. Please try again." };
beforeEach(() => { vi.resetAllMocks(); mocks.disable.mockResolvedValue(success); });
afterEach(cleanup);

async function openConfirmation() {
  const user = userEvent.setup();
  render(<DisableClassControl classId={classId} className="Chemistry Period 1" />);
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Disable class" }));
  return user;
}

describe("class disabling confirmation", () => {
  it("names the class, explains retention and lost access, and cancels without invoking the action", async () => {
    const user = await openConfirmation();
    expect(screen.getByText("Disable Chemistry Period 1?")).toBeInTheDocument();
    expect(screen.getByText(/Students will lose access/)).toHaveTextContent(/progress, and attempt history will be kept/);
    expect(screen.getByText(/Reactivation is not available/)).toBeInTheDocument();
    expect(mocks.disable).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable class" })).toBeEnabled();
    expect(mocks.disable).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("submits only after confirmation and prevents further changes while pending", async () => {
    let resolve!: (result: DisableClassState) => void;
    mocks.disable.mockReturnValue(new Promise<DisableClassState>(done => { resolve = done; }));
    const user = await openConfirmation();
    await user.click(screen.getByRole("button", { name: "Confirm disable class" }));
    expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Disabling…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Disabling…" }));
    expect(mocks.disable).toHaveBeenCalledTimes(1);
    const data = mocks.disable.mock.calls[0][1] as FormData;
    expect(data.get("class_id")).toBe(classId);
    expect(data.get("confirmation")).toBe("disable");
    expect(mocks.replace).not.toHaveBeenCalled();
    await act(async () => { resolve(success); });
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/admin?classDisabled=1");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Class disabled");
    expect(screen.getByRole("button", { name: "Confirm disable class" })).toBeDisabled();
  });
  it.each(["returned", "thrown"])("keeps the class visible and allows retry after a %s failure", async kind => {
    if (kind === "returned") mocks.disable.mockResolvedValueOnce(failure);
    else mocks.disable.mockRejectedValueOnce(new Error("private transport details"));
    const user = await openConfirmation();
    await user.click(screen.getByRole("button", { name: "Confirm disable class" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private transport details");
    expect(screen.getByText("Disable Chemistry Period 1?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm disable class" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm disable class" }));
    expect(mocks.disable).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });
  it("clears a previous error when cancelled and reopened", async () => {
    mocks.disable.mockResolvedValueOnce(failure);
    const user = await openConfirmation();
    await user.click(screen.getByRole("button", { name: "Confirm disable class" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Disable class" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("requires a new confirmation when selection changes", async () => {
    const user = userEvent.setup();
    const view = render(<DisableClassControl key={classId} classId={classId} className="Old class" />);
    await user.click(screen.getByRole("button", { name: "Disable class" }));
    view.rerender(<DisableClassControl key="new-class" classId="new-class" className="New class" />);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(mocks.disable).not.toHaveBeenCalled();
  });
});
