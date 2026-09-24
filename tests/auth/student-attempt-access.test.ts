import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth/student-session', () => ({ getStudentSession: mocks.session }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }))
import { createStudentAttempt, readStudentAttempts } from '@/lib/server/student-attempts'
const progress = '11111111-1111-1111-1111-111111111111'
beforeEach(() => { vi.clearAllMocks() })
describe('student attempt server boundary', () => {
  it('rejects a missing session before database access', async () => {
    mocks.session.mockResolvedValue(null)
    await expect(readStudentAttempts(progress)).rejects.toThrow('session')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('uses session identity rather than caller ownership and forwards only allowed inputs', async () => {
    mocks.session.mockResolvedValue({ studentId: 'student', classId: 'class' })
    mocks.rpc.mockResolvedValue({ data: [{ id: 'attempt' }], error: null })
    expect(await createStudentAttempt(progress)).toEqual({ id: 'attempt' })
    expect(mocks.rpc).toHaveBeenCalledWith('student_attempt_access', {
      p_student_id: 'student', p_class_id: 'class', p_progress_id: progress, p_create: true,
    })
  })
  it('propagates authorization/database failures rather than returning an empty history', async () => {
    mocks.session.mockResolvedValue({ studentId: 'student', classId: 'class' })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(readStudentAttempts(progress)).rejects.toThrow('denied or unavailable')
  })
  it('rejects malformed progress identifiers', async () => {
    mocks.session.mockResolvedValue({ studentId: 'student', classId: 'class' })
    await expect(readStudentAttempts('invalid')).rejects.toThrow('Invalid progress')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
