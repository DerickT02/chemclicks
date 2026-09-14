export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  /** Zero-based index of the correct option in `options`. */
  correctIndex: number;
};

export type QuizCompleteResult = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
};

export type QuizShellProps = {
  title: string;
  questions: QuizQuestion[];
  /** Minimum percent required to pass (0–100). Defaults to 80. */
  passingThresholdPercent?: number;
  onComplete?: (result: QuizCompleteResult) => void;
  /** Called when the student chooses to retry; use to draw a new random set. */
  onRetry?: () => void;
};
