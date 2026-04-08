// Logic and types regarding the STUDENTS table.

export type Student = {
  id: string          // UUID, auto-generated
  class_id: string    // UUID, FK → classes.id
  first_name: string
  last_name: string
  created_at: string  // ISO 8601 timestamp, auto-set
}

export type InsertStudent = Pick<Student, 'class_id' | 'first_name' | 'last_name'>
