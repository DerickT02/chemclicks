import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActivityProgressSummary } from '@/app/admin/ActivityProgressSummary'
import { StageBar } from '@/components/assignments/StageBar'
import type { AssignmentStage } from '@/lib/assignments/stages'
import type { TeacherClassLessonProgress } from '@/lib/server/teacher-lesson-progress'

type Student = TeacherClassLessonProgress['students'][number]
type Lesson = Student['lessons'][number]

const lesson = (assignmentId: string, stage?: AssignmentStage, status: Lesson['status'] = 'in_progress'): Lesson =>
  ({ assignmentId, activityId: `activity-${assignmentId}`, activityTitle: assignmentId, status, stage })
const student = (id: string, lessons: Lesson[]): Student =>
  ({ studentId: id, firstName: id, lastName: 'Student', verified: true, overallPercent: 0, lessons })

const render = (students: Student[] | null, assignmentId = 'bohr') => renderToStaticMarkup(
  <ActivityProgressSummary classId="class-1" assignmentId={assignmentId} activityTitle="Bohr Model Intro" students={students} />,
)

describe('ActivityProgressSummary', () => {
  it('counts only this activity, furthest stage first, and skips empty stages', () => {
    const html = render([
      student('a', [lesson('bohr', 'completed', 'completed'), lesson('lewis', 'not_started', 'not_started')]),
      student('b', [lesson('bohr', 'quiz_in_progress'), lesson('lewis', 'completed', 'completed')]),
      student('c', [lesson('bohr', 'explored'), lesson('lewis', 'completed', 'completed')]),
      student('d', [lesson('bohr', 'exploring')]),
      student('e', [lesson('bohr', 'not_started', 'not_started')]),
    ])
    expect(html).toContain('5 students · 1 completed · 1 taking the quiz · 2 exploring · 1 not started')
    expect(html).not.toContain('needs retry')
  })

  it('links to the activity page, naming the activity for screen readers', () => {
    const html = render([student('a', [lesson('bohr', 'completed', 'completed')])])
    expect(html).toContain('href="/admin/classes/class-1/activities/bohr"')
    expect(html).toContain('Student progress<span class="sr-only">: Bohr Model Intro</span>')
  })

  it('treats a student without a row for this activity as not started', () => {
    expect(render([student('a', [])])).toContain('1 student · 1 not started')
  })

  it('falls back to the saved status on a database without stages', () => {
    const html = render([
      student('a', [lesson('bohr', undefined, 'completed')]),
      student('b', [lesson('bohr', undefined, 'in_progress')]),
    ])
    expect(html).toContain('2 students · 1 completed · 1 exploring')
  })

  it('distinguishes an empty class from progress that could not be loaded, keeping the link', () => {
    expect(render([])).toContain('No students in this class yet.')
    const failed = render(null)
    expect(failed).toContain('Progress unavailable.')
    expect(failed).toContain('href="/admin/classes/class-1/activities/bohr"')
  })
})

describe('StageBar', () => {
  it.each([
    ['not_started', 0, 'Not started'],
    ['exploring', 33, 'Started the assignment'],
    ['explored', 33, 'Exploration finished, quiz not started'],
    ['quiz_in_progress', 66, 'Taking the quiz'],
    ['needs_retry', 66, 'Quiz not passed, needs retry'],
    ['completed', 100, 'Completed'],
  ] as const)('draws %s at %i%% with its label in text and for assistive technology', (stage, percent, label) => {
    const html = renderToStaticMarkup(<StageBar stage={stage} label="Alex Student, Bohr Model Intro" title="Alex Student" />)
    expect(html).toContain(`${label} · ${percent}%`)
    expect(html).toContain(`aria-valuenow="${percent}"`)
    expect(html).toContain(`aria-valuetext="${label}"`)
    expect(html).toContain('aria-label="Alex Student, Bohr Model Intro"')
    expect(html).toContain(`width:${percent}%`)
  })
})
