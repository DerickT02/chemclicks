"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createClass } from "./actions";

const panelBg = "#1e2530";
const fieldBg = "#2c3543";
const labelColor = "#94a3b8";
const accent = "#3d7d6e";

type SaveClassButtonProps = {
  disabled?: boolean;
};

function SaveClassButton({ disabled }: SaveClassButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-lg py-3.5 text-base font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: accent, color: panelBg }}
    >
      Save class
    </button>
  );
}

export default function CreateClassPage() {
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState<number | "">("");
  const [classCodeError, setClassCodeError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitSuccess, setSubmitSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClassCodeChange(value: string) {
    if (value === "") {
      setClassCode("");
      setClassCodeError(undefined);
      return;
    }
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) return;
    if (n > 999_999) return;
    setClassCode(n);
    if (classCodeError) setClassCodeError(undefined);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClassCodeError(undefined);
    setSubmitError(undefined);
    setSubmitSuccess(undefined);

    const trimmedName = className.trim();
    if (!trimmedName) return;

    if (classCode === "" || classCode < 100_000 || classCode > 999_999) {
      setClassCodeError("Enter a 6-digit code (100000–999999).");
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await createClass({
          className: trimmedName,
          classCode,
        });

        if (!result.ok) {
          setSubmitError(result.message);
          return;
        }

        setSubmitSuccess("Class saved.");
        setClassName("");
        setClassCode("");
      })();
    });
  }

  const isCodeComplete =
    classCode !== "" && classCode >= 100_000 && classCode <= 999_999;

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: panelBg }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-lg"
        style={{ backgroundColor: panelBg }}
      >
        <h1 className="mb-6 text-lg font-bold text-white">Add a class</h1>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="className" className="text-sm" style={{ color: labelColor }}>
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
              className="w-full rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3d7d6e]/50"
              style={{ backgroundColor: fieldBg }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="classCode" className="text-sm" style={{ color: labelColor }}>
              Class code
            </label>
            <input
              id="classCode"
              name="classCode"
              type="number"
              inputMode="numeric"
              min={100_000}
              max={999_999}
              step={1}
              placeholder="e.g. 482931"
              value={classCode === "" ? "" : classCode}
              onChange={(e) => handleClassCodeChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3d7d6e]/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ backgroundColor: fieldBg }}
            />
            {classCodeError ? (
              <p className="text-sm text-red-400">{classCodeError}</p>
            ) : null}
          </div>

          {submitError ? (
            <p className="text-sm text-red-400">{submitError}</p>
          ) : null}
          {submitSuccess ? (
            <p className="text-sm text-emerald-300">{submitSuccess}</p>
          ) : null}

          <SaveClassButton
            disabled={!className.trim() || !isCodeComplete || isPending}
          />
        </form>
      </div>
    </div>
  );
}
