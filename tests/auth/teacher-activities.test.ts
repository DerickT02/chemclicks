import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ teacher: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), order: vi.fn() }))
vi.mock('@/lib/server/teacher', () => ({ requireTeacherId: mock.teacher }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: mock.from }) }))
import { getTeacherClassActivities } from '@/lib/server/teacher-activities'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  vi.resetAllMocks()
  mock.teacher.mockResolvedValue('teacher')
  const chain = { select: mock.select, eq: mock.eq, maybeSingle: mock.maybeSingle, order: mock.order }
  mock.from.mockReturnValue(chain); mock.select.mockReturnValue(chain); mock.eq.mockReturnValue(chain)
  mock.maybeSingle.mockResolvedValue({ data: { id, name: 'Chemistry' }, error: null })
  mock.order.mockResolvedValue({ data: [{ id: 'assignment', activities: { title: 'Lewis' } }], error: null })
})
it('scopes the class to the verified teacher before loading its assignments', async () => {
  expect((await getTeacherClassActivities(id)).assignments).toEqual([{ id: 'assignment', title: 'Lewis' }])
  expect(mock.eq.mock.calls).toEqual([['id', id], ['teacher_id', 'teacher'], ['class_id', id]])
})
it('rejects a foreign or unavailable class before querying assignments', async () => {
  mock.maybeSingle.mockResolvedValue({ data: null, error: null })
  await expect(getTeacherClassActivities(id)).rejects.toThrow('access denied')
  expect(mock.from).toHaveBeenCalledTimes(1)
})
it('rejects unauthorized sessions before database access', async () => {
  mock.teacher.mockRejectedValue(new Error('Unauthorized'))
  await expect(getTeacherClassActivities(id)).rejects.toThrow('Unauthorized')
  expect(mock.from).not.toHaveBeenCalled()
})
it('does not present database failure as no assignments', async () => {
  mock.order.mockResolvedValue({ data: null, error: { message: 'failed' } })
  await expect(getTeacherClassActivities(id)).rejects.toThrow('could not be loaded')
})
