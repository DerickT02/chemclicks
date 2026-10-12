// Logic and types regarding the STUDENT_ATTEMPTS table.

export type AttemptStatus = 'in_progress' | 'completed'

export type StudentAttempt = {
  id: string
  progress_id: string
  attempt_number: number
  /** Null for exploration attempts; stable identity for quiz attempts. */
  quiz_key: string | null
  question_total: number | null
  score: number | null
  percentage: number | null
  passed: boolean | null
  /** Idempotency key for a quiz submission. */
  submission_key: string | null
  /** Measurement quiz metadata; null for exploration and other quiz kinds. */
  instrument?: 'ruler' | 'cylinder' | null
  precision_mode?: 'tenths' | 'hundredths' | null
  status: AttemptStatus
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type InsertStudentAttempt = Pick<
  StudentAttempt,
  'progress_id' | 'attempt_number'
>
