import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ teacher: vi.fn(), client: vi.fn(), from: vi.fn(), update: vi.fn(), delete: vi.fn(), eq: vi.fn(), select: vi.fn() }))
vi.mock('@/lib/server/teacher', () => ({ requireTeacherId: mock.teacher }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: mock.client }))
import { disableOwnedClass } from '@/lib/server/classes'
const classId = '11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  vi.resetAllMocks()
  mock.teacher.mockResolvedValue('teacher-a')
  const query = { update: mock.update, delete: mock.delete, eq: mock.eq, select: mock.select }
  mock.client.mockReturnValue({ from: mock.from })
  mock.from.mockReturnValue(query)
  mock.update.mockReturnValue(query)
  mock.eq.mockReturnValue(query)
  mock.select.mockResolvedValue({ data: [{ id: classId }], error: null })
})
describe('class disabling server authorization', () => {
  it('updates only the active flag on the authenticated teacher’s requested class', async () => {
    await disableOwnedClass(classId)
    expect(mock.from.mock.calls).toEqual([['classes']])
    expect(mock.update).toHaveBeenCalledExactlyOnceWith({ is_active: false })
    expect(mock.eq.mock.calls).toEqual([['id', classId], ['teacher_id', 'teacher-a'], ['is_active', true]])
    expect(mock.select).toHaveBeenCalledWith('id')
    expect(mock.delete).not.toHaveBeenCalled()
  })
  it.each([
    { data: [], error: null },
    { data: null, error: null },
    { data: [{ id: classId }], error: { message: 'private database error' } },
  ])('rejects foreign, disabled, missing classes or database failures (%j)', async result => {
    mock.select.mockResolvedValue(result)
    await expect(disableOwnedClass(classId)).rejects.toThrow('could not be disabled')
    expect(mock.delete).not.toHaveBeenCalled()
  })
  it('does not obtain privileged credentials without teacher authorization', async () => {
    mock.teacher.mockRejectedValue(new Error('Unauthorized'))
    await expect(disableOwnedClass(classId)).rejects.toThrow('Unauthorized')
    expect(mock.client).not.toHaveBeenCalled()
    expect(mock.update).not.toHaveBeenCalled()
  })
  it.each(['', 'class-a', '11111111-1111-4111-8111-111111111111 or true'])('rejects invalid class IDs (%s) before access', async id => {
    await expect(disableOwnedClass(id)).rejects.toThrow('Invalid class')
    expect(mock.teacher).not.toHaveBeenCalled()
    expect(mock.client).not.toHaveBeenCalled()
  })
})
