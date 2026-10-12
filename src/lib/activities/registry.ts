import type { ActivityType } from "@/lib/db/activities";

export type ActivityExplorer = "bohr" | "lewis-diagram" | "covalent" | "ionic" | "ruler" | "cylinder";

export type ActivityDefinition = {
  description: string;
  category: string;
  /** The exploration an assignment of this type opens. */
  explorer: ActivityExplorer;
};

const UNKNOWN_BLOCK_REASON = "This activity is not supported for new assignments.";

/** Application support only; deployed RPC compatibility still requires a separate audit. */
export const ACTIVITY_REGISTRY: Readonly<Record<ActivityType, ActivityDefinition>> = {
  bohr_model_intro: {
    description: "Explore electron shells for the first 20 elements",
    category: "Bohr Models",
    explorer: "bohr",
  },
  bohr_model_stability: {
    description: "Compare electron arrangements and ion stability",
    category: "Bohr Models",
    explorer: "bohr",
  },
  lewis_diagram: {
    description: "Explore valence electrons with Lewis dot diagrams",
    category: "Lewis Structures",
    explorer: "lewis-diagram",
  },
  lewis_structures_covalent: {
    description: "Explore covalent molecules and shared electron pairs",
    category: "Lewis Structures",
    explorer: "covalent",
  },
  lewis_structures_ionic: {
    description: "Explore ionic compounds and charge balance",
    category: "Lewis Structures",
    explorer: "ionic",
  },
  measurement_ruler_tenths: {
    description: "Read a 0–10 cm ruler to the nearest 0.1 cm",
    category: "Measurement",
    explorer: "ruler",
  },
  measurement_ruler_hundredths: {
    description: "Read a 0–10 cm ruler to the nearest 0.01 cm",
    category: "Measurement",
    explorer: "ruler",
  },
  measurement_graduated_cylinder: {
    description: "Read liquid volume from a graduated cylinder",
    category: "Measurement",
    explorer: "cylinder",
  },
};

/** Unknown database types fail closed, including inherited object properties. */
export function getActivityDefinition(type: string): ActivityDefinition | null {
  return Object.hasOwn(ACTIVITY_REGISTRY, type)
    ? ACTIVITY_REGISTRY[type as ActivityType]
    : null;
}

/** Every catalog activity can be assigned; only types the app does not know are refused. */
export function getNewAssignmentBlockReason(type: string): string | null {
  return getActivityDefinition(type) ? null : UNKNOWN_BLOCK_REASON;
}

export function canAssignActivity(type: string): boolean {
  return getNewAssignmentBlockReason(type) === null;
}
