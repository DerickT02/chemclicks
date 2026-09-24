import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn(), select: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mock.getUser }, from: mock.from }) }))
import { requireTeacherId } from '@/lib/server/teacher'
beforeEach(() => {
  vi.clearAllMocks()
  mock.from.mockReturnValue({ select: mock.select })
  mock.select.mockReturnValue({ eq: mock.eq })
  mock.eq.mockReturnValue({ maybeSingle: mock.maybeSingle })
})
describe('server teacher authorization', () => {
  it.each([null, { id: 'teacher' }, { id: 'teacher', email_confirmed_at: 'now', is_anonymous: true }])('rejects invalid identity %j', async user => {
    mock.getUser.mockResolvedValue({ data: { user }, error: null })
    await expect(requireTeacherId()).rejects.toThrow('verified teacher')
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('rejects a verified user without an approved teacher record', async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: 'teacher', email_confirmed_at: 'now' } }, error: null })
    mock.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(requireTeacherId()).rejects.toThrow('approved teacher')
  })
  it('returns only the verified Auth identity after checking teacher approval', async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: 'teacher', email_confirmed_at: 'now' } }, error: null })
    mock.maybeSingle.mockResolvedValue({ data: { id: 'teacher' }, error: null })
    expect(await requireTeacherId()).toBe('teacher')
    expect(mock.eq).toHaveBeenCalledWith('id', 'teacher')
  })
})
