import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), insert: vi.fn() }))
vi.mock('@/lib/server/database', () => ({ createServiceClient: () => ({ from: mock.from }) }))
import { signupStudent } from '@/app/create-account/student/actions'
const input = { firstName: ' Test ', lastName: ' Student ', studentID: ' DEMO1 ', code: ' abc123 ' }
beforeEach(() => {
  vi.resetAllMocks()
  const chain = { select: mock.select, eq: mock.eq, maybeSingle: mock.maybeSingle, insert: mock.insert }
  mock.from.mockReturnValue(chain); mock.select.mockReturnValue(chain); mock.eq.mockReturnValue(chain)
  mock.maybeSingle.mockResolvedValue({ data: { id: 'resolved-class', is_active: true }, error: null })
  mock.insert.mockResolvedValue({ error: null })
})
it('derives enrollment from the code and cannot accept approval or class overrides', async () => {
  expect(await signupStudent({ ...input, verified: true, class_id: 'foreign' })).toEqual({ ok: true })
  expect(mock.eq).toHaveBeenCalledWith('class_code', 'ABC123')
  expect(mock.insert).toHaveBeenCalledWith({ class_id: 'resolved-class', first_name: 'Test', last_name: 'Student', student_id: 'DEMO1', verified: false })
})
it.each([null, {}, { ...input, firstName: 1 }, { ...input, studentID: ' ' }])('rejects malformed input before database access', async value => {
  expect((await signupStudent(value)).ok).toBe(false)
  expect(mock.from).not.toHaveBeenCalled()
})
it.each([null, { id: 'class', is_active: false }])('rejects missing or inactive classes', async data => {
  mock.maybeSingle.mockResolvedValue({ data, error: null })
  expect((await signupStudent(input)).ok).toBe(false)
  expect(mock.insert).not.toHaveBeenCalled()
})
it('handles duplicate IDs without altering an existing student', async () => {
  mock.insert.mockResolvedValue({ error: { code: '23505' } })
  expect(await signupStudent(input)).toEqual({ ok: false, message: expect.stringContaining('already registered') })
})
it('does not expose database errors', async () => {
  mock.maybeSingle.mockResolvedValue({ data: null, error: { message: 'private database details' } })
  expect(await signupStudent(input)).toEqual({ ok: false, message: 'Unable to create your account. Please try again.' })
  expect(mock.insert).not.toHaveBeenCalled()
})
it('handles unavailable credentials or network failure', async () => {
  mock.from.mockImplementation(() => { throw new Error('secret') })
  expect((await signupStudent(input)).ok).toBe(false)
})
