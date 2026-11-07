import type { AssignmentProgressFacts } from '@/lib/assignments/progress'

export function progressFacts(overrides: Partial<AssignmentProgressFacts> = {}): AssignmentProgressFacts {
  return {
    stage: 'not_started',
    explorationStartedAt: null,
    firstQuizStartedAt: null,
    timeToFirstQuizSeconds: null,
    passingQuizAttemptNumber: null,
    passingQuizScore: null,
    passingQuizTotal: null,
    passingQuizPercentage: null,
    failedQuizAttemptCount: 0,
    completedAt: null,
    ...overrides,
  }
}
