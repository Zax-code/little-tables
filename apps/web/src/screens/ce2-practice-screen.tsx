import { Ce2Engine, type Ce2Draft, type Ce2Question, type Ce2Session } from '@little-tables/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Ce2QuestionCard, type Ce2QuestionFeedback } from '../components/ce2-question-card.js'
import { ce2ColumnSteps } from '../components/ce2-column-steps.js'
import { CorrectAnswerConfetti } from '../components/correct-answer-confetti.js'
import { PracticeCharacter } from '../components/practice-character.js'
import { ProgressDots } from '../components/progress-dots.js'
import { Screen } from '../components/screen.js'
import { ce2Copy } from '../ce2-i18n.js'
import { useI18n } from '../i18n.js'
import { createPracticeActiveClock } from '../practice-active-clock.js'
import { playSuccessSound, prepareSuccessSound } from '../sound.js'
import { localBootstrapQueryKey, practiceStoreFor } from '../store.js'
import { useFamilyProfile } from '../use-family-profile.js'

type Props = Readonly<{ session: Ce2Session }>
const settledDraftWrite = Promise.resolve()

export function Ce2PracticeScreen({ session }: Props) {
  const { locale, t } = useI18n()
  const { activeProfile } = useFamilyProfile()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const store = practiceStoreFor(activeProfile.id)
  const finishing = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    try {
      const latest = await store.load()
      const completion = await store.completeCe2Session({
        completedAt: new Date(),
        sessionId: session.id,
        snapshot: latest.ce2Snapshot,
      })
      if (completion === null) {
        finishing.current = false
        return
      }
      const completed = await store.load()
      // Keep the practice route mounted until navigation finishes; its durable session is closed.
      queryClient.setQueryData(localBootstrapQueryKey(activeProfile.id), {
        ...completed,
        ce2ActiveSession: session,
      })
      await navigate({ to: '/celebration' })
      await queryClient.invalidateQueries({ queryKey: localBootstrapQueryKey(activeProfile.id) })
    } catch {
      finishing.current = false
      setError(t('ce2.saveFailed'))
    }
  }, [activeProfile.id, navigate, queryClient, session, store, t])

  const displayedQuestion =
    session.lastResult === null
      ? session.questions[session.currentIndex]
      : session.questions.find(({ id }) => id === session.lastResult?.questionId)

  useEffect(() => {
    if (displayedQuestion === undefined && session.lastResult === null) {
      void Promise.resolve().then(finish)
    }
  }, [displayedQuestion, finish, session.lastResult])

  if (displayedQuestion === undefined) {
    return (
      <Screen footer={false}>
        <div className="loading-state">{error ?? t('celebration.gathering')}</div>
      </Screen>
    )
  }

  return (
    <Screen footer={false}>
      <Ce2PracticeQuestion
        key={`${activeProfile.id}:${displayedQuestion.id}`}
        locale={locale}
        onFinish={finish}
        question={displayedQuestion}
        session={session}
      />
    </Screen>
  )
}

type QuestionProps = Props &
  Readonly<{
    locale: ReturnType<typeof useI18n>['locale']
    onFinish: () => Promise<void>
    question: Ce2Question
  }>

function Ce2PracticeQuestion({ locale, onFinish, question, session }: QuestionProps) {
  const { t } = useI18n()
  const copy = ce2Copy(locale)
  const { activeProfile } = useFamilyProfile()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const store = practiceStoreFor(activeProfile.id)
  const queryKey = localBootstrapQueryKey(activeProfile.id)
  const result = session.lastResult
  const firstDraft =
    session.draft?.questionId === question.id
      ? session.draft
      : {
          ...Ce2Engine.initialDraft({ now: new Date(), question }),
          answer: result?.answer ?? null,
          resultRevealed: result?.evaluation.status === 'incorrect',
        }
  const [draft, setDraft] = useState(firstDraft)
  const [formatFeedback, setFormatFeedback] = useState<Ce2QuestionFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const draftRef = useRef(draft)
  const writeQueue = useRef(settledDraftWrite)
  const pending = useRef(false)
  const clock = useRef<ReturnType<typeof createPracticeActiveClock> | null>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const questionSection = useRef<HTMLElement>(null)

  useEffect(() => {
    if (result !== null) {
      nextButton.current?.focus()
      return
    }
    questionSection.current?.scrollIntoView({ block: 'start' })
    questionSection.current?.focus({ preventScroll: true })
    const activeClock = createPracticeActiveClock({
      initialElapsedMs: draftRef.current.activeElapsedMs,
    })
    clock.current = activeClock
    const saveTime = () => {
      if (pending.current) return
      const latest = {
        ...draftRef.current,
        activeElapsedMs: activeClock.elapsedMs(),
        updatedAt: new Date(),
      }
      draftRef.current = latest
      writeQueue.current = writeQueue.current
        .then(async () => {
          await store.saveCe2Draft(session.id, latest)
        })
        .catch(() => setError(t('ce2.saveFailed')))
    }
    const interval = window.setInterval(saveTime, 5_000)
    document.addEventListener('visibilitychange', saveTime)
    window.addEventListener('pagehide', saveTime)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', saveTime)
      window.removeEventListener('pagehide', saveTime)
      activeClock.stop()
      clock.current = null
    }
  }, [result, session.id, store, t])

  const edit = (next: Ce2Draft) => {
    if (pending.current) return
    const updated = {
      ...next,
      activeElapsedMs: clock.current?.elapsedMs() ?? next.activeElapsedMs,
      helpOpened: draftRef.current.helpOpened || next.helpOpened,
      resultRevealed: draftRef.current.resultRevealed || next.resultRevealed,
      switchedToFree: draftRef.current.switchedToFree || next.switchedToFree,
    }
    draftRef.current = updated
    setDraft(updated)
    setFormatFeedback(null)
    if (result !== null) return
    writeQueue.current = writeQueue.current
      .then(async () => {
        await store.saveCe2Draft(session.id, updated)
      })
      .catch(() => setError(t('ce2.saveFailed')))
  }

  const submit = async () => {
    if (pending.current || result !== null || draftRef.current.answer === null) return
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      await writeQueue.current
      const currentDraft = {
        ...draftRef.current,
        activeElapsedMs: clock.current?.elapsedMs() ?? draftRef.current.activeElapsedMs,
      }
      if (currentDraft.answer === null) return
      const steps = ce2ColumnSteps(question, currentDraft)
      const evaluation = Ce2Engine.evaluate({
        answer: currentDraft.answer,
        columnSteps: steps,
        question,
      })
      if (evaluation.status === 'equivalent-needs-format') {
        setFormatFeedback({ kind: 'format', message: copy.t('feedbackFormat') })
        return
      }
      const latest = await store.load()
      if (latest.ce2ActiveSession?.id !== session.id || latest.ce2ActiveSession.lastResult !== null)
        return
      const response = Ce2Engine.answer({
        answer: currentDraft.answer,
        answeredAt: new Date(),
        assistance: {
          guided:
            session.kind === 'discovery' ||
            (question.family === 'column' && question.mode === 'guided'),
          helpOpened: currentDraft.helpOpened,
          representationHints: currentDraft.helpOpened ? 1 : 0,
          resultRevealed: currentDraft.resultRevealed,
          switchedToFree: currentDraft.switchedToFree,
        },
        columnSteps: steps,
        eventId: crypto.randomUUID(),
        session: { ...latest.ce2ActiveSession, draft: currentDraft },
      })
      const snapshot = Ce2Engine.reduce({
        attempts: [response.attempt],
        snapshot: latest.ce2Snapshot,
      })
      if (response.correct) prepareSuccessSound()
      await store.commitCe2Answer({
        attempt: response.attempt,
        session: response.session,
        snapshot,
      })
      clock.current?.stop()
      if (response.correct) playSuccessSound()
      await queryClient.invalidateQueries({ queryKey })
      nextButton.current?.focus()
    } catch {
      setError(t('ce2.saveFailed'))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const next = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try {
      const updated = await store.advanceCe2Feedback(session.id, new Date())
      if (updated === null) return
      if (updated.currentIndex >= updated.questions.length) {
        await onFinish()
      } else {
        await queryClient.invalidateQueries({ queryKey })
      }
    } catch {
      setError(t('ce2.saveFailed'))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const leave = async (abandon: boolean) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try {
      await writeQueue.current
      if (result === null) {
        await store.saveCe2Draft(session.id, {
          ...draftRef.current,
          activeElapsedMs: clock.current?.stop() ?? draftRef.current.activeElapsedMs,
        })
      }
      if (abandon) await store.abandonCe2Session(session.id)
      await queryClient.invalidateQueries({ queryKey })
      await navigate({ to: '/' })
    } catch {
      setError(t('ce2.saveFailed'))
      pending.current = false
      setBusy(false)
    }
  }

  const feedback: Ce2QuestionFeedback | null =
    result === null
      ? formatFeedback
      : {
          kind: result.evaluation.status === 'correct' ? 'correct' : 'incorrect',
        }
  const index = result === null ? session.currentIndex : Math.max(0, session.currentIndex - 1)
  return (
    <section
      aria-label={copy.skill(question.skill)}
      className="practice-screen ce2-practice-screen"
      ref={questionSection}
      tabIndex={-1}
    >
      <div className="practice-topline">
        <button
          aria-label={t('practice.leave')}
          className="icon-button"
          disabled={busy}
          onClick={() => setShowLeave(true)}
          type="button"
        >
          ×
        </button>
        <span className="streak-pill">{copy.skill(question.skill)}</span>
        <span className="question-count">
          {index + 1}/{session.questions.length}
        </span>
      </div>
      <ProgressDots current={session.currentIndex} total={session.questions.length} />
      {showLeave ? (
        <div className="feedback-tray" role="group" aria-label={t('practice.leave')}>
          <p>{t('ce2.leaveCopy')}</p>
          <div className="practice-leave-actions">
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => setShowLeave(false)}
              type="button"
            >
              {t('ce2.keep')}
            </button>
            <button
              className="next-button"
              disabled={busy}
              onClick={() => void leave(false)}
              type="button"
            >
              {t('ce2.pause')}
            </button>
            <button
              className="next-button"
              disabled={busy}
              onClick={() => void leave(true)}
              type="button"
            >
              {t('ce2.leave')}
            </button>
          </div>
        </div>
      ) : null}
      {error === null ? null : <p role="alert">{error}</p>}
      <Ce2QuestionCard
        disabled={busy || result !== null}
        draft={draft}
        feedback={feedback}
        locale={locale}
        onDraftChange={edit}
        onHelp={() => undefined}
        onSubmit={() => void submit()}
        question={question}
      />
      {result?.evaluation.status === 'correct' ? <CorrectAnswerConfetti key={question.id} /> : null}
      {result === null ? (
        <PracticeCharacter reaction="idle" />
      ) : (
        <div
          className={`feedback-tray feedback-${result.evaluation.status === 'correct' ? 'correct' : 'encourage'}`}
        >
          <PracticeCharacter
            className="feedback-bunny"
            reaction={result.evaluation.status === 'correct' ? 'correct' : 'encourage'}
          />
          <button
            className="next-button"
            disabled={busy}
            onClick={() => void next()}
            ref={nextButton}
            type="button"
          >
            {t('practice.next')}
          </button>
        </div>
      )}
    </section>
  )
}
