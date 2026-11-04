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
  overallPercent: 14,
  lessons: [
    { assignmentId: 'a1', activityId: 'bohr', activityTitle: 'Bohr Models Intro', status: 'not_started', stage: 'not_started' },
    { assignmentId: 'a2', activityId: 'stability', activityTitle: 'Bohr Stability', status: 'in_progress', stage: 'exploring' },
    { assignmentId: 'a3', activityId: 'covalent', activityTitle: 'Lewis Covalent', status: 'in_progress', stage: 'explored' },
    { assignmentId: 'a4', activityId: 'ionic', activityTitle: 'Lewis Ionic', status: 'in_progress', stage: 'quiz_in_progress' },
    { assignmentId: 'a5', activityId: 'ruler', activityTitle: 'Ruler Tenths', status: 'in_progress', stage: 'needs_retry' },
    { assignmentId: 'a6', activityId: 'cylinder', activityTitle: 'Graduated Cylinder', status: 'completed', stage: 'completed' },
  ],
}

function bar(html: string, title: string) {
  const match = html.match(new RegExp(`aria-label="Mixed Student, ${title}"[^>]*aria-valuenow="(\\d+)"`))
  return match ? Number(match[1]) : null
}

describe('LessonProgressList', () => {
  it('shows an empty-roster message instead of an empty-looking list', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[]} />)
    expect(html).toContain('No students in this class yet.')
  })

  it('shows a student with no assigned lessons distinctly from one with none completed', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[zero]} />)
    expect(html).toContain('Zero Student')
    expect(html).toContain('No lessons assigned yet.')
    expect(html).not.toContain('role="progressbar"')
  })

  it('moves each lesson bar through 0, 33, 66 and 100 by stage', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[mixed]} />)
    expect(bar(html, 'Bohr Models Intro')).toBe(0)
    expect(bar(html, 'Bohr Stability')).toBe(33)
    expect(bar(html, 'Lewis Covalent')).toBe(33)
    expect(bar(html, 'Lewis Ionic')).toBe(66)
    expect(bar(html, 'Ruler Tenths')).toBe(66)
    expect(bar(html, 'Graduated Cylinder')).toBe(100)
  })

  it('names each stage as text, not bar width alone', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[mixed]} />)
    expect(html).toContain('Not started · 0%')
    expect(html).toContain('Started the assignment · 33%')
    expect(html).toContain('Exploration finished, quiz not started · 33%')
    expect(html).toContain('Taking the quiz · 66%')
    expect(html).toContain('Quiz not passed, needs retry · 66%')
    expect(html).toContain('Completed · 100%')
  })

  it('counts only completed lessons in the student summary', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[mixed]} />)
    expect(html).toContain('1 of 6 completed')
  })

  it('falls back to status when the database returns no stage', () => {
    const legacy: Student = {
      ...mixed,
      lessons: [
        { assignmentId: 'a1', activityId: 'bohr', activityTitle: 'Bohr Models Intro', status: 'in_progress' },
        { assignmentId: 'a2', activityId: 'covalent', activityTitle: 'Lewis Covalent', status: 'completed' },
      ],
    }
    const html = renderToStaticMarkup(<LessonProgressList students={[legacy]} />)
    expect(bar(html, 'Bohr Models Intro')).toBe(33)
    expect(bar(html, 'Lewis Covalent')).toBe(100)
  })

  it('shows saved timing and the completing pass for each lesson', () => {
    const timed: Student = {
      ...mixed,
      lessons: [{
        assignmentId: 'a1', activityId: 'covalent', activityTitle: 'Lewis Covalent', status: 'completed', stage: 'completed',
        explorationStartedAt: '2026-10-01T10:00:00Z', firstQuizStartedAt: '2026-10-01T10:12:30Z',
        timeToFirstQuizSeconds: 750, passingQuizAttemptNumber: 3, passingQuizScore: 11, passingQuizTotal: 12,
        passingQuizPercentage: 91.67, failedQuizAttemptCount: 2, completedAt: '2026-10-01T10:40:00Z',
      }],
    }
    const html = renderToStaticMarkup(<LessonProgressList students={[timed]} />)
    expect(html).toContain('Timing and results')
    expect(html).toContain('dateTime="2026-10-01T10:00:00Z"')
    expect(html).toContain('Exploration to first quiz:</dt><dd>12m 30s')
    expect(html).toContain('Passed on attempt 3: 11/12 (91.67%)')
    expect(html).toContain('dateTime="2026-10-01T10:40:00Z"')
  })

  it('keeps a failed retry visibly unfinished with no score', () => {
    const retry: Student = {
      ...mixed,
      lessons: [{
        assignmentId: 'a1', activityId: 'bohr', activityTitle: 'Bohr Models Intro', status: 'in_progress', stage: 'needs_retry',
        explorationStartedAt: null, firstQuizStartedAt: null, timeToFirstQuizSeconds: null,
        passingQuizAttemptNumber: null, passingQuizScore: null, passingQuizTotal: null, passingQuizPercentage: null,
        failedQuizAttemptCount: 1, completedAt: null,
      }],
    }
    const html = renderToStaticMarkup(<LessonProgressList students={[retry]} />)
    expect(bar(html, 'Bohr Models Intro')).toBe(66)
    expect(html).toContain('Not passed yet · 1 attempt submitted')
    expect(html).toContain('Start time not recorded')
    expect(html).toContain('Exploration to first quiz:</dt><dd>Not recorded')
    expect(html).not.toContain('Completed:')
    expect(html).toContain('0 of 1 completed')
  })

  it('hides details for an untouched lesson or a database without stages', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[{
      ...mixed,
      lessons: [
        { assignmentId: 'a1', activityId: 'bohr', activityTitle: 'Bohr Models Intro', status: 'not_started', stage: 'not_started' },
        { assignmentId: 'a2', activityId: 'covalent', activityTitle: 'Lewis Covalent', status: 'in_progress' },
      ],
    }]} />)
    expect(html).not.toContain('Timing and results')
  })

  it('lists multiple students independently', () => {
    const html = renderToStaticMarkup(<LessonProgressList students={[zero, mixed]} />)
    expect(html).toContain('Zero Student')
    expect(html).toContain('Mixed Student')
  })
})
