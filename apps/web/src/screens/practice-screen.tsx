import { LearningEngine, type PracticeQuestion } from '@little-tables/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { PracticeBunny } from '../components/practice-bunny.js'
import { ProgressDots } from '../components/progress-dots.js'
import { CorrectAnswerConfetti } from '../components/correct-answer-confetti.js'
import { Screen } from '../components/screen.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { localBootstrapQueryKey, practiceStore } from '../store.js'
import { playSuccessSound, prepareSuccessSound } from '../sound.js'

type Feedback = Readonly<{
  correct: boolean
  question: PracticeQuestion
  selected: number
}>

export function PracticeScreen() {
  const bootstrap = useLocalBootstrap()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [keypadValue, setKeypadValue] = useState('')
  const [showExplanation, setShowExplanation] = useState(false)
  const answering = useRef(false)
  const finishing = useRef(false)
  const data = bootstrap.data
  const session = data?.activeSession ?? null
  const question = session?.questions[session.currentIndex]
  const displayedQuestion = feedback?.question ?? question

  const finishSession = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    const latest = await practiceStore.load()
    const activeSession = latest.activeSession
    if (activeSession === null) {
      finishing.current = false
      return
    }
    const completion = await practiceStore.completeSession({
      completedAt: new Date(),
      sessionId: activeSession.id,
      snapshot: latest.snapshot,
    })
    if (completion === null) {
      finishing.current = false
      return
    }
    await queryClient.invalidateQueries({ queryKey: localBootstrapQueryKey })
    await navigate({ to: '/celebration' })
  }, [navigate, queryClient])

  useEffect(() => {
    if (!bootstrap.isLoading && session === null && !finishing.current) {
      void navigate({ to: '/' })
    }
  }, [bootstrap.isLoading, navigate, session])

  useEffect(() => {
    if (
      !bootstrap.isLoading &&
      feedback === null &&
      !answering.current &&
      session !== null &&
      question === undefined &&
      session.currentIndex >= session.questions.length
    ) {
      void finishSession()
    }
  }, [bootstrap.isLoading, feedback, finishSession, question, session])

  if (session === null || displayedQuestion === undefined || data === undefined) {
    return (
      <Screen footer={false}>
        <div className="loading-state">growing your questions…</div>
      </Screen>
    )
  }

  const choose = async (selected: number) => {
    if (feedback !== null || answering.current) return
    answering.current = true
    const result = LearningEngine.answer({
      answeredAt: new Date(),
      eventId: crypto.randomUUID(),
      selected,
      session,
    })
    const snapshot = LearningEngine.reduce({ attempts: [result.event], snapshot: data.snapshot })
    if (result.correct) prepareSuccessSound()
    try {
      await practiceStore.commitAnswer({ attempt: result.event, session: result.session, snapshot })
    } catch (error) {
      answering.current = false
      throw error
    }
    if (result.correct) playSuccessSound()
    queryClient.setQueryData(localBootstrapQueryKey, {
      ...data,
      activeSession: session,
      snapshot,
    })
    setFeedback({ correct: result.correct, question: displayedQuestion, selected })
  }

  const next = async () => {
    const latest = await practiceStore.load()
    if (latest.activeSession === null) return
    if (latest.activeSession.currentIndex >= latest.activeSession.questions.length) {
      await finishSession()
      return
    }
    const activeSession = {
      ...latest.activeSession,
      currentQuestionStartedAt: new Date(),
    }
    await practiceStore.startSession(activeSession, latest.snapshot)
    queryClient.setQueryData(localBootstrapQueryKey, { ...latest, activeSession })
    answering.current = false
    setFeedback(null)
    setKeypadValue('')
    setShowExplanation(false)
  }

  return (
    <Screen footer={false}>
      <section className="practice-screen">
        <div className="practice-topline">
          <button
            aria-label="Leave practice"
            className="icon-button"
            onClick={() => void navigate({ to: '/' })}
          >
            ×
          </button>
          <span className="streak-pill">{session.currentIndex} growing</span>
          <span className="question-count">
            {session.currentIndex + 1}/{session.questions.length}
          </span>
        </div>
        <ProgressDots current={session.currentIndex} total={session.questions.length} />

        <AnimatePresence mode="wait">
          <motion.div
            key={displayedQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="question-stage"
          >
            <p className="sr-only">
              {displayedQuestion.left} times {displayedQuestion.right}
            </p>
            <div aria-hidden="true" className="equation">
              {displayedQuestion.left} × {displayedQuestion.right}
            </div>

            {displayedQuestion.answerMode === 'choice' ? (
              <ChoiceGrid feedback={feedback} onChoose={choose} question={displayedQuestion} />
            ) : (
              <Keypad
                feedback={feedback}
                onChoose={choose}
                question={displayedQuestion}
                setValue={setKeypadValue}
                value={keypadValue}
              />
            )}

            {feedback === null ? <PracticeBunny reaction="idle" /> : null}
          </motion.div>
        </AnimatePresence>

        {feedback?.correct ? <CorrectAnswerConfetti key={feedback.question.id} /> : null}

        {feedback === null ? null : (
          <div
            className={`feedback-tray feedback-${feedback.correct ? 'correct' : 'encourage'}`}
            role="status"
          >
            <PracticeBunny
              className="feedback-bunny"
              reaction={feedback.correct ? 'correct' : 'encourage'}
            />
            <div>
              <strong>
                {feedback.correct
                  ? `yes! ${displayedQuestion.left * displayedQuestion.right} ♡`
                  : `almost — it’s ${displayedQuestion.left * displayedQuestion.right}`}
              </strong>
              <span>
                {feedback.correct
                  ? 'perfect little practice'
                  : `${displayedQuestion.left} × ${displayedQuestion.right} = ${displayedQuestion.left * displayedQuestion.right}`}
              </span>
            </div>
            {!feedback.correct && !showExplanation ? (
              <button className="show-me-button" onClick={() => setShowExplanation(true)}>
                show me
              </button>
            ) : null}
            {!feedback.correct && showExplanation ? (
              <FactArray question={displayedQuestion} />
            ) : null}
            <button className="next-button" onClick={() => void next()}>
              next
            </button>
          </div>
        )}
      </section>
    </Screen>
  )
}

function FactArray({ question }: Readonly<{ question: PracticeQuestion }>) {
  return (
    <div
      className="fact-array"
      aria-label={`${question.left} rows of ${question.right}, making ${question.left * question.right}`}
    >
      <div
        className="fact-array-dots"
        style={{ gridTemplateColumns: `repeat(${question.right}, 1fr)` }}
      >
        {Array.from({ length: question.left * question.right }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <strong>
        {question.left} groups of {question.right} = {question.left * question.right}
      </strong>
    </div>
  )
}

type AnswerProps = Readonly<{
  feedback: Feedback | null
  onChoose: (selected: number) => Promise<void>
  question: PracticeQuestion
}>

function ChoiceGrid({ feedback, onChoose, question }: AnswerProps) {
  const answer = question.left * question.right
  return (
    <div className="answer-grid">
      {question.choices.map((choice) => {
        const className =
          feedback === null
            ? 'answer-tile'
            : choice === answer
              ? 'answer-tile answer-correct'
              : choice === feedback.selected
                ? 'answer-tile answer-try-again'
                : 'answer-tile answer-muted'
        return (
          <motion.button
            className={className}
            disabled={feedback !== null}
            key={choice}
            onClick={() => void onChoose(choice)}
            whileTap={{ scale: 0.96 }}
          >
            {choice}
          </motion.button>
        )
      })}
    </div>
  )
}

function Keypad({
  feedback,
  onChoose,
  question,
  setValue,
  value,
}: AnswerProps & Readonly<{ setValue: (value: string) => void; value: string }>) {
  const press = (digit: string) => setValue(value.length >= 3 ? value : `${value}${digit}`)
  return (
    <div className="keypad-wrap">
      <div className="keypad-display" aria-live="polite">
        {value || '—'}
      </div>
      <div className="keypad-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button disabled={feedback !== null} key={digit} onClick={() => press(digit)}>
            {digit}
          </button>
        ))}
        <button
          aria-label="Delete"
          disabled={feedback !== null}
          onClick={() => setValue(value.slice(0, -1))}
        >
          ⌫
        </button>
        <button disabled={feedback !== null} onClick={() => press('0')}>
          0
        </button>
        <button
          aria-label="Submit answer"
          className="keypad-submit"
          disabled={feedback !== null || value.length === 0}
          onClick={() => void onChoose(Number(value))}
        >
          ✓
        </button>
      </div>
      <span className="recall-note">you know this one well enough to say it yourself</span>
      <span className="sr-only">
        Answer for {question.left} times {question.right}
      </span>
    </div>
  )
}
