// Logic and types regarding the STUDENT_PROGRESS table.

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'

export type StudentProgress = {
  id: string               // UUID, auto-generated
  student_id: string       // UUID, FK → students.id
  class_activity_id: string // UUID, FK → class_activities.id
  status: ProgressStatus   // defaults to 'not_started'
  started_at: string | null
  completed_at: string | null
}

export type InsertStudentProgress = Pick<StudentProgress, 'student_id' | 'class_activity_id'>
