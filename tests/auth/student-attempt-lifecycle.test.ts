import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth/student-session', () => ({ getStudentSession: mocks.session }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }))
import { transitionStudentAttempt } from '@/lib/server/student-assignments'
import { assignmentIsOpen, isSupportedExploration } from '@/lib/activities/availability'
const assignment = '11111111-1111-1111-1111-111111111111'
const attempt = '22222222-2222-2222-2222-222222222222'
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ studentId: 'student', classId: 'class' }) })
describe('attempt lifecycle boundary', () => {
  it('uses verified session identity and does not accept scores or timestamps', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: attempt }], error: null })
    expect(await transitionStudentAttempt(assignment, 'complete', attempt)).toEqual({ id: attempt })
    expect(mocks.rpc).toHaveBeenCalledWith('student_attempt_transition', {
      p_student_id: 'student', p_class_id: 'class', p_assignment_id: assignment,
      p_action: 'complete', p_attempt_id: attempt,
    })
  })
  it('rejects an expired or missing session before database access', async () => {
    mocks.session.mockResolvedValue(null)
    await expect(transitionStudentAttempt(assignment, 'start')).rejects.toThrow('sign in')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('requires an attempt ID for completion and retry', async () => {
    await expect(transitionStudentAttempt(assignment, 'complete')).rejects.toThrow('Invalid')
    await expect(transitionStudentAttempt(assignment, 'retry')).rejects.toThrow('Invalid')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('reports database failure without claiming completion', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(transitionStudentAttempt(assignment, 'start')).rejects.toThrow('Could not save')
  })
  it('matches the inclusive open and exclusive close boundaries', () => {
    expect(assignmentIsOpen(null, null, 1000)).toBe(true)
    expect(assignmentIsOpen(new Date(1000).toISOString(), new Date(2000).toISOString(), 1000)).toBe(true)
    expect(assignmentIsOpen(null, new Date(1000).toISOString(), 1000)).toBe(false)
    expect(assignmentIsOpen(new Date(2000).toISOString(), null, 1000)).toBe(false)
  })
  it('only offers existing explorations with matching precision', () => {
    expect(isSupportedExploration('lewis_diagram')).toBe(true)
    expect(isSupportedExploration('measurement_ruler_hundredths')).toBe(true)
    expect(isSupportedExploration('measurement_graduated_cylinder')).toBe(true)
    expect(isSupportedExploration('measurement_ruler_tenths')).toBe(false)
    expect(isSupportedExploration('lewis_structures_ionic')).toBe(false)
  })
})
