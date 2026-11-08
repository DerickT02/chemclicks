import { createClient } from "@/lib/supabase/client";

export type ClassChange = { kind: "roster" | "progress" | "sync"; assignmentId?: string | null };
type Listener = (change: ClassChange) => void;
type Subscription = { listeners: Set<Listener>; subscribed: boolean; close: () => Promise<void> };

// One private channel per class per tab, shared by roster, progress and expanded
// histories. Serialize asynchronous removal/rejoin: supabase-js reuses channels
// with the same topic, even when the previous channel is still leaving.
const subscriptions = new Map<string, Subscription>();
const removals = new Map<string, Promise<void>>();

export function subscribeTeacherClass(classId: string, listener: Listener): () => void {
  let entry = subscriptions.get(classId);
  const catchUp = entry?.subscribed === true;
  if (!entry) {
    const listeners = new Set<Listener>([listener]);
    const client = createClient();
    const previousRemoval = removals.get(classId);
    let channel: ReturnType<typeof client.channel> | undefined;
    const current: Subscription = {
      listeners,
      subscribed: false,
      close: async () => {
        await previousRemoval;
        if (channel) await client.removeChannel(channel);
      },
    };
    entry = current;
    subscriptions.set(classId, current);
    const connect = () => {
      if (subscriptions.get(classId) !== current || listeners.size === 0) return;
      channel = client.channel(`teacher-class:${classId}`, { config: { private: true } });
      channel.on("broadcast", { event: "changed" }, ({ payload }: { payload: unknown }) => {
        if (!payload || typeof payload !== "object" || !("kind" in payload)) return;
        if (payload.kind !== "roster" && payload.kind !== "progress") return;
        const assignmentId = "assignmentId" in payload && typeof payload.assignmentId === "string" ? payload.assignmentId : null;
        const kind = payload.kind;
        listeners.forEach(callback => callback({ kind, assignmentId }));
      }).subscribe(status => {
        // Close the SSR/subscription gap and recover changes missed offline.
        // The SDK handles reconnects and session-token refresh automatically.
        current.subscribed = status === "SUBSCRIBED";
        if (current.subscribed) listeners.forEach(callback => callback({ kind: "sync" }));
      });
    };
    if (previousRemoval) {
      // A failed setup simply leaves the HTTP fallback active until unmount.
      void previousRemoval.then(connect).catch(() => {});
    } else {
      try { connect(); }
      catch (error) {
        subscriptions.delete(classId);
        const removal = current.close().catch(() => {});
        removals.set(classId, removal);
        void removal.then(() => { if (removals.get(classId) === removal) removals.delete(classId); });
        throw error;
      }
    }
  }
  entry.listeners.add(listener);
  if (catchUp) listener({ kind: "sync" });
  const current = entry;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      subscriptions.delete(classId);
      const removal = current.close().catch(() => {});
      removals.set(classId, removal);
      void removal.then(() => { if (removals.get(classId) === removal) removals.delete(classId); });
    }
  };
}
