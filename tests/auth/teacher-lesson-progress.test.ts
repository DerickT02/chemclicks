import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ teacher: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/server/teacher', () => ({ requireTeacherId: mock.teacher }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: () => ({ rpc: mock.rpc }) }))
import { getTeacherClassLessonProgress } from '@/lib/server/teacher-lesson-progress'
import { progressFacts } from '../testing/progress'
const classId = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { vi.resetAllMocks(); mock.teacher.mockResolvedValue('session-teacher') })
describe('teacher lesson progress server boundary', () => {
  it('uses the verified session identity and preserves an empty roster', async () => {
    const data = { classId, className: 'Chemistry', students: [] }
    mock.rpc.mockResolvedValue({ data, error: null })
    expect(await getTeacherClassLessonProgress(classId)).toEqual(data)
    expect(mock.rpc).toHaveBeenCalledWith('teacher_class_lesson_progress', {
      p_teacher_id: 'session-teacher', p_class_id: classId,
    })
  })
  it.each([
    ['not_started', 'not_started'],
    ['in_progress', 'exploring'],
    ['completed', 'completed'],
  ] as const)('normalizes legacy lesson status %s before returning to the UI', async (status, stage) => {
    const lesson = { assignmentId: 'assignment', activityId: 'activity', activityTitle: 'Bohr', status }
    mock.rpc.mockResolvedValue({ data: { classId, students: [{ studentId: 'student', lessons: [lesson] }] }, error: null })
    const result = await getTeacherClassLessonProgress(classId)
    expect(result.students[0].lessons).toEqual([{
      assignmentId: 'assignment', activityId: 'activity', activityTitle: 'Bohr', progress: progressFacts({ stage }),
    }])
  })
  it('preserves modern lesson facts and keeps the explicit stage instead of the raw exploration status', async () => {
    const facts = progressFacts({ stage: 'quiz_in_progress', timeToFirstQuizSeconds: 0, failedQuizAttemptCount: 2 })
    mock.rpc.mockResolvedValue({ data: { classId, students: [{ lessons: [{
      assignmentId: 'assignment', activityId: 'activity', activityTitle: 'Bohr', status: 'completed', ...facts,
    }] }] }, error: null })
    const result = await getTeacherClassLessonProgress(classId)
    expect(result.students[0].lessons[0].progress).toEqual(facts)
  })
  it('does not query when authorization fails', async () => {
    mock.teacher.mockRejectedValue(new Error('A verified teacher session is required.'))
    await expect(getTeacherClassLessonProgress(classId)).rejects.toThrow('verified teacher')
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('rejects an invalid class id before querying', async () => {
    await expect(getTeacherClassLessonProgress('not-a-uuid')).rejects.toThrow('Invalid class')
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it.each([{ data: null, error: null }, { data: null, error: { message: 'database details' } }])('surfaces failed reads instead of reporting zero', async result => {
    mock.rpc.mockResolvedValue(result)
    await expect(getTeacherClassLessonProgress(classId)).rejects.toThrow('access denied or unavailable')
  })
})
