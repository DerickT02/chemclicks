import { describe, expect, it } from 'vitest'
import { normalizeAssignmentProgress } from '@/lib/assignments/progress'
import { progressFacts } from '../testing/progress'

describe('assignment progress normalization', () => {
  it.each([
    ['not_started', 'not_started'],
    ['in_progress', 'exploring'],
    ['exploring', 'exploring'],
    ['taking_quiz', 'quiz_in_progress'],
    ['needs_retry', 'needs_retry'],
    ['completed', 'completed'],
  ] as const)('maps legacy status %s to %s without fabricating history', (status, stage) => {
    expect(normalizeAssignmentProgress({}, status)).toEqual(progressFacts({ stage }))
  })

  it('prefers the explicit stage over the legacy status', () => {
    expect(normalizeAssignmentProgress({ stage: 'explored' }, 'completed').stage).toBe('explored')
  })

  it('preserves recorded facts, including zero values, without mutating the input', () => {
    const facts = progressFacts({
      stage: 'needs_retry',
      explorationStartedAt: '2026-09-23T12:00:00Z',
      firstQuizStartedAt: '2026-09-23T12:00:00Z',
      timeToFirstQuizSeconds: 0,
      passingQuizAttemptNumber: 1,
      passingQuizScore: 0,
      passingQuizTotal: 12,
      passingQuizPercentage: 0,
      failedQuizAttemptCount: 0,
    })
    const input = Object.freeze({ ...facts })
    expect(normalizeAssignmentProgress(input, 'in_progress')).toEqual(facts)
    expect(input).toEqual(facts)
  })
})
