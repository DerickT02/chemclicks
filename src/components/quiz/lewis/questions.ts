import type { QuizQuestion } from "@/components/quiz/types";

/** How many questions each student attempt draws from the pool. */
export const LEWIS_QUESTIONS_PER_ATTEMPT = 12;

/**
 * Lewis structures & bonding quiz pool.
 * Covers valence electrons, Lewis dot diagrams, covalent bonds, and ionic
 * bonding for main-group elements 1–20.
 */
export const LEWIS_BONDING_QUESTIONS: QuizQuestion[] = [
  // Valence electrons
  {
    id: "lewis-valence-location",
    question: "Valence electrons are the electrons located in an atom's:",
    options: [
      "Outermost shell",
      "Innermost shell",
      "Nucleus",
      "Second shell only",
    ],
    correctIndex: 0,
  },
  {
    id: "lewis-valence-nitrogen",
    question: "How many valence electrons does a neutral nitrogen atom have?",
    options: ["3", "5", "7", "2"],
    correctIndex: 1,
  },
  {
    id: "lewis-valence-chlorine",
    question:
      "How many valence electrons does a neutral chlorine atom (atomic number 17) have?",
    options: ["1", "17", "7", "8"],
    correctIndex: 2,
  },
  {
    id: "lewis-valence-magnesium",
    question:
      "How many valence electrons does a neutral magnesium atom (atomic number 12) have?",
    options: ["2", "12", "8", "10"],
    correctIndex: 0,
  },
  {
    id: "lewis-valence-sulfur",
    question:
      "How many valence electrons does a neutral sulfur atom (atomic number 16) have?",
    options: ["2", "4", "8", "6"],
    correctIndex: 3,
  },
  {
    id: "lewis-valence-potassium",
    question:
      "How many valence electrons does a neutral potassium atom (atomic number 19) have?",
    options: ["1", "9", "19", "8"],
    correctIndex: 0,
  },
  {
    id: "lewis-valence-same-group",
    question:
      "With the exception of helium, main-group elements in the same group (column) generally have the same number of:",
    options: [
      "Protons",
      "Valence electrons",
      "Neutrons",
      "Electron shells",
    ],
    correctIndex: 1,
  },

  // Lewis dot diagrams
  {
    id: "lewis-dots-show",
    question: "A Lewis dot diagram shows which electrons around the symbol?",
    options: [
      "All of the atom's electrons",
      "Only the inner-shell electrons",
      "Only the valence electrons",
      "Only paired electrons",
    ],
    correctIndex: 2,
  },
  {
    id: "lewis-dot-placement",
    question:
      "When drawing a Lewis dot diagram, where are the valence-electron dots placed?",
    options: [
      "Inside the element symbol",
      "Around the four sides of the element symbol",
      "Inside the nucleus",
      "In numbered electron shells",
    ],
    correctIndex: 1,
  },
  {
    id: "lewis-dot-pairing",
    question:
      "When drawing a Lewis dot diagram, what is generally done before electrons are paired on the same side?",
    options: [
      "One electron is placed on each available side",
      "All electrons are placed on the same side",
      "Two electrons are placed inside the symbol",
      "The element's protons are counted",
    ],
    correctIndex: 0,
  },
  {
    id: "lewis-dots-oxygen",
    question:
      "How many dots appear around the symbol in the Lewis dot diagram for a neutral oxygen atom?",
    options: ["2", "8", "4", "6"],
    correctIndex: 3,
  },
  {
    id: "lewis-dots-carbon",
    question:
      "How many dots appear around the symbol in the Lewis dot diagram for a neutral carbon atom?",
    options: ["4", "6", "2", "12"],
    correctIndex: 0,
  },
  {
    id: "lewis-dots-phosphorus",
    question:
      "How many dots appear around the symbol in the Lewis dot diagram for a neutral phosphorus atom (atomic number 15)?",
    options: ["3", "15", "5", "8"],
    correctIndex: 2,
  },
  {
    id: "lewis-dots-identify-aluminum",
    question:
      "A neutral atom's Lewis dot diagram has 3 dots. Which of these elements could it be?",
    options: ["Carbon", "Aluminum", "Nitrogen", "Magnesium"],
    correctIndex: 1,
  },
  {
    id: "lewis-octet-rule",
    question: "The octet rule says that atoms tend to:",
    options: [
      "Gain, lose, or share electrons to have 8 valence electrons",
      "Always have 8 protons",
      "Lose all of their valence electrons",
      "Keep exactly 8 electron shells",
    ],
    correctIndex: 0,
  },
  {
    id: "lewis-hydrogen-duet",
    question:
      "When hydrogen forms a bond, how many electrons does it need in its outer shell to be stable?",
    options: ["8", "1", "2", "4"],
    correctIndex: 2,
  },

  // Covalent bonds
  {
    id: "lewis-covalent-definition",
    question: "In a covalent bond, electrons are:",
    options: [
      "Transferred from one atom to another",
      "Shared between atoms",
      "Removed from both atoms",
      "Moved into the nucleus",
    ],
    correctIndex: 1,
  },
  {
    id: "lewis-covalent-between",
    question: "Covalent bonds most commonly form between:",
    options: [
      "Two nonmetals",
      "A metal and a nonmetal",
      "Two metals",
      "Two noble gases",
    ],
    correctIndex: 0,
  },
  {
    id: "lewis-single-bond-electrons",
    question: "A single covalent bond is made of how many shared electrons?",
    options: ["1", "4", "6", "2"],
    correctIndex: 3,
  },
  {
    id: "lewis-double-bond-electrons",
    question: "A double covalent bond is made of how many shared electrons?",
    options: ["2", "4", "6", "8"],
    correctIndex: 1,
  },
  {
    id: "lewis-n2-bond",
    question: "The two atoms in a nitrogen molecule (N₂) are joined by a:",
    options: ["Single bond", "Double bond", "Triple bond", "Ionic bond"],
    correctIndex: 2,
  },
  {
    id: "lewis-co2-bonds",
    question:
      "In carbon dioxide (CO₂), carbon is bonded to each oxygen atom by a:",
    options: ["Double bond", "Single bond", "Triple bond", "Ionic bond"],
    correctIndex: 0,
  },
  {
    id: "lewis-ch4-bonds",
    question:
      "In methane (CH₄), how many single covalent bonds does the carbon atom form?",
    options: ["2", "3", "1", "4"],
    correctIndex: 3,
  },
  {
    id: "lewis-water-lone-pairs",
    question:
      "In the Lewis structure of water (H₂O), how many lone pairs are on the oxygen atom?",
    options: ["0", "1", "2", "4"],
    correctIndex: 2,
  },
  {
    id: "lewis-ammonia-lone-pairs",
    question:
      "In the Lewis structure of ammonia (NH₃), how many lone pairs are on the nitrogen atom?",
    options: ["1", "0", "2", "3"],
    correctIndex: 0,
  },
  {
    id: "lewis-lone-pair-definition",
    question: "A lone pair in a Lewis structure is:",
    options: [
      "A pair of electrons shared between two atoms",
      "A pair of valence electrons not involved in bonding",
      "A single unpaired electron",
      "A pair of protons in the nucleus",
    ],
    correctIndex: 1,
  },

  // Ionic bonding
  {
    id: "lewis-ionic-definition",
    question: "An ionic bond is the attraction between:",
    options: [
      "Two atoms sharing electrons",
      "Oppositely charged ions",
      "Two positively charged ions",
      "Two neutral noble-gas atoms",
    ],
    correctIndex: 1,
  },
  {
    id: "lewis-ionic-between",
    question: "Ionic compounds usually form between:",
    options: [
      "Two nonmetals",
      "Two noble gases",
      "A metal and a nonmetal",
      "Two hydrogen atoms",
    ],
    correctIndex: 2,
  },
  {
    id: "lewis-cation-definition",
    question: "A cation is an ion that:",
    options: [
      "Has a positive net charge",
      "Has a negative net charge",
      "Has no net charge",
      "Always contains more neutrons than protons",
    ],
    correctIndex: 0,
  },
  {
    id: "lewis-sodium-ion",
    question: "Sodium most commonly forms which ion?",
    options: ["Na⁻", "Na²⁺", "Na⁺", "Na²⁻"],
    correctIndex: 2,
  },
  {
    id: "lewis-chloride-ion",
    question: "Chlorine most commonly forms which ion?",
    options: ["Cl⁺", "Cl⁻", "Cl²⁻", "Cl⁷⁺"],
    correctIndex: 1,
  },
  {
    id: "lewis-magnesium-ion",
    question: "Magnesium most commonly forms which ion?",
    options: ["Mg⁺", "Mg²⁻", "Mg⁻", "Mg²⁺"],
    correctIndex: 3,
  },
  {
    id: "lewis-oxide-ion",
    question: "Oxygen most commonly forms which ion?",
    options: ["O²⁻", "O²⁺", "O⁻", "O⁶⁺"],
    correctIndex: 0,
  },
  {
    id: "lewis-sodium-ion-like-neon",
    question:
      "After a sodium atom loses one electron to form Na⁺, its electron arrangement matches which noble gas?",
    options: ["Helium", "Argon", "Neon", "Krypton"],
    correctIndex: 2,
  },
  {
    id: "lewis-ionic-net-charge",
    question: "The overall net charge of an ionic compound is:",
    options: [
      "Always positive",
      "Always negative",
      "Equal to the metal ion's charge",
      "Zero",
    ],
    correctIndex: 3,
  },
  {
    id: "lewis-formula-mgcl2",
    question:
      "What is the formula of the ionic compound formed from Mg²⁺ and Cl⁻ ions?",
    options: ["MgCl", "MgCl₂", "Mg₂Cl", "Mg₂Cl₃"],
    correctIndex: 1,
  },
  {
    id: "lewis-formula-caf2",
    question:
      "What is the formula of the ionic compound formed from calcium and fluorine?",
    options: ["CaF₂", "CaF", "Ca₂F", "CaF₃"],
    correctIndex: 0,
  },
  {
    id: "lewis-formula-al2o3",
    question:
      "What is the formula of the ionic compound formed from Al³⁺ and O²⁻ ions?",
    options: ["AlO", "Al₃O₂", "AlO₃", "Al₂O₃"],
    correctIndex: 3,
  },
];
