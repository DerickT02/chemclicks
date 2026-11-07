import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ teacher: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }))
vi.mock('@/lib/server/teacher', () => ({ requireTeacherId: mock.teacher }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: () => ({ rpc: mock.rpc, from: mock.from }) }))
import { getTeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'
import { progressFacts } from '../testing/progress'
const classId = '11111111-1111-4111-8111-111111111111'
const assignmentId = '22222222-2222-4222-8222-222222222222'
beforeEach(() => {
  vi.resetAllMocks()
  mock.teacher.mockResolvedValue('session-teacher')
  const query = { select: mock.select, eq: mock.eq, maybeSingle: mock.maybeSingle }
  mock.from.mockReturnValue(query)
  mock.select.mockReturnValue(query)
  mock.eq.mockReturnValue(query)
  mock.maybeSingle.mockResolvedValue({ data: { id: classId }, error: null })
})
describe('teacher attempt summary server boundary', () => {
  it('uses the verified session identity and preserves an empty roster', async () => {
    const data = { classId, assignmentId, students: [] }
    mock.rpc.mockResolvedValue({ data, error: null })
    expect(await getTeacherActivityAttemptSummary(classId, assignmentId)).toEqual(data)
    expect(mock.from).toHaveBeenCalledWith('classes')
    expect(mock.eq.mock.calls).toEqual([['id', classId], ['teacher_id', 'session-teacher'], ['is_active', true]])
    expect(mock.rpc).toHaveBeenCalledWith('teacher_activity_attempt_summary', {
      p_teacher_id: 'session-teacher', p_class_id: classId, p_assignment_id: assignmentId,
    })
  })
  it('uses a lightweight RPC for live overviews, and scopes expanded history to one student', async () => {
    mock.rpc.mockResolvedValue({ data: { students: [] }, error: null })
    await getTeacherActivityAttemptSummary(classId, assignmentId, { live: true })
    expect(mock.rpc).toHaveBeenLastCalledWith('teacher_activity_live_summary', {
      p_teacher_id: 'session-teacher', p_class_id: classId, p_assignment_id: assignmentId,
      p_include_attempts: false, p_student_id: null,
    })
    const studentId = '33333333-3333-4333-8333-333333333333'
    await getTeacherActivityAttemptSummary(classId, assignmentId, { live: true, studentId })
    expect(mock.rpc).toHaveBeenLastCalledWith('teacher_activity_live_summary', {
      p_teacher_id: 'session-teacher', p_class_id: classId, p_assignment_id: assignmentId,
      p_include_attempts: true, p_student_id: studentId,
    })
    await expect(getTeacherActivityAttemptSummary(classId, assignmentId, { live: true, studentId: 'invalid' })).rejects.toThrow('Invalid')
    expect(mock.rpc).toHaveBeenCalledTimes(2)
  })
  it('falls back to the full report when the live RPC is not migrated, keeping only the requested student', async () => {
    const studentId = '33333333-3333-4333-8333-333333333333'
    const row = (id: string) => ({ studentId: id, overallStatus: 'exploring', attempts: [] })
    mock.rpc
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } })
      .mockResolvedValueOnce({ data: { students: [row(studentId), row('other')] }, error: null })
    const result = await getTeacherActivityAttemptSummary(classId, assignmentId, { live: true, studentId })
    expect(mock.rpc).toHaveBeenLastCalledWith('teacher_activity_attempt_summary', {
      p_teacher_id: 'session-teacher', p_class_id: classId, p_assignment_id: assignmentId,
    })
    expect(result.students.map(student => student.studentId)).toEqual([studentId])
  })
  it('does not fall back on other live RPC errors', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private details' } })
    await expect(getTeacherActivityAttemptSummary(classId, assignmentId, { live: true })).rejects.toThrow('denied')
    expect(mock.rpc).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['not_started', 'not_started'],
    ['exploring', 'exploring'],
    ['taking_quiz', 'quiz_in_progress'],
    ['needs_retry', 'needs_retry'],
    ['completed', 'completed'],
  ] as const)('normalizes legacy report status %s at the boundary', async (overallStatus, stage) => {
    mock.rpc.mockResolvedValue({ data: { classId, assignmentId, students: [{
      studentId: 'student', firstName: 'Alex', lastName: 'Student', verified: true,
      attemptCount: 0, completedCount: 0, inProgressCount: 0, overallStatus,
      explorationDurationSeconds: 900, attempts: [],
    }] }, error: null })
    const result = await getTeacherActivityAttemptSummary(classId, assignmentId)
    expect(result.students[0]).toEqual({
      studentId: 'student', firstName: 'Alex', lastName: 'Student', verified: true,
      attemptCount: 0, completedCount: 0, inProgressCount: 0, attempts: [],
      explorationAttemptCount: 0, quizAttemptCount: 0, quizStartedAt: null,
      // The old explorationDurationSeconds included quiz time; never use it as the interval.
      progress: progressFacts({ stage }),
    })
  })
  it('normalizes modern facts, preserving explicit null completion and zero counts', async () => {
    const facts = progressFacts({ stage: 'explored', timeToFirstQuizSeconds: 0, completedAt: null })
    mock.rpc.mockResolvedValue({ data: { students: [{
      ...facts, stage: 'Exploring', progressStage: 'explored', overallStatus: 'completed',
      passingQuizCompletedAt: '2026-09-23T12:05:00Z',
      explorationAttemptCount: 0, quizAttemptCount: 0, attempts: [{ quizKey: 'bohr_models' }],
    }] }, error: null })
    const result = await getTeacherActivityAttemptSummary(classId, assignmentId)
    expect(result.students[0].progress).toEqual(facts)
    expect(result.students[0].quizAttemptCount).toBe(0)
  })
  it('orders history by start time across quiz keys without mutating the RPC response', async () => {
    const attempts = Object.freeze([
      { id: 'legacy', attemptNumber: 8, quizKey: 'bohr_models', startedAt: '2026-09-23T12:00:00Z' },
      { id: 'split', attemptNumber: 1, quizKey: 'bohr_model_intro', startedAt: '2026-09-24T12:00:00Z' },
      { id: 'exploration', attemptNumber: 9, quizKey: null, startedAt: '2026-09-22T12:00:00Z' },
    ])
    mock.rpc.mockResolvedValue({ data: { students: [{ overallStatus: 'needs_retry', attempts }] }, error: null })
    const result = await getTeacherActivityAttemptSummary(classId, assignmentId)
    expect(result.students[0].attempts.map(attempt => attempt.id)).toEqual(['split', 'legacy', 'exploration'])
    expect(attempts.map(attempt => attempt.id)).toEqual(['legacy', 'split', 'exploration'])
  })
  it('preserves the legacy passing timestamp and derives missing attempt counts once', async () => {
    const completedAt = '2026-09-23T12:05:00Z'
    mock.rpc.mockResolvedValue({ data: { students: [{
      overallStatus: 'completed', passingQuizCompletedAt: completedAt,
      attempts: [{ kind: 'exploration' }, { quizKey: null }, { kind: 'quiz' }, { quizKey: 'bohr_models' }],
    }] }, error: null })
    const result = await getTeacherActivityAttemptSummary(classId, assignmentId)
    expect(result.students[0].progress.completedAt).toBe(completedAt)
    expect(result.students[0].explorationAttemptCount).toBe(2)
    expect(result.students[0].quizAttemptCount).toBe(2)
  })
  it('lists attempts without a readable start time last', async () => {
    mock.rpc.mockResolvedValue({ data: { students: [{ overallStatus: 'needs_retry', attempts: [
      { id: 'unknown', startedAt: null },
      { id: 'older', startedAt: '2026-09-22T12:00:00Z' },
      { id: 'invalid', startedAt: 'not a date' },
      { id: 'newer', startedAt: '2026-09-24T12:00:00Z' },
    ] }] }, error: null })
    const result = await getTeacherActivityAttemptSummary(classId, assignmentId)
    expect(result.students[0].attempts.map(attempt => attempt.id)).toEqual(['newer', 'older', 'unknown', 'invalid'])
  })
  it.each([{ data: null, error: null }, { data: { id: classId }, error: { message: 'private details' } }])('blocks foreign, disabled or unavailable class reports before the RPC (%j)', async result => {
    mock.maybeSingle.mockResolvedValue(result)
    await expect(getTeacherActivityAttemptSummary(classId, assignmentId)).rejects.toThrow('Class access denied or unavailable')
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('does not query when authorization fails', async () => {
    mock.teacher.mockRejectedValue(new Error('A verified teacher session is required.'))
    await expect(getTeacherActivityAttemptSummary(classId, assignmentId)).rejects.toThrow('verified teacher')
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it.each([['bad', assignmentId], [classId, 'bad']])('rejects invalid identifiers', async (c, a) => {
    await expect(getTeacherActivityAttemptSummary(c, a)).rejects.toThrow('Invalid class or assignment')
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it.each([{ data: null, error: null }, { data: null, error: { message: 'database details' } }])('surfaces failed reads instead of reporting zero', async result => {
    mock.rpc.mockResolvedValue(result)
    await expect(getTeacherActivityAttemptSummary(classId, assignmentId)).rejects.toThrow('access denied or unavailable')
  })
})
