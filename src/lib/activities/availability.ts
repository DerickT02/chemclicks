export function isSupportedExploration(type: string): boolean {
  return ['lewis_diagram', 'measurement_ruler_hundredths', 'measurement_graduated_cylinder'].includes(type)
}

export function assignmentIsOpen(opensAt: string | null, closesAt: string | null, now = Date.now()): boolean {
  return (!opensAt || Date.parse(opensAt) <= now) && (!closesAt || Date.parse(closesAt) > now)
}
