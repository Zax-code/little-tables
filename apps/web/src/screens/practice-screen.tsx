import { LearningEngine, type PracticeQuestion } from '@little-tables/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { Bunny } from '../components/bunny.js'
import { ProgressDots } from '../components/progress-dots.js'
import { Screen } from '../components/screen.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { localBootstrapQueryKey, practiceStore } from '../store.js'
import { playSuccessSound } from '../sound.js'

type Feedback = Readonly<{ correct: boolean; selected: number }>

export function PracticeScreen() {
  const bootstrap = useLocalBootstrap()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [keypadValue, setKeypadValue] = useState('')
  const [showExplanation, setShowExplanation] = useState(false)
  const data = bootstrap.data
  const session = data?.activeSession ?? null
  const question = session?.questions[session.currentIndex]

  useEffect(() => {
    if (!bootstrap.isLoading && session === null) void navigate({ to: '/' })
  }, [bootstrap.isLoading, navigate, session])

  if (session === null || question === undefined || data === undefined) {
    return (
      <Screen footer={false}>
        <div className="loading-state">growing your questions…</div>
      </Screen>
    )
  }

  const choose = async (selected: number) => {
    if (feedback !== null) return
    const result = LearningEngine.answer({
      answeredAt: new Date(),
      eventId: crypto.randomUUID(),
      selected,
      session,
    })
    const snapshot = LearningEngine.reduce({ attempts: [result.event], snapshot: data.snapshot })
    await practiceStore.commitAnswer({ attempt: result.event, session: result.session, snapshot })
    if (result.correct) playSuccessSound()
    queryClient.setQueryData(localBootstrapQueryKey, {
      ...data,
      activeSession: session,
      snapshot,
    })
    setFeedback({ correct: result.correct, selected })
  }

  const next = async () => {
    const latest = await practiceStore.load()
    if (latest.activeSession === null) return
    if (latest.activeSession.currentIndex >= latest.activeSession.questions.length) {
      await practiceStore.completeSession(latest.snapshot)
      await queryClient.invalidateQueries({ queryKey: localBootstrapQueryKey })
      await navigate({ to: '/celebration' })
      return
    }
    queryClient.setQueryData(localBootstrapQueryKey, latest)
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
            key={question.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="question-stage"
          >
            <p className="sr-only">
              {question.left} times {question.right}
            </p>
            <div aria-hidden="true" className="equation">
              {question.left} × {question.right}
            </div>

            {question.answerMode === 'choice' ? (
              <ChoiceGrid feedback={feedback} onChoose={choose} question={question} />
            ) : (
              <Keypad
                feedback={feedback}
                onChoose={choose}
                question={question}
                setValue={setKeypadValue}
                value={keypadValue}
              />
            )}

            <Bunny className="practice-bunny" scene="practice" />
          </motion.div>
        </AnimatePresence>

        {feedback === null ? null : (
          <div className="feedback-tray" role="status">
            <div>
              <strong>
                {feedback.correct
                  ? `yes! ${question.left * question.right} ♡`
                  : `almost — it’s ${question.left * question.right}`}
              </strong>
              <span>
                {feedback.correct
                  ? 'perfect little practice'
                  : `${question.left} × ${question.right} = ${question.left * question.right}`}
              </span>
            </div>
            {!feedback.correct && !showExplanation ? (
              <button className="show-me-button" onClick={() => setShowExplanation(true)}>
                show me
              </button>
            ) : null}
            {!feedback.correct && showExplanation ? <FactArray question={question} /> : null}
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
