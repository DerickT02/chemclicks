import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ teacher: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/server/teacher', () => ({ requireTeacherId: mock.teacher }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: () => ({ rpc: mock.rpc }) }))
import { getTeacherActivityAttemptSummary } from '@/lib/server/teacher-attempts'
const classId = '11111111-1111-4111-8111-111111111111'
const assignmentId = '22222222-2222-4222-8222-222222222222'
beforeEach(() => { vi.resetAllMocks(); mock.teacher.mockResolvedValue('session-teacher') })
describe('teacher attempt summary server boundary', () => {
  it('uses the verified session identity and preserves an empty roster', async () => {
    const data = { classId, assignmentId, students: [] }
    mock.rpc.mockResolvedValue({ data, error: null })
    expect(await getTeacherActivityAttemptSummary(classId, assignmentId)).toEqual(data)
    expect(mock.rpc).toHaveBeenCalledWith('teacher_activity_attempt_summary', {
      p_teacher_id: 'session-teacher', p_class_id: classId, p_assignment_id: assignmentId,
    })
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
