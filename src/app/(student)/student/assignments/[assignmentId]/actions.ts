'use server'

import { revalidatePath } from 'next/cache'
import { transitionStudentAttempt, type AttemptAction } from '@/lib/server/student-assignments'

export type AttemptFormState = { error: string | null }

export async function saveAttempt(_previous: AttemptFormState, form: FormData): Promise<AttemptFormState> {
  const assignmentId = form.get('assignmentId')
  const action = form.get('action')
  const attemptId = form.get('attemptId')
  if (typeof assignmentId !== 'string' || typeof action !== 'string'
    || !['start', 'complete', 'retry'].includes(action)
    || (attemptId !== null && typeof attemptId !== 'string')) {
    return { error: 'Invalid attempt request.' }
  }
  try {
    await transitionStudentAttempt(assignmentId, action as AttemptAction, attemptId ?? undefined)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save. Please try again.' }
  }
  revalidatePath(`/student/assignments/${assignmentId}`)
  revalidatePath('/student')
  return { error: null }
}
