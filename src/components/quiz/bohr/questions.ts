import type { QuizQuestion } from "@/components/quiz/types";

/** How many questions each student attempt draws from the pool. */
export const BOHR_QUESTIONS_PER_ATTEMPT = 12;

/**
 * Bohr Models introductory quiz pool.
 * Covers nucleus basics, electron counts, the simplified shell-filling
 * pattern for elements 1–20, electron distributions through calcium
 * (2, 8, 8, 2), and identification of elements 1–20.
 */
export const BOHR_MODEL_QUESTIONS: QuizQuestion[] = [
  {
    id: "bohr-beryllium-shells",
  
    question:
      "Beryllium (atomic number 4) has which electron shell distribution?",
  
    options: ["4", "2, 1", "2, 2", "1, 3"],
  
    correctIndex: 2,
  },
  
  {
    id: "bohr-boron-outer",
  
    question:
      "Boron (atomic number 5) has how many electrons in its outermost shell?",
  
    options: ["2", "5", "8", "3"],
  
    correctIndex: 3,
  },
  
  {
    id: "bohr-identify-carbon",
  
    question:
      "A neutral atom has the electron shell distribution 2, 4. Which element is it?",
  
    options: ["Oxygen", "Boron", "Carbon", "Nitrogen"],
  
    correctIndex: 2,
  },
  
  {
    id: "bohr-oxygen-shells",
  
    question:
      "Oxygen (atomic number 8) has which electron shell distribution?",
  
    options: ["8", "2, 4", "2, 8", "2, 6"],
  
    correctIndex: 3,
  },
  
  {
    id: "bohr-aluminum-shells",
  
    question:
      "Aluminum (atomic number 13) has which electron shell distribution?",
  
    options: ["2, 8, 2", "2, 8, 4", "2, 8, 3", "2, 11"],
  
    correctIndex: 2,
  },
  
  {
    id: "bohr-identify-silicon",
  
    question:
      "A neutral atom has 14 electrons. Which element is it?",
  
    options: ["Aluminum", "Phosphorus", "Sulfur", "Silicon"],
  
    correctIndex: 3,
  },
  
  {
    id: "bohr-phosphorus-outer",
  
    question:
      "Phosphorus (atomic number 15) has how many electrons in its outermost shell?",
  
    options: ["3", "8", "5", "15"],
  
    correctIndex: 2,
  },
  
  {
    id: "bohr-argon-outer",
  
    question:
      "Argon (atomic number 18) has how many electrons in its outermost shell?",
  
    options: ["2", "18", "6", "8"],
  
    correctIndex: 3,
  },

  {
    id: "bohr-protons-location",
    question: "Where are protons located in a Bohr model?",
    options: [
      "In the shells",
      "In the nucleus",
      "Orbiting the nucleus",
      "Outside the atom",
    ],
    correctIndex: 1,
  },
  {
    id: "bohr-electrons-location",
    question: "Where are electrons located in a Bohr model?",
    options: [
      "Only in the nucleus",
      "In shells around the nucleus",
      "Between protons and neutrons",
      "Randomly throughout the atom",
    ],
    correctIndex: 1,
  },
  {
    id: "bohr-neutral-electron-count",
    question:
      "In a neutral atom, the number of electrons equals the number of:",
    options: ["Neutrons", "Protons", "Shells", "Valence pairs"],
    correctIndex: 1,
  },
  {
    id: "bohr-atomic-number-means",
    question: "The atomic number of an element tells you the number of:",
    options: [
      "Neutrons only",
      "Protons in the nucleus",
      "Electron shells always filled",
      "Molecules it can form",
    ],
    correctIndex: 1,
  },
  {
    id: "bohr-first-shell",
    question: "How many electrons can the first shell hold for elements 1–20?",
    options: ["8", "2", "18", "4"],
    correctIndex: 1,
  },
  {
    id: "bohr-second-shell-capacity",
    question: "How many electrons can the second shell hold?",
    options: ["2", "8", "18", "20"],
    correctIndex: 1,
  },
  {
    id: "bohr-third-shell-capacity",
    question:
      "For elements 1–20, how many electrons can the third shell hold before the fourth shell starts filling?",
    options: ["2", "8", "18", "20"],
    correctIndex: 1,
  },
  {
    id: "bohr-calcium-shells",
    question:
      "A neutral calcium atom (atomic number 20) has which electron shell distribution?",
    options: ["2, 8, 18, 8", "2, 8, 8, 2", "8, 8, 2, 2", "2, 2, 8, 8"],
    correctIndex: 1,
  },
  {
    id: "bohr-identify-hydrogen",
    question: "Which element has exactly 1 electron in a neutral Bohr model?",
    options: ["Helium", "Hydrogen", "Lithium", "Neon"],
    correctIndex: 1,
  },
  {
    id: "bohr-identify-helium",
    question: "A neutral atom with shell distribution 2 is which element?",
    options: ["Hydrogen", "Helium", "Lithium", "Beryllium"],
    correctIndex: 1,
  },
  {
    id: "bohr-lithium-shells",
    question: "Lithium (atomic number 3) has which electron shell distribution?",
    options: ["3", "2, 1", "1, 2", "2, 8"],
    correctIndex: 1,
  },
  {
    id: "bohr-carbon-second-shell",
    question:
      "Carbon (atomic number 6) has how many electrons in its second shell?",
    options: ["2", "4", "6", "8"],
    correctIndex: 1,
  },
  {
    id: "bohr-nitrogen-shells",
    question:
      "Nitrogen (atomic number 7) has which electron shell distribution?",
    options: ["2, 5", "2, 8", "7", "2, 4, 1"],
    correctIndex: 0,
  },
  {
    id: "bohr-oxygen-electron-count",
    question: "A neutral oxygen atom (atomic number 8) has how many electrons?",
    options: ["6", "8", "16", "2"],
    correctIndex: 1,
  },
  {
    id: "bohr-fluorine-valence",
    question:
      "Fluorine (atomic number 9) has how many electrons in its outer shell?",
    options: ["2", "7", "9", "8"],
    correctIndex: 1,
  },
  {
    id: "bohr-identify-neon",
    question: "A neutral atom has the electron shell distribution 2, 8. Which element is it?",
    options: ["Oxygen", "Neon", "Sodium", "Fluorine"],
    correctIndex: 1,
  },
  {
    id: "bohr-identify-sodium",
    question:
      "A neutral atom has the electron shell distribution 2, 8, 1. Which element is it?",
    options: ["Neon", "Sodium", "Magnesium", "Fluorine"],
    correctIndex: 1,
  },
  {
    id: "bohr-magnesium-shells",
    question:
      "Magnesium (atomic number 12) has which electron shell distribution?",
    options: ["2, 8, 2", "2, 10", "2, 8, 1", "12"],
    correctIndex: 0,
  },
  {
    id: "bohr-aluminum-electron-count",
    question:
      "A neutral aluminum atom (atomic number 13) has how many electrons?",
    options: ["3", "13", "26", "8"],
    correctIndex: 1,
  },
  {
    id: "bohr-silicon-outer",
    question:
      "Silicon (atomic number 14) has how many electrons in its outer shell?",
    options: ["2", "4", "8", "14"],
    correctIndex: 1,
  },
  {
    id: "bohr-identify-phosphorus",
    question:
      "A neutral atom has the electron shell distribution 2, 8, 5. Which element is it?",
    options: ["Aluminum", "Phosphorus", "Sulfur", "Chlorine"],
    correctIndex: 1,
  },
  {
    id: "bohr-sulfur-shells",
    question: "Sulfur (atomic number 16) has which electron shell distribution?",
    options: ["2, 8, 6", "2, 8, 8", "2, 14", "8, 8"],
    correctIndex: 0,
  },
  {
    id: "bohr-chlorine-shells",
    question:
      "Chlorine (atomic number 17) has which electron shell distribution?",
    options: ["2, 8, 7", "2, 8, 8", "2, 15", "8, 8, 1"],
    correctIndex: 0,
  },
  {
    id: "bohr-argon-shells",
    question: "Argon (atomic number 18) has which electron shell distribution?",
    options: ["2, 8, 6", "2, 8, 8", "2, 8, 8, 2", "2, 16"],
    correctIndex: 1,
  },
  {
    id: "bohr-potassium-shells",
    question:
      "Potassium (atomic number 19) has which electron shell distribution?",
    options: ["2, 8, 9", "2, 8, 8, 1", "2, 8, 8", "19"],
    correctIndex: 1,
  },
  {
    id: "bohr-identify-calcium",
    question:
      "A neutral atom has 20 electrons with shell distribution 2, 8, 8, 2. Which element is it?",
    options: ["Potassium", "Calcium", "Argon", "Magnesium"],
    correctIndex: 1,
  },
  {
    id: "bohr-calcium-outer",
    question:
      "Calcium (atomic number 20) has how many electrons in its outermost shell?",
    options: ["8", "2", "20", "10"],
    correctIndex: 1,
  },
  {
    id: "bohr-which-fills-first",
    question: "In the Bohr model for elements 1–20, which shell fills first?",
    options: [
      "The outermost shell",
      "The shell closest to the nucleus",
      "The third shell",
      "All shells fill at the same time",
    ],
    correctIndex: 1,
  },
];

/** Fisher–Yates shuffle of array items (mutates `items`). */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }
  return items;
}

/** Shuffle answer choices so the correct option is not always in the same position. */
export function shuffleQuestionOptions(question: QuizQuestion): QuizQuestion {
  const entries = question.options.map((option, index) => ({
    option,
    isCorrect: index === question.correctIndex,
  }));
  shuffleInPlace(entries);

  return {
    ...question,
    options: entries.map((entry) => entry.option),
    correctIndex: entries.findIndex((entry) => entry.isCorrect),
  };
}

/** Fisher–Yates shuffle, then take the first `count` questions with shuffled options. */
export function pickRandomQuestions(
  pool: QuizQuestion[],
  count: number,
): QuizQuestion[] {
  const copy = shuffleInPlace([...pool]);
  return copy
    .slice(0, Math.min(count, copy.length))
    .map(shuffleQuestionOptions);
}