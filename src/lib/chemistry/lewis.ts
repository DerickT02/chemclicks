export type LewisDotPosition =
  | "top-primary"
  | "right-primary"
  | "bottom-primary"
  | "left-primary"
  | "top-secondary"
  | "right-secondary"
  | "bottom-secondary"
  | "left-secondary";

const LEWIS_DOT_ORDER: readonly LewisDotPosition[] = [
  "top-primary",
  "right-primary",
  "bottom-primary",
  "left-primary",
  "top-secondary",
  "right-secondary",
  "bottom-secondary",
  "left-secondary",
];

export function getLewisDotPositions(
  valenceElectrons: number,
): readonly LewisDotPosition[] {
  const dotCount = Math.min(8, Math.max(0, Math.floor(valenceElectrons)));
  return LEWIS_DOT_ORDER.slice(0, dotCount);
}