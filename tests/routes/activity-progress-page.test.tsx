import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'
import type { AssignmentProgressFacts } from '@/lib/assignments/progress'
import { progressFacts } from '../testing/progress'
const mock = vi.hoisted(() => ({ activities: vi.fn(), summary: vi.fn() }))
vi.mock('@/lib/server/teacher-activities', () => ({ getTeacherClassActivities: mock.activities }))
vi.mock('@/lib/server/teacher-attempts', () => ({ getTeacherActivityAttemptSummary: mock.summary }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) },
  notFound: () => { throw new Error('NOT_FOUND') },
  useRouter: () => ({ refresh: () => {} }),
}))
import Page, { generateMetadata } from '@/app/admin/classes/[classId]/activities/[assignmentId]/page'
import { StudentProgressRoster as AttemptRoster } from '@/app/admin/classes/[classId]/activities/[assignmentId]/StudentProgressRoster'
import Loading from '@/app/admin/classes/[classId]/activities/[assignmentId]/loading'
import ErrorPage from '@/app/admin/classes/[classId]/activities/[assignmentId]/error'
import NotFound from '@/app/admin/classes/[classId]/activities/[assignmentId]/not-found'
import AttemptsRedirect from '@/app/admin/classes/[classId]/attempts/page'
const report: TeacherActivityAttemptSummary = {
  classId: 'class', className: 'Chemistry', assignmentId: 'second', activityId: 'activity', activityTitle: 'Lewis diagrams',
  students: [
    { studentId: 'zero', firstName: 'Zero', lastName: 'Student', verified: false, attemptCount: 0, explorationAttemptCount: 0, quizAttemptCount: 0, completedCount: 0, inProgressCount: 0, quizStartedAt: null, progress: progressFacts(), attempts: [] },
    { studentId: 'many', firstName: 'Many', lastName: 'Student', verified: true, attemptCount: 2, explorationAttemptCount: 1, quizAttemptCount: 1, completedCount: 1, inProgressCount: 1, quizStartedAt: null, progress: progressFacts({ stage: 'exploring', passingQuizAttemptNumber: 1, passingQuizScore: 4, passingQuizTotal: 5, passingQuizPercentage: 80 }), attempts: [
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
const props = (assignmentId: string) => ({ params: Promise.resolve({ classId: 'class', assignmentId }) })
const legacy = (assignmentId?: string | string[]) => ({ params: Promise.resolve({ classId: 'class' }), searchParams: Promise.resolve({ assignmentId }) })
describe('activity student progress page', () => {
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
      quizStartedAt: '2026-09-24T12:00:00Z',
      progress: progressFacts({
        stage: 'quiz_in_progress',
        failedQuizAttemptCount: 1,
        firstQuizStartedAt: '2026-09-23T12:00:00Z',
        explorationStartedAt: '2026-09-23T11:00:00Z',
        timeToFirstQuizSeconds: 3661,
      }),
    }] }} />)

    expect(html).toContain('aria-valuetext="Taking the quiz"')
    expect(html).toContain('Quiz started; no result submitted yet.')
    expect(html).toContain('Exploration started')
    expect(html).toContain('First quiz started')
    expect(html).toContain('Latest quiz started')
    expect(html).toContain('Exploration to first quiz:</dt><dd>1h 1m')
    expect(html).toContain('Quiz:</dt><dd>In progress · 1 attempt not passed')
  })
  it('shows a single exploration figure from the saved exploration-to-first-quiz interval', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progress: progressFacts({ stage: 'completed', timeToFirstQuizSeconds: 125 }),
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
  ] as const)('renders the server-derived stage %s', (stage, label) => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progress: progressFacts({ stage }),
    }] }} />)
    expect(html).toContain(`aria-valuetext="${label}"`)
  })
  it.each([0, -1, 59, 60])('formats unusual timer values safely (%s seconds)', seconds => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progress: progressFacts({ stage: 'quiz_in_progress', timeToFirstQuizSeconds: seconds }),
    }] }} />)
    const expected = seconds <= 0 ? '0s' : seconds < 60 ? `${seconds}s` : '1m 0s'
    expect(html).toContain(`Exploration to first quiz:</dt><dd>${expected}`)
  })
  it('shows the roster for the activity in the URL, with its title and class', async () => {
    const html = renderToStaticMarkup(await Page(props('second')))
    expect(mock.activities).toHaveBeenCalledWith('class')
    expect(mock.summary).toHaveBeenCalledWith('class', 'second', { live: true })
    expect(html).toContain('<h1 class="mt-4 text-3xl font-semibold">Lewis diagrams</h1>')
    expect(html).toContain('Student progress · Chemistry')
    expect(html).toContain('href="/admin?classId=class"')
    expect(html).toContain('aria-label="Student progress for Lewis diagrams"')
  })
  it('links to every other activity in the class and marks the current one', async () => {
    const html = renderToStaticMarkup(await Page(props('second')))
    expect(html).toContain('href="/admin/classes/class/activities/first"')
    const anchor = (id: string) => html.match(new RegExp(`<a[^>]*href="/admin/classes/class/activities/${id}"[^>]*>`))?.[0] ?? ''
    expect(anchor('second')).toContain('aria-current="page"')
    expect(anchor('first')).not.toContain('aria-current')
  })
  it('summarises the class: completed out of enrolled, then the other stages', async () => {
    mock.summary.mockResolvedValue({ ...report, students: [
      { ...report.students[0], studentId: 'a', progress: progressFacts({ stage: 'completed' }) },
      { ...report.students[0], studentId: 'b', progress: progressFacts({ stage: 'needs_retry' }) },
      { ...report.students[0], studentId: 'c', progress: progressFacts() },
    ] })
    const html = renderToStaticMarkup(await Page(props('second')))
    expect(html).toContain('1 of 3</span> completed · 1 quiz not passed, needs retry · 1 not started')
  })
  it('shows 404 for an activity that is not assigned to this teacher\'s class, without reading progress', async () => {
    await expect(Page(props('foreign'))).rejects.toThrow('NOT_FOUND')
    expect(mock.summary).not.toHaveBeenCalled()
  })
  it('propagates ownership and database failures to the error boundary', async () => {
    mock.activities.mockRejectedValue(new Error('Class access denied or unavailable.'))
    await expect(Page(props('second'))).rejects.toThrow('access denied')
    mock.activities.mockResolvedValue({ id: 'class', name: 'Chemistry', assignments: [{ id: 'second', title: 'Lewis diagrams' }] })
    mock.summary.mockRejectedValue(new Error('unavailable'))
    await expect(Page(props('second'))).rejects.toThrow('unavailable')
  })
  it('distinguishes a class with no students from a load failure', async () => {
    mock.summary.mockResolvedValue({ ...report, students: [] })
    const html = renderToStaticMarkup(await Page(props('second')))
    expect(html).toContain('No students enrolled yet.')
    expect(html).toContain('No students enrolled in this class yet.')
  })
  it('names the activity in the browser tab, falling back when it cannot be read', async () => {
    expect(await generateMetadata(props('second'))).toEqual({ title: 'Lewis diagrams · Student progress | ChemClicks' })
    expect(await generateMetadata(props('foreign'))).toEqual({ title: 'Student progress | ChemClicks' })
    mock.activities.mockRejectedValue(new Error('private details'))
    expect(await generateMetadata(props('second'))).toEqual({ title: 'Student progress | ChemClicks' })
  })
  it('redirects the old attempts URL to the matching activity page', async () => {
    await expect(AttemptsRedirect(legacy('second'))).rejects.toThrow('REDIRECT:/admin/classes/class/activities/second')
    await expect(AttemptsRedirect(legacy(['second', 'x']))).rejects.toThrow('REDIRECT:/admin/classes/class/activities/second')
    await expect(AttemptsRedirect(legacy('a/../b'))).rejects.toThrow('REDIRECT:/admin/classes/class/activities/a%2F..%2Fb')
    expect(mock.activities).not.toHaveBeenCalled()
  })
  it('sends an old attempts URL without an activity to the first one, or back to the class', async () => {
    await expect(AttemptsRedirect(legacy())).rejects.toThrow('REDIRECT:/admin/classes/class/activities/first')
    mock.activities.mockResolvedValue({ id: 'class', name: 'Chemistry', assignments: [] })
    await expect(AttemptsRedirect(legacy())).rejects.toThrow('REDIRECT:/admin?classId=class')
  })
  it('renders an empty roster message', () => {
    expect(renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [] }} />)).toContain('No students enrolled')
  })
  it('shows the unified status for each student instead of just raw counts', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={report} />)
    expect(html).toContain('Not started')
    expect(html).toContain('Started the assignment')
  })
  it('says when history is unknown instead of fabricating times', () => {
    const student = (overrides: Partial<AssignmentProgressFacts>) => ({
      ...report.students[0], progress: progressFacts(overrides),
    })
    const notStarted = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({})] }} />)
    expect(notStarted).toContain('Exploration started:</dt><dd>Not started')
    expect(notStarted).not.toContain('Exploration to first quiz')
    const exploring = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({
      stage: 'exploring', explorationStartedAt: null,
    })] }} />)
    expect(exploring).toContain('Start time not recorded')
    expect(exploring).toContain('Exploration to first quiz:</dt><dd>Quiz not started')
    const historical = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({
      stage: 'completed', passingQuizAttemptNumber: 1, passingQuizScore: 11, passingQuizTotal: 12,
      passingQuizPercentage: 91.67, completedAt: null,
    })] }} />)
    expect(historical).toContain('Exploration to first quiz:</dt><dd>Not recorded')
    expect(historical).toContain('Completed:</dt><dd>Time not recorded')
  })
  it('shows the completion time from the saved record', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progress: progressFacts({ stage: 'completed', completedAt: '2026-09-25T08:30:00Z' }),
    }] }} />)
    expect(html).toContain('dateTime="2026-09-25T08:30:00Z"')
  })
  it('shows the passing quiz attempt distinctly from a not-yet-passed failed-attempt count', () => {
    const student = (overrides: Partial<AssignmentProgressFacts>) => ({
      ...report.students[0], progress: progressFacts(overrides),
    })
    const needsRetry = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({
      stage: 'needs_retry', failedQuizAttemptCount: 2,
    })] }} />)
    expect(needsRetry).toContain('Not passed yet · 2 attempts submitted')
    expect(needsRetry).not.toContain('Completed')
    const passed = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [student({
      stage: 'completed', passingQuizAttemptNumber: 2, passingQuizScore: 10, passingQuizTotal: 12,
      passingQuizPercentage: 83.33, completedAt: '2026-09-23T12:05:00Z', failedQuizAttemptCount: 1,
    })] }} />)
    expect(passed).toContain('Passed on attempt 2: 10/12 (83.33%)')
  })
  it('does not show a pass or score for a student with no submitted quiz', () => {
    const html = renderToStaticMarkup(<AttemptRoster summary={{ ...report, students: [{
      ...report.students[0], progress: progressFacts({ stage: 'explored' }),
    }] }} />)
    expect(html).toContain('Quiz:</dt><dd>Not started')
    expect(html).not.toMatch(/\d+\/\d+/)
  })
  it('provides accessible loading, retry and not-found states without showing raw errors', () => {
    expect(renderToStaticMarkup(<NotFound />)).toContain('Activity not found')
    expect(renderToStaticMarkup(<Loading />)).toContain('role="status"')
    const html = renderToStaticMarkup(<ErrorPage reset={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Try again')
    expect(html).not.toContain('No attempts yet')
  })
})
