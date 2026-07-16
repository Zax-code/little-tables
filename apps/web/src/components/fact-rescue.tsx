import { LearningEngine, type PracticeQuestion, type RescueStrategy } from '@little-tables/domain'
import { useState, type SyntheticEvent } from 'react'

import { useI18n } from '../i18n.js'

type FactRescueProps = Readonly<{
  question: PracticeQuestion
  strategies: ReadonlyArray<RescueStrategy>
}>

export function FactRescue({ question, strategies }: FactRescueProps) {
  const { t } = useI18n()
  const [strategyIndex, setStrategyIndex] = useState(0)
  const [guided, setGuided] = useState(false)
  const [guidedValue, setGuidedValue] = useState('')
  const [guidedCorrect, setGuidedCorrect] = useState(false)
  const [guidedTried, setGuidedTried] = useState(false)
  const answer = LearningEngine.correctAnswer(question)
  const strategy = strategies[strategyIndex]

  const checkGuidedAnswer = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (Number(guidedValue) === answer) setGuidedCorrect(true)
    else setGuidedTried(true)
  }

  if (guided) {
    return (
      <div className="guided-recall">
        <strong>{t('rescue.try')}</strong>
        <span aria-hidden="true" className="guided-equation">
          {question.left} {question.operation === 'divide' ? '÷' : '×'} {question.right} =
        </span>
        {guidedCorrect ? (
          <div className="guided-recall-success">
            <b>{t('practice.yes', { answer })}</b>
            <span>{t('rescue.revisit')}</span>
          </div>
        ) : (
          <form onSubmit={checkGuidedAnswer}>
            <label className="sr-only" htmlFor={`guided-${question.id}`}>
              {question.operation === 'divide'
                ? t('practice.divide', { left: question.left, right: question.right })
                : t('practice.answerFor', { left: question.left, right: question.right })}
            </label>
            <input
              autoComplete="off"
              id={`guided-${question.id}`}
              inputMode="numeric"
              onChange={(event) => {
                setGuidedTried(false)
                setGuidedValue(event.target.value.replace(/\D/g, '').slice(0, 3))
              }}
              pattern="[0-9]*"
              value={guidedValue}
            />
            <button disabled={guidedValue.length === 0} type="submit">
              {t('practice.submit')}
            </button>
            {guidedTried ? (
              <span className="guided-recall-hint" role="status">
                {t('practice.almost', { answer })}
              </span>
            ) : null}
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="fact-rescue">
      <header>
        <span>{t('rescue.heading')}</span>
        <strong>{strategyLabel(strategy, question.operation, t)}</strong>
      </header>
      {strategy === undefined ? (
        <DivisionFamilyLesson question={question} />
      ) : (
        <RescueLesson strategy={strategy} />
      )}
      <div className="fact-rescue-actions">
        {strategies.length > 1 ? (
          <button
            onClick={() => setStrategyIndex((current) => (current + 1) % strategies.length)}
            type="button"
          >
            {t('rescue.another')}
          </button>
        ) : null}
        <button className="show-me-button" onClick={() => setGuided(true)} type="button">
          {t('rescue.try')}
        </button>
      </div>
    </div>
  )
}

type Translator = ReturnType<typeof useI18n>['t']

function strategyLabel(
  strategy: RescueStrategy | undefined,
  operation: PracticeQuestion['operation'],
  t: Translator,
): string {
  if (operation === 'divide') return t('curriculum.divisionHeading')
  if (strategy?.kind === 'commutative-flip') return t('rescue.flipLabel')
  if (strategy?.kind === 'known-fact-bridge') return t('rescue.bridgeLabel')
  return t('rescue.arrayLabel')
}

function RescueLesson({ strategy }: Readonly<{ strategy: RescueStrategy }>) {
  const { t } = useI18n()
  if (strategy.kind === 'array') {
    return (
      <div className="rescue-array">
        <div
          aria-hidden="true"
          className="rescue-array-dots"
          style={{ gridTemplateColumns: `repeat(${strategy.columns}, minmax(2px, 1fr))` }}
        >
          {Array.from({ length: strategy.total }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <p>
          {t('rescue.array', {
            answer: strategy.total,
            left: strategy.rows,
            right: strategy.columns,
          })}
        </p>
      </div>
    )
  }
  if (strategy.kind === 'commutative-flip') {
    return (
      <p>
        {t('rescue.flip', {
          left: strategy.left,
          right: strategy.right,
        })}
      </p>
    )
  }

  const one = strategy.adjustment.factor === 1
  const key =
    strategy.operator === 'subtract'
      ? one
        ? 'rescue.bridgeSubtractOne'
        : 'rescue.bridgeSubtractMany'
      : one
        ? 'rescue.bridgeOne'
        : 'rescue.bridgeMany'
  return (
    <p>
      {t(key, {
        answer: strategy.total,
        extraLeft: strategy.adjustment.factor,
        knownAnswer: strategy.anchor.product,
        knownLeft: strategy.anchor.factor,
        right: strategy.commonFactor,
      })}
    </p>
  )
}

function DivisionFamilyLesson({ question }: Readonly<{ question: PracticeQuestion }>) {
  const { t } = useI18n()
  const questionAnswer = LearningEngine.correctAnswer(question)
  const total = question.operation === 'multiply' ? questionAnswer : question.left
  const divisor = question.right
  const quotient = question.operation === 'multiply' ? question.left : questionAnswer
  return (
    <div className="division-family-lesson">
      <p>
        {t('curriculum.divisionFamily', {
          answer: total,
          left: divisor,
          right: quotient,
        })}
      </p>
      <strong>{t('practice.divisionGroups', { answer: total, left: divisor })}</strong>
    </div>
  )
}
