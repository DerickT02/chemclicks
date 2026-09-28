import { hasActivityContent } from '@/lib/assignments/activity-content'
import { isAssignmentAvailable } from '@/lib/assignments/availability'
import type { ActivityType } from '@/lib/db/activities'

export function isSupportedExploration(type: string): boolean {
  return hasActivityContent(type as ActivityType)
}

export function assignmentIsOpen(opensAt: string | null, closesAt: string | null, now = Date.now()): boolean {
  return isAssignmentAvailable({ opens_at: opensAt, closes_at: closesAt }, now)
}
