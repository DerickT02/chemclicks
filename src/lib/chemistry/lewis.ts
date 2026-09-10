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

const ELECTRON_SHELL_CAPACITIES = [2, 8, 8, 2] as const;

export function getElectronShells(atomicNumber: number): readonly number[] {
  let remainingElectrons = Math.min(
    20,
    Math.max(0, Math.floor(atomicNumber)),
  );
  const shells: number[] = [];

  for (const capacity of ELECTRON_SHELL_CAPACITIES) {
    if (remainingElectrons === 0) {
      break;
    }

    const electronCount = Math.min(capacity, remainingElectrons);
    shells.push(electronCount);
    remainingElectrons -= electronCount;
  }

  return shells;
}

export function getLewisDotPositions(
  valenceElectrons: number,
): readonly LewisDotPosition[] {
  const dotCount = Math.min(8, Math.max(0, Math.floor(valenceElectrons)));
  return LEWIS_DOT_ORDER.slice(0, dotCount);
}
