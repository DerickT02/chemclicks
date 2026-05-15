"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createClass } from "./actions";

export default function CreateClassPage() {
  const router = useRouter();
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [classCode, setClassCode] = useState("");
  const [classCodeError, setClassCodeError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitSuccess, setSubmitSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClassCodeChange(value: string) {
    const next = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6);
    setClassCode(next);
    if (classCodeError) setClassCodeError(undefined);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClassCodeError(undefined);
    setSubmitError(undefined);
    setSubmitSuccess(undefined);

    const trimmedName = className.trim();
    if (!trimmedName) return;

    if (classCode.length !== 6) {
      setClassCodeError("Enter a 6-character code using letters A–Z and digits 0–9.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await createClass({
          className: trimmedName,
          section,
          classCode,
        });

        if (!result.ok) {
          setSubmitError(result.message);
          return;
        }

        setSubmitSuccess("Class created.");
        setClassName("");
        setSection("");
        setClassCode("");
        router.refresh();
      })();
    });
  }

  const isCodeComplete = classCode.length === 6;

  return (
    <div className="min-h-screen bg-background p-6 text-foreground md:p-10">
      <div className="mx-auto max-w-md">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Back to classrooms
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Add a class</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a display name, section label (optional), and a unique 6-character code
          students will use to join.
        </p>

        <form
          className="mt-8 flex flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-sm"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="className" className="text-sm font-medium">
              Class name
            </label>
            <input
              id="className"
              name="className"
              type="text"
              autoComplete="off"
              placeholder="e.g. Chemistry Period 3"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="section" className="text-sm font-medium">
              Section{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="section"
              name="section"
              type="text"
              autoComplete="off"
              placeholder="e.g. Fall 2026 · Room 204"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="classCode" className="text-sm font-medium">
              Class code
            </label>
            <input
              id="classCode"
              name="classCode"
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={6}
              placeholder="e.g. A1B2C3"
              value={classCode}
              onChange={(e) => handleClassCodeChange(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-widest outline-none ring-ring focus:ring-2"
            />
            <p className="text-xs text-muted-foreground">
              Six letters or numbers only. Stored in uppercase.
            </p>
            {classCodeError ? (
              <p className="text-sm text-destructive">{classCodeError}</p>
            ) : null}
          </div>

          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
          {submitSuccess ? (
            <p className="text-sm text-accent">{submitSuccess}</p>
          ) : null}

          <button
            type="submit"
            disabled={!className.trim() || !isCodeComplete || isPending}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Create class"}
          </button>
        </form>
      </div>
    </div>
  );
}
