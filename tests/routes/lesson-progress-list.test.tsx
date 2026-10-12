import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LessonProgressList } from '@/app/admin/LessonProgressList'
import type { TeacherClassLessonProgress } from '@/lib/server/teacher-lesson-progress'

type Student = TeacherClassLessonProgress['students'][number]

const zero: Student = {
  studentId: 'zero', firstName: 'Zero', lastName: 'Student', verified: false,
  overallPercent: 0, lessons: [],
}
const mixed: Student = {
  studentId: 'mixed', firstName: 'Mixed', lastName: 'Student', verified: true,
  overallPercent: 33,
  lessons: [
    { assignmentId: 'a1', activityId: 'bohr', activityTitle: 'Bohr Models Intro', status: 'not_started' },
    { assignmentId: 'a2', activityId: 'covalent', activityTitle: 'Lewis Structures — Covalent', status: 'in_progress' },
    { assignmentId: 'a3', activityId: 'diagram', activityTitle: 'Lewis Dot Diagram', status: 'completed' },
  ],
}

describe('LessonProgressList', () => {
  it('shows an empty-roster message instead of an empty-looking list', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[]} />)
    expect(html).toContain('No students in this class yet.')
  })

  it('shows a student with no assigned lessons distinctly from one with none completed', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[zero]} />)
    expect(html).toContain('Zero Student')
    expect(html).toContain('0% complete')
    expect(html).toContain('No lessons assigned yet.')
  })

  it('names every lesson and shows its own status as text, not color alone', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[mixed]} />)
    expect(html).toContain('Mixed Student')
    expect(html).toContain('33% complete')
    expect(html).toContain('Bohr Models Intro: Not started')
    expect(html).toContain('Lewis Structures — Covalent: In progress')
    expect(html).toContain('Lewis Dot Diagram: Completed')
  })

  it('keeps the overall percentage visually distinct from any one lesson status', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[mixed]} />)
    const percentIndex = html.indexOf('33% complete')
    const firstLessonIndex = html.indexOf('Bohr Models Intro')
    expect(percentIndex).toBeGreaterThanOrEqual(0)
    expect(firstLessonIndex).toBeGreaterThan(percentIndex)
  })

  it('lists multiple students independently', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[zero, mixed]} />)
    expect(html).toContain('Zero Student')
    expect(html).toContain('Mixed Student')
  })
})
