"use client";

import { useState } from "react";

type Props = { code: string };

export default function CopyClassCode({ code }: Props) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Classroom code copied.");
    } catch {
      setMessage("Copy is unavailable. Select the classroom code and copy it manually.");
    }
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={copy}
        className="rounded-md border border-border px-3 py-2 text-sm font-medium">
        Copy classroom code
      </button>
      <p className="text-sm text-muted-foreground">Students choose Join a class and enter this code with their name and Student ID.</p>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
