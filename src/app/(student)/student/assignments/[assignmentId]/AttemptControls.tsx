'use client'

import { useActionState } from 'react'
import { saveAttempt } from './actions'

type Props = { assignmentId: string; attemptId?: string; completed: boolean }

export default function AttemptControls({ assignmentId, attemptId, completed }: Props) {
  const [state, action, pending] = useActionState(saveAttempt, { error: null })
  const operation = !attemptId ? 'start' : completed ? 'retry' : 'complete'
  const label = !attemptId ? 'Start exploration' : completed ? 'Try again' : 'Finish exploration'
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="action" value={operation} />
      {attemptId && <input type="hidden" name="attemptId" value={attemptId} />}
      <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground disabled:opacity-50">
        {pending ? 'Saving…' : label}
      </button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
