// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MeasurementComparison from "@/components/measurement/MeasurementComparison";
import MeasurementLabPage from "@/app/(student)/student/labs/measurement/page";

beforeEach(() => vi.stubGlobal("PointerEvent", MouseEvent));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockPointer(slider: HTMLElement) {
  let captured = false;
  Object.assign(slider, {
    getBoundingClientRect: () => ({ left: 24, width: 312, top: 46, height: 344 }),
    setPointerCapture: () => { captured = true; },
    hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; },
  });
}

function marker(slider: HTMLElement, coordinate: "x1" | "y1") {
  return slider.closest("svg")!.querySelector('line[stroke="var(--accent)"]')?.getAttribute(coordinate);
}

function ticks(slider: HTMLElement) {
  return slider.closest("svg")!.querySelector('g[aria-hidden="true"]')!.querySelectorAll("line");
}

describe("ruler precision comparison", () => {
  it("starts with tenths only, then reveals hundredths below without changing the length", () => {
    render(<MeasurementComparison instrument="ruler" />);
    const coarse = screen.getByRole("slider", { name: "Tenths ruler length" });
    expect(screen.queryByRole("slider", { name: "Hundredths ruler length" })).not.toBeInTheDocument();
    expect(ticks(coarse)).toHaveLength(11);
    fireEvent.keyDown(coarse, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const fine = screen.getByRole("slider", { name: "Hundredths ruler length" });
    expect(screen.getAllByRole("slider")).toEqual([coarse, fine]);
    expect(coarse).toHaveAttribute("aria-valuetext", "5.1 centimeters");
    expect(fine).toHaveAttribute("aria-valuetext", "5.10 centimeters");
    expect(ticks(fine)).toHaveLength(101);
    expect(screen.getByRole("heading", { name: "Ruler — Hundredths" })).toHaveFocus();
    expect(marker(coarse, "x1")).toBe(marker(fine, "x1"));
    expect(coarse.closest("section")!.parentElement).toHaveClass("space-y-4");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("syncs physical pointers in both directions without rounding away hundredths", () => {
    render(<MeasurementComparison instrument="ruler" />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const coarse = screen.getByRole("slider", { name: "Tenths ruler length" });
    const fine = screen.getByRole("slider", { name: "Hundredths ruler length" });
    mockPointer(coarse);
    mockPointer(fine);
    const x = (cm: number) => 24 + (cm / 10) * 312;
    fireEvent.pointerDown(fine, { clientX: x(3.46) });
    expect(coarse).toHaveAttribute("aria-valuenow", "3.46");
    expect(fine).toHaveAttribute("aria-valuenow", "3.46");
    expect(coarse).toHaveAttribute("aria-valuetext", "3.5 centimeters");
    expect(fine).toHaveAttribute("aria-valuetext", "3.46 centimeters");
    expect(Number(marker(coarse, "x1"))).toBeCloseTo(x(3.46));
    expect(marker(coarse, "x1")).toBe(marker(fine, "x1"));
    fireEvent.pointerUp(fine, { clientX: x(3.46) });
    fireEvent.pointerDown(coarse, { clientX: x(7.23) });
    expect(fine).toHaveAttribute("aria-valuetext", "7.23 centimeters");
    expect(coarse).toHaveAttribute("aria-valuetext", "7.2 centimeters");
    expect(marker(coarse, "x1")).toBe(marker(fine, "x1"));
    fireEvent.pointerCancel(coarse);
    fireEvent.pointerMove(coarse, { clientX: x(9) });
    expect(fine).toHaveAttribute("aria-valuenow", "7.23");
    fine.focus();
    fireEvent.keyDown(fine, { key: "ArrowRight" });
    expect(fine).toHaveFocus();
    expect(coarse).toHaveAttribute("aria-valuenow", "7.24");
    fireEvent.keyDown(coarse, { key: "ArrowRight" });
    expect(fine).toHaveAttribute("aria-valuenow", "7.34");
    fireEvent.keyDown(coarse, { key: "Home" });
    expect(fine).toHaveAttribute("aria-valuenow", "0");
    fireEvent.keyDown(fine, { key: "End" });
    expect(coarse).toHaveAttribute("aria-valuenow", "10");
  });
});

describe("cylinder precision comparison", () => {
  it("starts coarse, then reveals a finer cylinder side by side with the same volume", () => {
    render(<MeasurementComparison instrument="cylinder" />);
    const coarse = screen.getByRole("slider", { name: "Whole milliliter cylinder volume" });
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    expect(ticks(coarse)).toHaveLength(6);
    fireEvent.keyDown(coarse, { key: "ArrowUp" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const fine = screen.getByRole("slider", { name: "Tenths milliliter cylinder volume" });
    expect(coarse).toHaveAttribute("aria-valuetext", "33 milliliters");
    expect(fine).toHaveAttribute("aria-valuetext", "33.0 milliliters");
    expect(ticks(fine)).toHaveLength(51);
    expect(screen.getByRole("heading", { name: "Cylinder — Tenths of a milliliter" })).toHaveFocus();
    expect(marker(coarse, "y1")).toBe(marker(fine, "y1"));
    expect(coarse.closest("section")!.parentElement).toHaveClass("grid", "grid-cols-2");
    const ids = [...document.querySelectorAll("svg [id]")].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("syncs water and meniscus guides when dragging either cylinder or using the keyboard", () => {
    render(<MeasurementComparison instrument="cylinder" />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const coarse = screen.getByRole("slider", { name: "Whole milliliter cylinder volume" });
    const fine = screen.getByRole("slider", { name: "Tenths milliliter cylinder volume" });
    mockPointer(coarse);
    mockPointer(fine);
    const y = (ml: number) => 390 - (ml / 50) * 344;
    fireEvent.pointerDown(fine, { clientY: y(23.4) });
    expect(coarse).toHaveAttribute("aria-valuetext", "23 milliliters");
    expect(fine).toHaveAttribute("aria-valuetext", "23.4 milliliters");
    expect(Number(marker(coarse, "y1"))).toBeCloseTo(y(23.4));
    expect(marker(coarse, "y1")).toBe(marker(fine, "y1"));
    fireEvent.pointerUp(fine, { clientY: y(23.4) });
    fireEvent.pointerDown(coarse, { clientY: y(41.7) });
    expect(coarse).toHaveAttribute("aria-valuetext", "42 milliliters");
    expect(fine).toHaveAttribute("aria-valuetext", "41.7 milliliters");
    expect(marker(coarse, "y1")).toBe(marker(fine, "y1"));
    fireEvent.pointerUp(coarse, { clientY: y(41.7) });
    fireEvent.keyDown(fine, { key: "ArrowDown" });
    expect(coarse).toHaveAttribute("aria-valuenow", "41.6");
    fireEvent.keyDown(coarse, { key: "ArrowDown" });
    expect(fine).toHaveAttribute("aria-valuenow", "40.6");
    fireEvent.keyDown(fine, { key: "Home" });
    expect(coarse).toHaveAttribute("aria-valuenow", "0");
    fireEvent.keyDown(coarse, { key: "End" });
    expect(fine).toHaveAttribute("aria-valuenow", "50");
    expect(marker(coarse, "y1")).toBe(marker(fine, "y1"));
  });
});

it("uses independent staged comparisons in the measurement lab", () => {
  render(<MeasurementLabPage />);
  expect(screen.getAllByRole("slider")).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Next" })[0]);
  expect(screen.getByRole("slider", { name: "Hundredths ruler length" })).toBeInTheDocument();
  expect(screen.queryByRole("slider", { name: "Tenths milliliter cylinder volume" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getAllByRole("slider")).toHaveLength(4);
});
