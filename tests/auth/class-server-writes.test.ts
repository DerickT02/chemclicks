import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ teacher: vi.fn(), from: vi.fn(), delete: vi.fn(), eq: vi.fn(), select: vi.fn() }))
vi.mock('@/lib/server/teacher', () => ({ requireTeacherId: mock.teacher }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: () => ({ from: mock.from }) }))
import { deleteOwnedClass } from '@/lib/server/classes'
beforeEach(() => {
  vi.clearAllMocks()
  mock.teacher.mockResolvedValue('teacher-a')
  mock.from.mockReturnValue({ delete: mock.delete })
  mock.delete.mockReturnValue({ eq: mock.eq })
  mock.eq.mockReturnValue({ eq: mock.eq, select: mock.select })
})
describe('class deletion server authorization', () => {
  it('scopes the delete to the authenticated teacher and requested class', async () => {
    mock.select.mockResolvedValue({ data: [{ id: 'class-a' }], error: null })
    await deleteOwnedClass('class-a')
    expect(mock.eq.mock.calls).toEqual([['id', 'class-a'], ['teacher_id', 'teacher-a']])
  })
  it('rejects unauthorized or nonexistent classes', async () => {
    mock.select.mockResolvedValue({ data: [], error: null })
    await expect(deleteOwnedClass('class-b')).rejects.toThrow('could not be removed')
  })
  it('does not query with privileged credentials without teacher authorization', async () => {
    mock.teacher.mockRejectedValue(new Error('Unauthorized'))
    await expect(deleteOwnedClass('class-a')).rejects.toThrow('Unauthorized')
    expect(mock.from).not.toHaveBeenCalled()
  })
})
