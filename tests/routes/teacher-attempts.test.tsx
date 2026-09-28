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
    { studentId: 'zero', firstName: 'Zero', lastName: 'Student', verified: false, attemptCount: 0, completedCount: 0, inProgressCount: 0, attempts: [] },
    { studentId: 'many', firstName: 'Many', lastName: 'Student', verified: true, attemptCount: 2, completedCount: 1, inProgressCount: 1, attempts: [
      { id: 'two', attemptNumber: 2, status: 'in_progress', startedAt: '2026-09-24T12:00:00Z', completedAt: null },
      { id: 'one', attemptNumber: 1, status: 'completed', startedAt: '2026-09-23T12:00:00Z', completedAt: '2026-09-23T12:05:00Z' },
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
    for (const text of ['0 attempts', 'No attempts yet.', '2 attempts', '1 completed', '1 in progress', 'Not completed', 'Sep 23, 2026', 'UTC', '<details ', 'dateTime="2026-09-23T12:05:00Z"']) expect(html).toContain(text)
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
  it('provides accessible loading and retry states without showing raw errors', () => {
    expect(renderToStaticMarkup(<Loading />)).toContain('role="status"')
    const html = renderToStaticMarkup(<ErrorPage reset={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Try again')
    expect(html).not.toContain('No attempts yet')
  })
})
