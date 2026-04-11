// Logic and types regarding the CLASS_ACTIVITIES table.

export type ClassActivity = {
  id: string                  // UUID, auto-generated
  class_id: string            // UUID, FK → classes.id
  activity_id: string         // UUID, FK → activities.id
  opens_at: string | null     // ISO 8601 timestamp, optional
  closes_at: string | null    // ISO 8601 timestamp, optional
  passing_threshold: number   // 1–100, defaults to 70
  created_at: string          // ISO 8601 timestamp, auto-set
}

export type InsertClassActivity = Pick<ClassActivity, 'class_id' | 'activity_id'>
