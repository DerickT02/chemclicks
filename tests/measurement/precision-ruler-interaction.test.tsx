// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PrecisionRuler from "@/components/measurement/PrecisionRuler";

beforeEach(() => {
  // jsdom lacks pointer events/capture; use mouse coordinates with pointer event names.
  vi.stubGlobal("PointerEvent", MouseEvent);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(width = 312) {
  const result = render(<PrecisionRuler precision="tenths" />);
  const slider = screen.getByRole("slider");
  let captured = false;
  Object.assign(slider, {
    getBoundingClientRect: () => ({ left: 24, width }),
    setPointerCapture: () => { captured = true; },
    hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; },
  });
  return { ...result, slider, x: (cm: number) => 24 + (cm / 10) * width };
}

function expectReading(slider: HTMLElement, reading: string) {
  expect(slider).toHaveAttribute("aria-valuenow", String(Number(reading)));
  expect(slider).toHaveAttribute("aria-valuetext", `${reading} centimeters`);
  expect(screen.getByText(`${reading} cm`)).toBeInTheDocument();
}

describe("tenths ruler interaction", () => {
  it.each([208, 312, 624])("maps dragging linearly at a scale width of %i pixels", (width) => {
    const { container, slider, x } = setup(width);
    fireEvent.pointerDown(slider, { clientX: x(0) });
    expectReading(slider, "0.0");
    fireEvent.pointerMove(slider, { clientX: x(3.46) });
    expectReading(slider, "3.5");
    const cursorCoordinates = container.querySelector("path")?.getAttribute("d")?.match(/[\d.]+/g);
    expect(Number(cursorCoordinates?.[4])).toBeCloseTo(24 + 0.35 * 312);
    fireEvent.pointerMove(slider, { clientX: x(5) });
    expectReading(slider, "5.0");
    fireEvent.pointerUp(slider, { clientX: x(7.24) });
    expectReading(slider, "7.2");
    fireEvent.pointerMove(slider, { clientX: x(2) });
    expectReading(slider, "7.2");
  });

  it("clamps dragging and releasing beyond both endpoints", () => {
    const { slider, x } = setup();
    fireEvent.pointerDown(slider, { clientX: x(-2) });
    expectReading(slider, "0.0");
    fireEvent.pointerMove(slider, { clientX: x(12) });
    expectReading(slider, "10.0");
    fireEvent.pointerUp(slider, { clientX: x(15) });
    expectReading(slider, "10.0");
    fireEvent.pointerDown(slider, { clientX: x(3) });
    fireEvent.pointerUp(slider, { clientX: x(-5) });
    expectReading(slider, "0.0");
  });

  it.each([208, 312, 624])("centers the badge above the arrow without clipping at width %i", (width) => {
    const { container, slider, x } = setup(width);
    const svg = container.querySelector("svg")!;
    const [left, , viewWidth] = svg.getAttribute("viewBox")!.split(" ").map(Number);

    for (const reading of [0, 0.1, 5, 9.9, 10]) {
      fireEvent.pointerDown(slider, { clientX: x(reading) });
      const badge = screen.getByText(`${reading.toFixed(1)} cm`).parentElement!;
      const [badgeX] = badge.getAttribute("transform")!.match(/-?[\d.]+/g)!.map(Number);
      const badgeWidth = Number(badge.querySelector("rect")!.getAttribute("width"));
      const marker = container.querySelector('line[stroke="var(--accent)"]')!;
      const markerX = Number(marker.getAttribute("x1"));
      expect(badgeX + badgeWidth / 2).toBeCloseTo(markerX);
      expect(badgeX).toBeGreaterThanOrEqual(left);
      expect(badgeX + badgeWidth).toBeLessThanOrEqual(left + viewWidth);
    }
  });

  it("ignores hover, cancelled drags, and zero-width geometry", () => {
    const { slider, x } = setup();
    fireEvent.pointerMove(slider, { clientX: x(9) });
    expectReading(slider, "5.0");
    fireEvent.pointerDown(slider, { clientX: x(3.44) });
    fireEvent.pointerCancel(slider, { clientX: x(9) });
    fireEvent.pointerMove(slider, { clientX: x(9) });
    expectReading(slider, "3.4");
    Object.assign(slider, { getBoundingClientRect: () => ({ left: 24, width: 0 }) });
    fireEvent.pointerDown(slider, { clientX: 100 });
    expectReading(slider, "3.4");
  });

  it("uses tenths for arrow keys and exact endpoints for Home/End", () => {
    const { slider } = setup();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expectReading(slider, "5.1");
    fireEvent.keyDown(slider, { key: "ArrowDown" });
    expectReading(slider, "5.0");
    fireEvent.keyDown(slider, { key: "Home" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expectReading(slider, "0.0");
    fireEvent.keyDown(slider, { key: "End" });
    fireEvent.keyDown(slider, { key: "ArrowUp" });
    expectReading(slider, "10.0");
  });

  it("retains hundredths mode and clamps locked cursors without revealing readings", () => {
    const { rerender, container } = render(<PrecisionRuler />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expectReading(slider, "5.01");
    rerender(<PrecisionRuler lockedValue={12} />);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByText("10.00 cm")).not.toBeInTheDocument();
    expect(container.querySelector("path")).toHaveAttribute("d", "M 329 46 L 343 46 L 336 58 Z");
  });
});

describe("ruler scale", () => {
  it.each(["tenths", "hundredths"] as const)("prints the correct marks for %s readings", (precision) => {
    const { container } = render(<PrecisionRuler precision={precision} />);
    const isCoarse = precision === "tenths";
    const groups = container.querySelectorAll('g[aria-hidden="true"]');
    const ticks = groups[0].querySelectorAll("line");
    expect(ticks).toHaveLength(isCoarse ? 11 : 101);
    expect([...groups[0].querySelectorAll("text")].map((label) => label.textContent))
      .toEqual([...Array.from({ length: 11 }, (_, index) => String(index)), "cm"]);
    ticks.forEach((tick, index) => {
      expect(Number(tick.getAttribute("x1"))).toBeCloseTo(24 + index * (isCoarse ? 31.2 : 3.12));
      expect(tick.getAttribute("x2")).toBe(tick.getAttribute("x1"));
      expect(tick.getAttribute("y2")).toBe(isCoarse || index % 10 === 0 ? "90" : index % 5 === 0 ? "80" : "72");
    });
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuemin", "0");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuemax", "10");
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "-24 0 408 150");
  });
});
