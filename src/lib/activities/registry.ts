import type { ActivityType } from "@/lib/db/activities";

export type ActivityExplorer = "lewis-diagram" | "covalent" | "ionic" | "ruler" | "cylinder";

export type ActivityDefinition = {
  description: string;
  category: string;
  /** Existing assignment content/participation support, not quiz grading. */
  explorer: ActivityExplorer | null;
  /** Null only when a new assignment has a deliverable exploration experience. */
  newAssignmentBlockReason: string | null;
};

const BOHR_BLOCK_REASON = "Bohr models are available in untracked practice, but the assigned exploration experience is not supported yet.";
const UNKNOWN_BLOCK_REASON = "This activity is not supported for new assignments.";

/** Application support only; deployed RPC compatibility still requires a separate audit. */
export const ACTIVITY_REGISTRY: Readonly<Record<ActivityType, ActivityDefinition>> = {
  bohr_model_intro: {
    description: "Explore electron shells for the first 20 elements",
    category: "Bohr Models",
    explorer: null,
    newAssignmentBlockReason: BOHR_BLOCK_REASON,
  },
  bohr_model_stability: {
    description: "Compare electron arrangements and ion stability",
    category: "Bohr Models",
    explorer: null,
    newAssignmentBlockReason: BOHR_BLOCK_REASON,
  },
  lewis_diagram: {
    description: "Explore valence electrons with Lewis dot diagrams",
    category: "Lewis Structures",
    explorer: "lewis-diagram",
    newAssignmentBlockReason: null,
  },
  lewis_structures_covalent: {
    description: "Explore covalent molecules and shared electron pairs",
    category: "Lewis Structures",
    explorer: "covalent",
    newAssignmentBlockReason: null,
  },
  lewis_structures_ionic: {
    description: "Explore ionic compounds and charge balance",
    category: "Lewis Structures",
    explorer: "ionic",
    newAssignmentBlockReason: null,
  },
  measurement_ruler_tenths: {
    description: "Read a 0–10 cm ruler to the nearest 0.1 cm",
    category: "Measurement",
    explorer: "ruler",
    newAssignmentBlockReason: null,
  },
  measurement_ruler_hundredths: {
    description: "Read a 0–10 cm ruler to the nearest 0.01 cm",
    category: "Measurement",
    explorer: "ruler",
    newAssignmentBlockReason: null,
  },
  measurement_graduated_cylinder: {
    description: "Read liquid volume from a graduated cylinder",
    category: "Measurement",
    explorer: "cylinder",
    newAssignmentBlockReason: null,
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
  if (!definition?.explorer) return definition?.newAssignmentBlockReason ?? UNKNOWN_BLOCK_REASON;
  return definition.newAssignmentBlockReason;
}

export function canAssignActivity(type: string): boolean {
  return getNewAssignmentBlockReason(type) === null;
}
