// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ approve: vi.fn() }))
vi.mock('@/app/admin/classes/roster-actions', () => ({ approveStudent: mocks.approve }))
import StudentRoster from '@/app/admin/classes/StudentRoster'
const student = { id: 'student', first_name: 'Alex', last_name: 'Waiting', student_id: 'TEST1', verified: false }
const roster = { pending: [student], active: [] }
beforeEach(() => { vi.resetAllMocks() })
afterEach(cleanup)

it('shows separately labelled lists, accessible columns, counts and empty states', () => {
  render(<StudentRoster classId="class" roster={roster} />)
  const pending = within(screen.getByRole('region', { name: 'Pending students' }))
  expect(pending.getByRole('heading', { name: 'Pending (1)' })).toBeInTheDocument()
  for (const name of ['First name', 'Last name', 'Student ID']) expect(pending.getByRole('columnheader', { name })).toBeInTheDocument()
  expect(pending.getByRole('cell', { name: 'TEST1' })).toBeInTheDocument()
  const active = within(screen.getByRole('region', { name: 'Active students' }))
  expect(active.getByText('No active students.')).toBeInTheDocument()
  expect(active.queryByText('TEST1')).not.toBeInTheDocument()
})

it('submits approval from the keyboard, locks saving, and only moves rows when server data changes', async () => {
  const user = userEvent.setup()
  let finish!: (value: { status: 'success'; message: string }) => void
  mocks.approve.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { rerender } = render(<StudentRoster classId="class" roster={roster} />)
  await user.tab()
  expect(screen.getByRole('button', { name: 'Approve Alex Waiting, Student ID TEST1' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('button')).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Saving approval…')
  expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true')
  expect(within(screen.getByRole('region', { name: 'Active students' })).queryByText('TEST1')).not.toBeInTheDocument()
  const data = mocks.approve.mock.calls[0][1] as FormData
  expect(data.get('class_id')).toBe('class')
  expect(data.get('student_id')).toBe('student')
  await act(async () => { finish({ status: 'success', message: 'Student approved.' }) })
  rerender(<StudentRoster classId="class" roster={{ pending: [], active: [{ ...student, verified: true }] }} />)
  expect(screen.getByRole('status')).toHaveTextContent('Student approved.')
  expect(screen.getByRole('heading', { name: 'Pending (0)' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Active (1)' })).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getAllByRole('cell', { name: 'TEST1' })).toHaveLength(1)
})

it.each(['returned', 'thrown'])('announces %s save errors without optimistic success and allows retry', async failure => {
  const user = userEvent.setup()
  if (failure === 'returned') mocks.approve.mockResolvedValueOnce({ status: 'error', message: 'Approval failed. Please try again.' })
  else mocks.approve.mockRejectedValueOnce(new Error('private transport failure'))
  mocks.approve.mockResolvedValue({ status: 'success', message: 'Student approved.' })
  render(<StudentRoster classId="class" roster={roster} />)
  await user.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private')
  expect(screen.getByRole('button')).toBeEnabled()
  expect(screen.getByRole('heading', { name: 'Pending (1)' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Active (0)' })).toBeInTheDocument()
  await user.click(screen.getByRole('button'))
  expect(await screen.findByRole('status')).toHaveTextContent('Student approved.')
  expect(mocks.approve).toHaveBeenCalledTimes(2)
})

it('shows both empty states and no approval controls', () => {
  render(<StudentRoster classId="class" roster={{ pending: [], active: [] }} />)
  expect(screen.getByText('No pending students.')).toBeInTheDocument()
  expect(screen.getByText('No active students.')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('offers approve-all for multiple pending students and submits exactly the listed rows', async () => {
  const user = userEvent.setup()
  mocks.approve.mockResolvedValue({ status: 'success', message: '2 students approved. They can now sign in.' })
  const second = { ...student, id: 'second', first_name: 'Sam', student_id: 'TEST2' }
  render(<StudentRoster classId="class" roster={{ pending: [student, second], active: [] }} />)
  await user.click(screen.getByRole('button', { name: 'Approve all 2 pending students' }))
  const data = mocks.approve.mock.calls[0][1] as FormData
  expect(data.get('intent')).toBe('approve_all')
  expect(data.getAll('pending_id')).toEqual(['student', 'second'])
  expect(await screen.findByRole('status')).toHaveTextContent('2 students approved.')
})

it('hides approve-all when only one student is pending', () => {
  render(<StudentRoster classId="class" roster={roster} />)
  expect(screen.queryByRole('button', { name: /Approve all/ })).not.toBeInTheDocument()
})
