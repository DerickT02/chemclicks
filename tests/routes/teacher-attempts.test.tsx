import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'
const mock = vi.hoisted(() => ({ activities: vi.fn(), summary: vi.fn() }))
vi.mock('@/lib/server/teacher-activities', () => ({ getTeacherClassActivities: mock.activities }))
vi.mock('@/lib/server/teacher-attempts', () => ({ getTeacherActivityAttemptSummary: mock.summary }))
import Page from '@/app/admin/classes/[classId]/attempts/page'
import { AttemptRoster } from '@/app/admin/classes/[classId]/attempts/AttemptRoster'
import Loading from '@/app/admin/classes/[classId]/attempts/loading'
import ErrorPage from '@/app/admin/classes/[classId]/attempts/error'
const report: TeacherActivityAttemptSummary = {
  classId: 'class', className: 'Chemistry', assignmentId: 'second', activityId: 'activity', activityTitle: 'Lewis diagrams',
  students: [
    { studentId: 'zero', firstName: 'Zero', lastName: 'Student', verified: false, attemptCount: 0, completedCount: 0, inProgressCount: 0, overallStatus: 'not_started', explorationStatus: 'not_started', explorationDurationSeconds: null, passingQuizAttemptNumber: null, passingQuizScore: null, passingQuizTotal: null, passingQuizPercentage: null, passingQuizCompletedAt: null, failedQuizAttemptCount: 0, attempts: [] },
    { studentId: 'many', firstName: 'Many', lastName: 'Student', verified: true, attemptCount: 2, explorationAttemptCount: 1, quizAttemptCount: 1, completedCount: 1, inProgressCount: 1, overallStatus: 'exploring', explorationStatus: 'in_progress', explorationDurationSeconds: null, passingQuizAttemptNumber: 1, passingQuizScore: 4, passingQuizTotal: 5, passingQuizPercentage: 80, passingQuizCompletedAt: '2026-09-23T12:05:00Z', failedQuizAttemptCount: 0, attempts: [
      { id: 'two', attemptNumber: 2, status: 'in_progress', startedAt: '2026-09-24T12:00:00Z', completedAt: null, kind: 'exploration', quizKey: null },
      { id: 'one', attemptNumber: 1, status: 'completed', startedAt: '2026-09-23T12:00:00Z', completedAt: '2026-09-23T12:05:00Z', kind: 'quiz', quizKey: 'measurement_ruler_tenths', instrument: 'ruler', precisionMode: 'tenths', score: 4, questionTotal: 5, percentage: 80, passed: true },
    ] },
  ],
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.activities.mockResolvedValue({ id: 'class', name: 'Chemistry', assignments: [{ id: 'first', title: 'Ruler' }, { id: 'second', title: 'Lewis diagrams' }] })
  mock.summary.mockResolvedValue(report)
})
const props = (assignmentId?: string) => ({ params: Promise.resolve({ classId: 'class' }), searchParams: Promise.resolve({ assignmentId }) })
describe('teacher report', () => {
  it('renders zeros, statuses and readable timestamps with a timezone', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={report} />)
    for (const text of ['0 attempts', 'No attempts yet.', '2 attempts', '1 exploration attempt', '1 quiz attempt', '4/5 · Passed', '1 completed', '1 in progress', 'Ruler · tenths (0.1 cm)', 'Not completed', '2026-09-23 12:00:00 UTC', 'UTC', '<details ', 'dateTime="2026-09-23T12:05:00Z"']) expect(html).toContain(text)
  })
  it('names each quiz and shows its score instead of the stored quiz key', () => {
    const quizAttempt = (id: string, quizKey: string, score: number, passed: boolean) => ({
      id, attemptNumber: 1, status: 'completed' as const, startedAt: '2026-09-23T12:00:00Z', completedAt: '2026-09-23T12:05:00Z',
      kind: 'quiz' as const, quizKey, score, questionTotal: 12, percentage: (score / 12) * 100, passed,
    })
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[1], attempts: [quizAttempt('a', 'bohr_model_intro', 4, false), quizAttempt('b', 'bohr_model_stability', 11, true), quizAttempt('c', 'bohr_models', 12, true), quizAttempt('d', 'future_quiz', 12, true)],
    }] }} />)
    for (const text of ['Bohr Model Introduction Quiz', '4/12 · Not passed', 'Bohr Model Stability Quiz', '11/12 · Passed', 'Bohr Models Quiz', '12/12 · Passed']) expect(html).toContain(text)
    for (const key of ['bohr_model_intro', 'bohr_model_stability', 'bohr_models', 'future_quiz']) expect(html).not.toContain(key)
  })
  it('shows a started quiz even before a result row exists and keeps both quiz timestamps', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0],
      overallStatus: 'taking_quiz',
      progressStage: 'quiz_in_progress',
      explorationStatus: 'completed',
      explorationDurationSeconds: 3661,
      failedQuizAttemptCount: 1,
      stage: 'Taking quiz',
      firstQuizStartedAt: '2026-09-23T12:00:00Z',
      quizStartedAt: '2026-09-24T12:00:00Z',
      explorationStartedAt: '2026-09-23T11:00:00Z',
      timeToFirstQuizSeconds: 3661,
    }] }} />)

    expect(html).toContain('Taking the quiz</span>')
    expect(html).toContain('Quiz started; no result submitted yet.')
    expect(html).toContain('Exploration started')
    expect(html).toContain('First quiz started')
    expect(html).toContain('Latest quiz started')
    expect(html).toContain('Exploration to first quiz:</dt><dd>1h 1m')
    expect(html).toContain('Quiz:</dt><dd>In progress · 1 attempt not passed')
  })
  it('shows a single exploration figure from the saved exploration-to-first-quiz interval', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progressStage: 'completed', overallStatus: 'completed',
      explorationDurationSeconds: 125, timeToFirstQuizSeconds: 125,
    }] }} />)
    expect(html.match(/2m 5s/g)).toHaveLength(1)
    expect(html).not.toContain('Exploration:</dt>')
  })
  it.each([
    ['not_started', 'Not started'],
    ['exploring', 'Started the assignment'],
    ['explored', 'Exploration finished, quiz not started'],
    ['quiz_in_progress', 'Taking the quiz'],
    ['needs_retry', 'Quiz not passed, needs retry'],
    ['completed', 'Completed'],
  ] as const)('renders the server-derived stage %s', (progressStage, label) => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progressStage,
    }] }} />)
    expect(html).toContain(`${label}</span>`)
  })
  it.each([
    ['not_started', 'Not started'],
    ['exploring', 'Started the assignment'],
    ['taking_quiz', 'Taking the quiz'],
    ['needs_retry', 'Quiz not passed, needs retry'],
    ['completed', 'Completed'],
  ] as const)('falls back to overallStatus %s on a database without progressStage', (overallStatus, label) => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], overallStatus,
    }] }} />)
    expect(html).toContain(`${label}</span>`)
  })
  it.each([0, -1, 59, 60])('formats unusual timer values safely (%s seconds)', seconds => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progressStage: 'quiz_in_progress', timeToFirstQuizSeconds: seconds,
    }] }} />)
    const expected = seconds <= 0 ? '0s' : seconds < 60 ? `${seconds}s` : '1m 0s'
    expect(html).toContain(`Exploration to first quiz:</dt><dd>${expected}`)
  })
  it('loads the explicitly selected assignment and keeps it selected', async () => {
    const html = renderToStaticMarkup(await Page(props('second')))
    expect(mock.summary).toHaveBeenCalledWith('class', 'second')
    expect(html).toContain('value="second" selected=""')
  })
  it('defaults to the first assignment', async () => {
    await Page(props())
    expect(mock.summary).toHaveBeenCalledWith('class', 'first')
  })
  it('rejects a foreign assignment instead of silently selecting another', async () => {
    await expect(Page(props('foreign'))).rejects.toThrow('access denied')
    expect(mock.summary).not.toHaveBeenCalled()
  })
  it('propagates database failures to the error boundary', async () => {
    mock.summary.mockRejectedValue(new Error('unavailable'))
    await expect(Page(props())).rejects.toThrow('unavailable')
  })
  it('distinguishes no assignments from no students', async () => {
    mock.activities.mockResolvedValue({ id: 'class', name: 'Chemistry', assignments: [] })
    expect(renderToStaticMarkup(await Page(props()))).toContain('No activities assigned')
    expect(mock.summary).not.toHaveBeenCalled()
    expect(renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [] }} />)).toContain('No students enrolled')
  })
  it('shows the unified status for each student instead of just raw counts', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={report} />)
    expect(html).toContain('Not started')
    expect(html).toContain('Started the assignment')
  })
  it('says when history is unknown instead of fabricating times', () => {
    const student = (overrides: Partial<TeacherActivityAttemptSummary['students'][number]>) => ({
      ...report.students[0], ...overrides,
    })
    const notStarted = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({})] }} />)
    expect(notStarted).toContain('Exploration started:</dt><dd>Not started')
    expect(notStarted).not.toContain('Exploration to first quiz')
    const exploring = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({
      progressStage: 'exploring', explorationStartedAt: null,
    })] }} />)
    expect(exploring).toContain('Start time not recorded')
    expect(exploring).toContain('Exploration to first quiz:</dt><dd>Quiz not started')
    const historical = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({
      progressStage: 'completed', passingQuizAttemptNumber: 1, passingQuizScore: 11, passingQuizTotal: 12,
      passingQuizPercentage: 91.67, completedAt: null,
    })] }} />)
    expect(historical).toContain('Exploration to first quiz:</dt><dd>Not recorded')
    expect(historical).toContain('Completed:</dt><dd>Time not recorded')
  })
  it('shows the completion time from the saved record', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progressStage: 'completed', completedAt: '2026-09-25T08:30:00Z',
    }] }} />)
    expect(html).toContain('dateTime="2026-09-25T08:30:00Z"')
  })
  it('shows the passing quiz attempt distinctly from a not-yet-passed failed-attempt count', () => {
    const student = (overrides: Partial<TeacherActivityAttemptSummary['students'][number]>) => ({
      ...report.students[0], ...overrides,
    })
    const needsRetry = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({
      progressStage: 'needs_retry', overallStatus: 'needs_retry', failedQuizAttemptCount: 2,
    })] }} />)
    expect(needsRetry).toContain('Not passed yet · 2 attempts submitted')
    expect(needsRetry).not.toContain('Completed')
    const passed = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({
      progressStage: 'completed', overallStatus: 'completed', passingQuizAttemptNumber: 2, passingQuizScore: 10, passingQuizTotal: 12,
      passingQuizPercentage: 83.33, passingQuizCompletedAt: '2026-09-23T12:05:00Z', failedQuizAttemptCount: 1,
    })] }} />)
    expect(passed).toContain('Passed on attempt 2: 10/12 (83.33%)')
  })
  it('does not show a pass or score for a student with no submitted quiz', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progressStage: 'explored',
    }] }} />)
    expect(html).toContain('Quiz:</dt><dd>Not started')
    expect(html).not.toMatch(/\d+\/\d+/)
  })
  it('provides accessible loading and retry states without showing raw errors', () => {
    expect(renderToStaticMarkup(<Loading />)).toContain('role="status"')
    const html = renderToStaticMarkup(<ErrorPage reset={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Try again')
    expect(html).not.toContain('No attempts yet')
  })
})
