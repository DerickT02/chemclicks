import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ approve: vi.fn(), approveAll: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/server/student-roster', () => ({ approveOwnedStudent: mocks.approve, approveOwnedStudents: mocks.approveAll }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
import { approveStudent } from '@/app/admin/classes/roster-actions'
const initial = { status: 'idle' as const, message: '' }
function form() {
  const data = new FormData()
  data.set('class_id', 'class')
  data.set('student_id', 'student')
  return data
}
beforeEach(() => { vi.resetAllMocks() })
it('revalidates only after a confirmed save', async () => {
  expect((await approveStudent(initial, form())).status).toBe('success')
  expect(mocks.approve).toHaveBeenCalledExactlyOnceWith('class', 'student')
  expect(mocks.revalidate).toHaveBeenCalledWith('/admin')
  expect(mocks.approve.mock.invocationCallOrder[0]).toBeLessThan(mocks.revalidate.mock.invocationCallOrder[0])
})
it('never reports success for denied or failed saves and permits safe retry', async () => {
  mocks.approve.mockRejectedValueOnce(new Error('private database details'))
  expect(await approveStudent(initial, form())).toEqual({ status: 'error', message: expect.stringContaining('Refresh the roster and try again') })
  expect(mocks.revalidate).not.toHaveBeenCalled()
  expect((await approveStudent(initial, form())).status).toBe('success')
})
it('rejects missing inputs without invoking a mutation', async () => {
  expect((await approveStudent(initial, new FormData())).status).toBe('error')
  expect(mocks.approve).not.toHaveBeenCalled()
})
it('approves all listed pending students and reports the count', async () => {
  mocks.approveAll.mockResolvedValue(2)
  const data = form()
  data.set('intent', 'approve_all')
  data.append('pending_id', 'first')
  data.append('pending_id', 'second')
  expect(await approveStudent(initial, data)).toEqual({ status: 'success', message: '2 students approved. They can now sign in.' })
  expect(mocks.approveAll).toHaveBeenCalledExactlyOnceWith('class', ['first', 'second'])
  expect(mocks.approve).not.toHaveBeenCalled()
  expect(mocks.revalidate).toHaveBeenCalledWith('/admin')
})
it('reports failed bulk approvals without success or revalidation', async () => {
  mocks.approveAll.mockRejectedValue(new Error('private database details'))
  const data = form()
  data.set('intent', 'approve_all')
  data.append('pending_id', 'first')
  expect(await approveStudent(initial, data)).toEqual({ status: 'error', message: expect.not.stringContaining('private') })
  expect(mocks.revalidate).not.toHaveBeenCalled()
  const empty = form()
  empty.set('intent', 'approve_all')
  expect((await approveStudent(initial, empty)).status).toBe('error')
  expect(mocks.approveAll).toHaveBeenCalledTimes(1)
})
