export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  /** Zero-based index of the correct option in `options`. */
  correctIndex: number;
  /** Maps a displayed option index back to the authored/database index. */
  answerOrder?: number[];
};

export type QuizAnswer = {
  questionId: string;
  selectedIndex: number;
};

export type QuizCompleteResult = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  attemptId?: string;
  attemptNumber?: number;
  nextDestination?: string | null;
};

export type QuizShellProps = {
  title: string;
  questions: QuizQuestion[];
  /** Minimum percent required to pass (0–100). Defaults to 80. */
  passingThresholdPercent?: number;
  onComplete?: (result: QuizCompleteResult) => void;
  onSubmit?: (answers: QuizAnswer[]) => Promise<QuizCompleteResult>;
  /** Called when the student chooses to retry; use to draw a new random set. */
  onRetry?: () => void;
};
