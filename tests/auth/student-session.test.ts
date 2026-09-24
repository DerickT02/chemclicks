import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const cookie = vi.hoisted(() => ({ value: '' }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: cookie.value }) }) }))
import { getStudentSession } from '@/lib/auth/student-session'
const secret = 'test-secret-for-session-validation-only'
const valid = { studentId: '11111111-1111-1111-1111-111111111111', classId: '22222222-2222-2222-2222-222222222222', expiresAt: Date.now() + 60000 }
function sign(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}
beforeEach(() => { vi.stubEnv('STUDENT_SESSION_SECRET', secret); cookie.value = '' })
afterEach(() => vi.unstubAllEnvs())
describe('student session validation', () => {
  it('accepts a correctly signed, unexpired session', async () => {
    cookie.value = sign(valid)
    expect(await getStudentSession()).toEqual(valid)
  })
  it.each([null, {}, { ...valid, expiresAt: 'never' }, { ...valid, expiresAt: 1 }, { ...valid, studentId: 123 }])('rejects invalid signed payload %j', async payload => {
    cookie.value = sign(payload)
    expect(await getStudentSession()).toBeNull()
  })
  it('rejects tampering and extra token segments', async () => {
    cookie.value = sign(valid) + 'x'
    expect(await getStudentSession()).toBeNull()
    cookie.value = sign(valid) + '.extra'
    expect(await getStudentSession()).toBeNull()
  })
})
