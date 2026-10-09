"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { createClass, generateClassCode } from "./actions";

type CodeSource = "manual" | "generated";

export default function CreateClassPage() {
  const router = useRouter();
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [classCode, setClassCode] = useState("");
  const [codeSource, setCodeSource] = useState<CodeSource>("manual");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [classCodeError, setClassCodeError] = useState<string | undefined>();
  const [classNameError, setClassNameError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitSuccess, setSubmitSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const busyRef = useRef(false);
  const isBusy = isPending || isGenerating;

  function handleClassCodeChange(value: string) {
    const next = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
    setClassCode(next);
    setCodeSource("manual");
    if (classCodeError) setClassCodeError(undefined);
    if (submitError) setSubmitError(undefined);
  }

  function handleGenerate() {
    if (busyRef.current) return;
    busyRef.current = true;
    setClassCodeError(undefined);
    setSubmitSuccess(undefined);

    startGenerating(async () => {
      try {
        const result = await generateClassCode();
        if (!result.ok) {
          setClassCodeError(result.message);
          return;
        }
        setClassCode(result.code);
        setCodeSource("generated");
        setHasGenerated(true);
      } finally {
        busyRef.current = false;
      }
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busyRef.current) return;
    setClassCodeError(undefined);
    setClassNameError(undefined);
    setSubmitError(undefined);
    setSubmitSuccess(undefined);

    const trimmedName = className.trim();
    if (!trimmedName) {
      setClassNameError("Enter a class name.");
      return;
    }

    if (classCode.length !== 6) {
      setClassCodeError("Enter a 6-character code using letters A–Z and digits 0–9.");
      return;
    }

    busyRef.current = true;
    startTransition(async () => {
      try {
        const result = await createClass({
          className: trimmedName,
          section,
          classCode,
          codeSource,
        });

        if (!result.ok) {
          if (result.field === "classCode") {
            setClassCodeError(result.message);
          } else {
            setSubmitError(result.message);
          }
          return;
        }

        setSubmitSuccess(`Class created with code ${result.classCode}.`);
        setClassName("");
        setSection("");
        setClassCode("");
        setCodeSource("manual");
        setHasGenerated(false);
        router.refresh();
      } finally {
        busyRef.current = false;
      }
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
          students will use to join. Enter your own code or generate one.
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
              onChange={(e) => {
                setClassName(e.target.value);
                if (classNameError) setClassNameError(undefined);
                if (submitError) setSubmitError(undefined);
              }}
              aria-invalid={classNameError ? true : undefined}
              aria-describedby={classNameError ? "className-error" : undefined}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
            {classNameError ? (
              <p id="className-error" className="text-sm text-destructive" role="alert">
                {classNameError}
              </p>
            ) : null}
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
            <div className="flex gap-2">
              <input
                id="classCode"
                name="classCode"
                type="text"
                inputMode="text"
                autoComplete="off"
                maxLength={6}
                placeholder="e.g. A1B2C3"
                value={classCode}
                readOnly={isPending}
                onChange={(e) => handleClassCodeChange(e.target.value)}
                aria-invalid={classCodeError ? true : undefined}
                aria-describedby={
                  classCodeError ? "classCode-hint classCode-error" : "classCode-hint"
                }
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-widest outline-none ring-ring focus:ring-2"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isBusy}
                className="shrink-0 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "Generating…" : hasGenerated ? "Regenerate" : "Generate code"}
              </button>
            </div>
            <p id="classCode-hint" className="text-xs text-muted-foreground">
              Six letters or numbers only. Stored in uppercase. Type your own or generate one.
            </p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {codeSource === "generated" && classCode
                ? `Generated code ${classCode}. You can regenerate or edit it before saving.`
                : ""}
            </p>
            {classCodeError ? (
              <p id="classCode-error" className="text-sm text-destructive" role="alert">{classCodeError}</p>
            ) : null}
          </div>

          {submitError ? (
            <p className="text-sm text-destructive" role="alert">{submitError}</p>
          ) : null}
          {submitSuccess ? (
            <p className="text-sm text-accent">{submitSuccess}</p>
          ) : null}

          <button
            type="submit"
            disabled={!className.trim() || !isCodeComplete || isBusy}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Create class"}
          </button>
        </form>
      </div>
    </div>
  );
}
