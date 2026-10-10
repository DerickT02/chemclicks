import type { ActivityType } from "@/lib/db/activities";

export type ActivityExplorer = "lewis-diagram" | "covalent" | "ionic" | "ruler" | "cylinder";

export type ActivityDefinition = {
  title: string;
  description: string;
  category: string;
  /** Existing assignment content/participation support, not quiz grading. */
  explorer: ActivityExplorer | null;
  practicePath: string | null;
  quiz: "bohr" | "covalent" | "ionic" | "measurement" | null;
  /** Null only when a new assignment has a deliverable exploration experience. */
  newAssignmentBlockReason: string | null;
  showInCatalog: boolean;
};

const BOHR_BLOCK_REASON = "Bohr models are available in untracked practice, but the assigned exploration experience is not supported yet.";
const RULER_BLOCK_REASON = "New ruler assignments are paused until the ruler reports measurements to 0.1 cm consistently. Untracked practice remains available.";
const UNKNOWN_BLOCK_REASON = "This activity is not supported for new assignments.";

/** Application support only; deployed RPC compatibility still requires a separate audit. */
export const ACTIVITY_REGISTRY: Readonly<Record<ActivityType, ActivityDefinition>> = {
  bohr_model_intro: {
    title: "Bohr Models — Introduction",
    description: "Explore electron shells for the first 20 elements",
    category: "Bohr Models",
    explorer: null,
    practicePath: "/student/labs/bohr-models",
    quiz: "bohr",
    newAssignmentBlockReason: BOHR_BLOCK_REASON,
    showInCatalog: true,
  },
  bohr_model_stability: {
    title: "Bohr Models — Stability",
    description: "Compare electron arrangements and ion stability",
    category: "Bohr Models",
    explorer: null,
    practicePath: "/student/labs/bohr-models",
    quiz: "bohr",
    newAssignmentBlockReason: BOHR_BLOCK_REASON,
    showInCatalog: true,
  },
  lewis_diagram: {
    title: "Lewis Diagrams",
    description: "Explore valence electrons with Lewis dot diagrams",
    category: "Lewis Structures",
    explorer: "lewis-diagram",
    practicePath: "/student/labs/lewis",
    quiz: null,
    newAssignmentBlockReason: null,
    showInCatalog: true,
  },
  lewis_structures_covalent: {
    title: "Lewis Structures — Covalent",
    description: "Explore covalent molecules and shared electron pairs",
    category: "Lewis Structures",
    explorer: "covalent",
    practicePath: "/student/labs/lewis",
    quiz: "covalent",
    newAssignmentBlockReason: null,
    showInCatalog: true,
  },
  lewis_structures_ionic: {
    title: "Lewis Structures — Ionic",
    description: "Explore ionic compounds and charge balance",
    category: "Lewis Structures",
    explorer: "ionic",
    practicePath: "/student/labs/lewis",
    quiz: "ionic",
    newAssignmentBlockReason: null,
    showInCatalog: true,
  },
  measurement_ruler_tenths: {
    title: "Ruler — Tenths",
    description: "Ruler exploration; the 0.1 cm reporting update is pending",
    category: "Measurement",
    explorer: "ruler",
    practicePath: "/student/labs/measurement",
    quiz: "measurement",
    newAssignmentBlockReason: RULER_BLOCK_REASON,
    showInCatalog: true,
  },
  measurement_ruler_hundredths: {
    title: "Ruler — Hundredths (retired)",
    description: "Retired ruler offering; use the single tenths experience after its precision update",
    category: "Measurement",
    // Do not change existing attempt access in this catalog-only slice. Removal
    // of the old content/type is part of P1-04, not a new compatibility mode.
    explorer: "ruler",
    practicePath: null,
    quiz: null,
    newAssignmentBlockReason: "The separate hundredths ruler offering is retired and cannot be newly assigned.",
    showInCatalog: false,
  },
  measurement_graduated_cylinder: {
    title: "Graduated Cylinder",
    description: "Read liquid volume from a graduated cylinder",
    category: "Measurement",
    explorer: "cylinder",
    practicePath: "/student/labs/measurement",
    quiz: "measurement",
    newAssignmentBlockReason: null,
    showInCatalog: true,
  },
};

/** Unknown database types fail closed, including inherited object properties. */
export function getActivityDefinition(type: string): ActivityDefinition | null {
  return Object.hasOwn(ACTIVITY_REGISTRY, type)
    ? ACTIVITY_REGISTRY[type as ActivityType]
    : null;
}

export function getNewAssignmentBlockReason(type: string): string | null {
  const definition = getActivityDefinition(type);
  if (!definition || !definition.explorer || !definition.showInCatalog) return definition?.newAssignmentBlockReason ?? UNKNOWN_BLOCK_REASON;
  return definition.newAssignmentBlockReason;
}

export function canAssignActivity(type: string): boolean {
  return getNewAssignmentBlockReason(type) === null;
}
