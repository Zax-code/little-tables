// @vitest-environment happy-dom

import { Ce2Engine, type Ce2Answer, type Ce2Session } from '@little-tables/domain'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Ce2QuestionCardProps } from '../components/ce2-question-card.js'

const mocks = vi.hoisted(() => ({
  abandonCe2Session: vi.fn(),
  advanceCe2Feedback: vi.fn(),
  commitCe2Answer: vi.fn(),
  completeCe2Session: vi.fn(),
  invalidateQueries: vi.fn(() => Promise.resolve()),
  load: vi.fn(),
  navigate: vi.fn(() => Promise.resolve()),
  saveCe2Draft: vi.fn(() => Promise.resolve()),
  setQueryData: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    setQueryData: mocks.setQueryData,
  }),
}))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))

vi.mock('../store.js', () => ({
  localBootstrapQueryKey: (profileId: string) => ['local-bootstrap', profileId],
  practiceStoreFor: () => ({
    abandonCe2Session: mocks.abandonCe2Session,
    advanceCe2Feedback: mocks.advanceCe2Feedback,
    commitCe2Answer: mocks.commitCe2Answer,
    completeCe2Session: mocks.completeCe2Session,
    load: mocks.load,
    saveCe2Draft: mocks.saveCe2Draft,
  }),
}))

vi.mock('../use-family-profile.js', () => ({
  useFamilyProfile: () => ({ activeProfile: { avatarId: 'sprout', id: 'lou', name: 'Lou' } }),
}))

const copy: Readonly<Record<string, string>> = {
  'ce2.keep': 'Keep practicing',
  'ce2.leave': 'Abandon session',
  'ce2.leaveCopy': 'Pause or abandon?',
  'ce2.pause': 'Pause session',
  'practice.leave': 'Leave practice',
  'practice.next': 'Next',
}

vi.mock('../i18n.js', () => ({
  useI18n: () => ({
    locale: 'fr',
    t: (key: string) => copy[key] ?? key,
  }),
}))

vi.mock('../sound.js', () => ({
  playSuccessSound: vi.fn(),
  prepareSuccessSound: vi.fn(),
}))

vi.mock('../components/screen.js', () => ({
  Screen: ({ children }: Readonly<{ children: ReactNode }>) => <main>{children}</main>,
}))

vi.mock('../components/progress-dots.js', () => ({ ProgressDots: () => null }))
vi.mock('../components/practice-character.js', () => ({ PracticeCharacter: () => null }))
vi.mock('../components/correct-answer-confetti.js', () => ({ CorrectAnswerConfetti: () => null }))

vi.mock('../components/ce2-question-card.js', () => ({
  Ce2QuestionCard: ({
    disabled,
    draft,
    feedback,
    onDraftChange,
    onSubmit,
    question,
  }: Ce2QuestionCardProps) => {
    const choose = (answer: Ce2Answer) =>
      onDraftChange({ ...draft, answer, updatedAt: new Date('2026-10-04T12:01:00.000Z') })
    const equivalent =
      question.solution.type === 'fraction'
        ? {
            denominator: question.solution.denominator * 2,
            numerator: question.solution.numerator * 2,
            type: 'fraction' as const,
          }
        : null
    return (
      <div data-feedback={feedback?.kind ?? 'none'}>
        <button disabled={disabled} onClick={() => choose(question.solution)} type="button">
          Use correct answer
        </button>
        {equivalent === null ? null : (
          <button disabled={disabled} onClick={() => choose(equivalent)} type="button">
            Use equivalent format
          </button>
        )}
        <button
          disabled={disabled === true || draft.answer === null}
          onClick={onSubmit}
          type="button"
        >
          Submit answer
        </button>
      </div>
    )
  },
}))

import { Ce2PracticeScreen } from './ce2-practice-screen.js'

const now = new Date('2026-10-04T12:00:00.000Z')
const emptySnapshot = () => Ce2Engine.emptySnapshot()

function sessionFor(skill: 'A1' | 'F2' = 'A1'): Ce2Session {
  return Ce2Engine.createSession({
    kind: 'extra-practice',
    module: skill === 'F2' ? 'fractions' : 'arithmetic',
    now,
    seed: skill === 'F2' ? 4 : 17,
    skill,
    snapshot: emptySnapshot(),
  })
}

function answeredSession(session: Ce2Session): Ce2Session {
  const question = session.questions[session.currentIndex]
  if (question === undefined) throw new Error('Missing question')
  return Ce2Engine.answer({
    answer: question.solution,
    answeredAt: new Date('2026-10-04T12:01:00.000Z'),
    assistance: {
      guided: false,
      helpOpened: false,
      representationHints: 0,
      resultRevealed: false,
      switchedToFree: false,
    },
    eventId: 'attempt-1',
    session,
  }).session
}

describe('Ce2PracticeScreen controller', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const renderSession = (session: Ce2Session) => {
    mocks.load.mockResolvedValue({
      ce2ActiveSession: session,
      ce2Snapshot: emptySnapshot(),
    })
    act(() => root.render(<Ce2PracticeScreen session={session} />))
  }

  const button = (label: string): HTMLButtonElement => {
    const match = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    )
    if (match === undefined) throw new Error(`Missing button: ${label}`)
    return match
  }

  it('commits one attempt when submit is double-clicked', async () => {
    const session = sessionFor()
    renderSession(session)
    act(() => button('Use correct answer').click())

    await act(async () => {
      const submit = button('Submit answer')
      submit.click()
      submit.click()
      await Promise.resolve()
    })

    expect(mocks.commitCe2Answer).toHaveBeenCalledOnce()
  })

  it('advances feedback only once when Next is double-clicked', async () => {
    const session = answeredSession(sessionFor())
    mocks.advanceCe2Feedback.mockResolvedValue({ ...session, lastResult: null })
    renderSession(session)

    await act(async () => {
      const next = button('Next')
      next.click()
      next.click()
      await Promise.resolve()
    })

    expect(mocks.advanceCe2Feedback).toHaveBeenCalledOnce()
    expect(mocks.advanceCe2Feedback.mock.calls[0]?.[0]).toBe(session.id)
    expect(mocks.completeCe2Session).not.toHaveBeenCalled()
  })

  it('keeps an equivalent value editable until the requested fraction format is used', async () => {
    const base = sessionFor('F2')
    const question = Ce2Engine.generateQuestion({ seed: 4, skill: 'F2', tier: 4 })
    if (question.family !== 'fraction' || question.requiredDenominator === null)
      throw new Error('Expected an explicit-partition fraction question')
    const session = {
      ...base,
      draft: Ce2Engine.initialDraft({ now, question }),
      questions: [question, ...base.questions.slice(1)],
    }
    renderSession(session)
    act(() => button('Use equivalent format').click())

    await act(async () => {
      button('Submit answer').click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-feedback="format"]')).not.toBeNull()
    expect(button('Submit answer').disabled).toBe(false)
    expect(mocks.commitCe2Answer).not.toHaveBeenCalled()
  })

  it('persists a pause, while abandon closes without completing or rewarding the session', async () => {
    const session = sessionFor()
    renderSession(session)
    act(() => button('Use correct answer').click())
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Leave practice"]')?.click())

    await act(async () => {
      button('Pause session').click()
      await Promise.resolve()
    })

    expect(mocks.saveCe2Draft).toHaveBeenCalled()
    expect(mocks.abandonCe2Session).not.toHaveBeenCalled()
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
    expect(mocks.completeCe2Session).not.toHaveBeenCalled()

    act(() => root.unmount())
    root = createRoot(container)
    vi.clearAllMocks()
    const nextSession = sessionFor()
    mocks.load.mockResolvedValue({ ce2ActiveSession: nextSession, ce2Snapshot: emptySnapshot() })
    act(() => root.render(<Ce2PracticeScreen session={nextSession} />))
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Leave practice"]')?.click())
    await act(async () => {
      button('Abandon session').click()
      await Promise.resolve()
    })

    expect(mocks.abandonCe2Session).toHaveBeenCalledExactlyOnceWith(nextSession.id)
    expect(mocks.completeCe2Session).not.toHaveBeenCalled()
  })
})
