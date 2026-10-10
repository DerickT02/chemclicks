// Normalization of class display labels (classes.name and classes.section).

/** Trims and collapses inner whitespace; keeps the teacher's casing. This is the stored value. */
export function normalizeClassLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Comparison key for duplicate detection. Must stay in sync with the
 * `classes_teacher_name_section_norm_key` index expression.
 */
export function classLabelKey(raw: string): string {
  return normalizeClassLabel(raw).toLowerCase();
}
