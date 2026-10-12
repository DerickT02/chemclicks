"use client";

import { useActionState, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { disableClass, type DisableClassState } from "@/app/admin/classes/actions";

const INITIAL_STATE: DisableClassState = { status: "idle", message: "" };
const BUTTON_CLASS = "rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

type Props = { classId: string; className: string };

type ConfirmationProps = Props & { onCancel: () => void };

function DisableClassConfirmation({ classId, className, onCancel }: ConfirmationProps) {
  const router = useRouter();
  const descriptionId = useId();
  const [state, action, pending] = useActionState(async (previous: DisableClassState, data: FormData): Promise<DisableClassState> => {
    let result: DisableClassState;
    try {
      result = await disableClass(previous, data);
    } catch {
      return {
        status: "error",
        message: "We could not confirm the class was disabled. Refresh the page before trying again.",
      };
    }
    if (result.status === "success") {
      router.replace("/admin?classDisabled=1");
      router.refresh();
    }
    return result;
  }, INITIAL_STATE);
  const locked = pending || state.status === "success";

  return (
    <form action={action} aria-label={`Disable ${className}`} aria-describedby={descriptionId} aria-busy={pending}
      className="space-y-3 rounded-lg border border-destructive p-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="confirmation" value="disable" />
      <p className="text-sm font-semibold">Disable {className}?</p>
      <p id={descriptionId} className="text-sm text-muted-foreground">
        Students will lose access to this class. The class, students, assignments,
        progress, and attempt history will be kept. Disabled classes will not appear
        in your class list. Reactivation is not available here.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={locked} className={BUTTON_CLASS}>
          {pending ? "Disabling…" : "Confirm disable class"}
        </button>
        <button type="button" disabled={locked} onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
          Cancel
        </button>
      </div>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"}
          className={`text-sm ${state.status === "error" ? "text-destructive" : "text-foreground"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export default function DisableClassControl({ classId, className }: Props) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <DisableClassConfirmation classId={classId} className={className} onCancel={() => setConfirming(false)} />
  ) : (
    <button type="button" onClick={() => setConfirming(true)} className={BUTTON_CLASS}>
      Disable class
    </button>
  );
}
