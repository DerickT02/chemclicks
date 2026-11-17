"use client";

import { useState } from "react";
import { AuthFormError, authSecondaryLinkClassName } from "@/components/auth/AuthPageLayout";
import { resendTeacherVerification } from "@/lib/auth/resend-teacher-verification";
import { getTeacherVerificationResentMessage } from "@/lib/auth/teacher-email-verification";

type Props = {
  email: string;
};

type Feedback = { kind: "sent" } | { kind: "error"; message: string };

export function ResendTeacherVerification({ email }: Props) {
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | undefined>();

  async function handleResend() {
    setFeedback(undefined);
    setIsSending(true);
    const result = await resendTeacherVerification(email, window.location.origin);
    setFeedback(result.sent ? { kind: "sent" } : { kind: "error", message: result.error });
    setIsSending(false);
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <button
        type="button"
        onClick={() => void handleResend()}
        disabled={isSending}
        className={`${authSecondaryLinkClassName} disabled:cursor-wait disabled:opacity-50`}
      >
        {isSending ? "Sending verification email..." : "Resend verification email"}
      </button>
      <AuthFormError message={feedback?.kind === "error" ? feedback.message : undefined} />
      {feedback?.kind === "sent" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {getTeacherVerificationResentMessage(email)}
        </p>
      ) : null}
    </div>
  );
}
