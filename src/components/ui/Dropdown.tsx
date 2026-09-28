"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption = {
  value: string;
  label: string;
  description?: string;
};

type DropdownProps = {
  label: string;
  value: string;
  options: readonly DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function Dropdown({ label, value, options, onChange, disabled = false }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [open]);

  const showOptions = () => {
    if (disabled || options.length === 0) return;
    setHighlightedIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const choose = (option: DropdownOption) => {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || options.length === 0) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          showOptions();
        } else {
          const direction = event.key === "ArrowDown" ? 1 : -1;
          setHighlightedIndex((index) => (index + direction + options.length) % options.length);
        }
        break;
      }
      case "Home":
      case "End":
        if (open) {
          event.preventDefault();
          setHighlightedIndex(event.key === "Home" ? 0 : options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(options[highlightedIndex]);
        else showOptions();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <span id={labelId} className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${id}-option-${highlightedIndex}` : undefined}
        aria-labelledby={labelId}
        aria-describedby={valueId}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : showOptions()}
        onKeyDown={handleKeyDown}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-left shadow-sm transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${open ? "border-accent ring-2 ring-accent/15" : "border-border"}`}
      >
        <span id={valueId} className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{selectedOption?.label ?? "Select an option"}</span>
          {selectedOption?.description && (
            <span className="block truncate text-xs text-muted-foreground">{selectedOption.description}</span>
          )}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl"
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                highlightedIndex === index ? "bg-accent/10" : "hover:bg-muted"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                {option.description && <span className="block text-xs text-muted-foreground">{option.description}</span>}
              </span>
              {option.value === value && <span className="text-accent" aria-hidden="true">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
