// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GraduatedCylinder from "@/components/measurement/GraduatedCylinder";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function expectMeniscusIndicator(container: HTMLElement, volume: number) {
  const y = 390 - (volume / 50) * 344;
  const guide = container.querySelector('line[stroke="var(--accent)"]');
  expect(guide).not.toBeNull();
  expect(Number(guide?.getAttribute("y1"))).toBeCloseTo(y);
  expect(Number(guide?.getAttribute("y2"))).toBeCloseTo(y);
  expect(guide).toHaveAttribute("x1", "106");
  expect(guide).toHaveAttribute("x2", "218");
  expect(guide).toHaveAttribute("stroke-width", "2");
  expect(guide).not.toHaveAttribute("stroke-dasharray");

  const arrow = container.querySelector('path[fill="var(--accent)"]');
  const coordinates = arrow?.getAttribute("d")?.match(/-?[\d.]+/g)?.map(Number);
  // Match the ruler's 14-wide, 12-deep triangle, rotated to point left.
  expect(coordinates?.[0]).toBe(218);
  expect(coordinates?.[1]).toBeCloseTo(y - 7);
  expect(coordinates?.[2]).toBe(218);
  expect(coordinates?.[3]).toBeCloseTo(y + 7);
  expect(coordinates?.[4]).toBe(206);
  expect(coordinates?.[5]).toBeCloseTo(y);
  expect(arrow?.parentElement).toHaveAttribute("pointer-events", "none");

  // At t=0.5, the quadratic meniscus curve is at the exact reading level.
  const meniscus = container.querySelector('path[stroke="#7dd3fc"]');
  const curve = meniscus?.getAttribute("d")?.match(/-?[\d.]+/g)?.map(Number);
  expect(curve).toHaveLength(6);
  const midpointY = 0.25 * curve![1] + 0.5 * curve![3] + 0.25 * curve![5];
  expect(midpointY).toBeCloseTo(y);
  expect(container.querySelector("desc")).toHaveTextContent("bottom of the meniscus");
}

describe("graduated cylinder meniscus indicator", () => {
  it("marks the bottom of the default meniscus", () => {
    const { container } = render(<GraduatedCylinder />);
    expectMeniscusIndicator(container, 32);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "32.0 milliliters");
  });

  it.each([0, 50])("keeps the readout aligned with the marker at %s mL", (volume) => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const { container } = render(<GraduatedCylinder />);
    const slider = screen.getByRole("slider");
    Object.assign(slider, {
      getBoundingClientRect: () => ({ top: 46, height: 344 }),
      setPointerCapture: () => {},
    });
    const y = 390 - (volume / 50) * 344;
    fireEvent.pointerDown(slider, { clientY: y });
    const badge = screen.getByText(`${volume.toFixed(1)} mL`).parentElement;
    expect(badge).toHaveAttribute("transform", `translate(234 ${y - 14})`);
    expect(badge?.querySelector("rect")).toHaveAttribute("width", "84");
    if (volume > 0) expectMeniscusIndicator(container, volume);
  });

  it.each([0.1, 6.3, 23.4, 47.9, 50])("marks a locked %s mL meniscus without revealing the volume", (volume) => {
    const { container } = render(<GraduatedCylinder lockedValue={volume} />);
    expectMeniscusIndicator(container, volume);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByText(`${volume.toFixed(1)} mL`)).not.toBeInTheDocument();
    expect(screen.getByRole("img")).not.toHaveAttribute("aria-valuenow");
  });

  it("moves the arrow and guide line with the water during dragging", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const { container } = render(<GraduatedCylinder />);
    const slider = screen.getByRole("slider");
    let captured = false;
    Object.assign(slider, {
      getBoundingClientRect: () => ({ top: 46, height: 344 }),
      setPointerCapture: () => { captured = true; },
      hasPointerCapture: () => captured,
      releasePointerCapture: () => { captured = false; },
    });
    const y = (volume: number) => 390 - (volume / 50) * 344;

    fireEvent.pointerDown(slider, { clientY: y(20) });
    expectMeniscusIndicator(container, 20);
    fireEvent.pointerMove(slider, { clientY: y(35) });
    expectMeniscusIndicator(container, 35);
    fireEvent.pointerUp(slider, { clientY: y(35) });
    expectMeniscusIndicator(container, 35);
    fireEvent.pointerMove(slider, { clientY: y(10) });
    expectMeniscusIndicator(container, 35);
  });

  it("does not indicate a meniscus when the cylinder is empty", () => {
    const { container } = render(<GraduatedCylinder lockedValue={0} />);
    expect(container.querySelector('line[stroke="var(--accent)"]')).toBeNull();
    expect(container.querySelector('path[fill="var(--accent)"]')).toBeNull();
  });
});
