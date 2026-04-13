// Logic and types regarding the CLASSES table.

export type Class = {
  id: string          // UUID, auto-generated
  teacher_id: string  // UUID, FK → teachers.id
  name: string
  section: string
  class_code: string  // 6-char uppercase alphanumeric, unique
  is_active: boolean  // defaults to true
  created_at: string  // ISO 8601 timestamp, auto-set
}

export type InsertClass = Pick<Class, 'teacher_id' | 'name' | 'section' | 'class_code'>
