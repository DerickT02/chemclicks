// Logic and types regarding the STUDENT_ATTEMPTS table.

export type AttemptStatus = 'in_progress' | 'completed'

export type StudentAttempt = {
  id: string
  progress_id: string
  attempt_number: number
  score: number | null
  passed: boolean | null
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
