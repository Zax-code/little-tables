import {
  equalOptionIndexes,
  expectedAnswer,
  fractionOperationResult,
  lineTickIndex,
  type Exercise,
  type PracticeAnswer,
  type SubtractionMethod,
} from '@little-tables/domain'
import { useState, type ReactNode } from 'react'

import { formatFraction, formatNumber, fractionInWords, spokenPrompt } from '../exercise-format.js'
import { useI18n } from '../i18n.js'
import { useSelectedCharacter } from '../use-selected-character.js'
import { AnswerTiles, FractionKeypad, MultiPick, NumberEntry } from './answer-pads.js'
import { ColumnOperation } from './column-operation.js'
import { GardenBed, GardenPot, PlantingBed } from './fraction-figure.js'
import { filledParts } from '../fraction-layout.js'
import { FractionRuler, PlacingRuler } from './fraction-ruler.js'
import { FractionText } from './fraction-text.js'

export type ExerciseOutcome = Readonly<{ correct: boolean; response: PracticeAnswer }>

type ExerciseStageProps = Readonly<{
  exercise: Exercise
  onAnswer: (answer: PracticeAnswer) => void
  outcome: ExerciseOutcome | null
  subtractionMethod: SubtractionMethod
}>

const comparisonChoices: ReadonlyArray<PracticeAnswer> = [
  { symbol: '<', type: 'comparison' },
  { symbol: '=', type: 'comparison' },
  { symbol: '>', type: 'comparison' },
]

const expectedSymbol = (exercise: Exercise): string => {
  const answer = expectedAnswer(exercise)
  return answer.type === 'comparison' ? answer.symbol : '?'
}

function Blank({ filled }: Readonly<{ filled: ReactNode | null }>) {
  return <span className={`blank-box${filled === null ? '' : ' is-filled'}`}>{filled ?? '?'}</span>
}

function ArithmeticPrompt({
  exercise,
  outcome,
}: Readonly<{
  exercise: Extract<Exercise, { kind: 'arithmetic' }>
  outcome: ExerciseOutcome | null
}>) {
  const { locale, t } = useI18n()
  const number = (value: number) => formatNumber(value, locale)
  const answerText =
    outcome === null
      ? null
      : number(
          exercise.blank === 'left'
            ? exercise.left
            : exercise.blank === 'right'
              ? exercise.right
              : exercise.operation === 'add'
                ? exercise.left + exercise.right
                : exercise.operation === 'subtract'
                  ? exercise.left - exercise.right
                  : exercise.operation === 'double'
                    ? exercise.left * 2
                    : exercise.left / 2,
        )
  if (exercise.operation === 'double' || exercise.operation === 'half') {
    return (
      <div aria-hidden="true" className="exercise-equation exercise-equation-words">
        <span className="equation-caption">
          {t(exercise.operation === 'double' ? 'exercise.doubleOf' : 'exercise.halfOf')}
        </span>
        <span>
          {number(exercise.left)} <span className="equation-equals">=</span>{' '}
          <Blank filled={answerText} />
        </span>
      </div>
    )
  }
  const result =
    exercise.operation === 'add' ? exercise.left + exercise.right : exercise.left - exercise.right
  const part = (value: number, blank: boolean) =>
    blank ? <Blank filled={answerText} /> : <span>{number(value)}</span>
  const operation = (
    <>
      {part(exercise.left, exercise.blank === 'left')}
      <span className="equation-operator">{exercise.operation === 'add' ? '+' : '−'}</span>
      {part(exercise.right, exercise.blank === 'right')}
    </>
  )
  const total = part(result, exercise.blank === 'result')
  const length = `${exercise.left}${exercise.right}${result}`.length
  return (
    <div
      aria-hidden="true"
      className={`exercise-equation${length > 9 ? ' is-long' : length > 6 ? ' is-medium' : ''}`}
    >
      {exercise.resultFirst ? (
        <>
          {total}
          <span className="equation-equals">=</span>
          {operation}
        </>
      ) : (
        <>
          {operation}
          <span className="equation-equals">=</span>
          {total}
        </>
      )}
    </div>
  )
}

function FractionOperationPrompt({
  exercise,
  outcome,
}: Readonly<{
  exercise: Extract<Exercise, { kind: 'fraction-operation' }>
  outcome: ExerciseOutcome | null
}>) {
  const { t } = useI18n()
  const character = useSelectedCharacter()
  const equation = (
    <div aria-hidden="true" className="exercise-equation fraction-equation">
      <FractionText denominator={exercise.left.denominator} numerator={exercise.left.numerator} />
      <span className="equation-operator">{exercise.operation === 'add' ? '+' : '−'}</span>
      <FractionText denominator={exercise.right.denominator} numerator={exercise.right.numerator} />
      <span className="equation-equals">=</span>
      <Blank
        filled={
          outcome === null ? null : (
            <FractionText
              denominator={fractionOperationResult(exercise).denominator}
              numerator={fractionOperationResult(exercise).numerator}
            />
          )
        }
      />
    </div>
  )
  if (!exercise.story) return equation
  return (
    <div className="story-card">
      <p>
        {t('story.watering', {
          character: character.displayName,
          part: formatFraction(exercise.right),
        })}
      </p>
      <GardenBed
        compact
        denominator={exercise.right.denominator}
        filled={filledParts(exercise.right.denominator, exercise.right.numerator)}
        label={t('story.bedLabel', {
          parts: exercise.right.denominator,
          watered: exercise.right.numerator,
        })}
        tone="lavender"
      />
      <strong>{t('story.question')}</strong>
    </div>
  )
}

/**
 * Renders one learning-path exercise: a calm visual prompt, a spoken prompt for screen readers,
 * and the answer control that fits it.
 */
export function ExerciseStage({
  exercise,
  onAnswer,
  outcome,
  subtractionMethod,
}: ExerciseStageProps) {
  const { locale, t } = useI18n()
  const [planted, setPlanted] = useState<ReadonlyArray<number>>([])
  const settled = outcome !== null
  const chosen = outcome?.response ?? null
  const spoken = spokenPrompt(exercise, locale)

  const tilesOr = (production: ReactNode) =>
    'choices' in exercise && exercise.choices.length > 0 ? (
      <AnswerTiles
        choices={exercise.choices}
        exercise={exercise}
        onChoose={onAnswer}
        selected={chosen}
        settled={settled}
      />
    ) : (
      production
    )

  const numberEntry = (
    <NumberEntry
      disabled={settled}
      label={t('practice.yourAnswer')}
      onSubmit={(value) => onAnswer({ type: 'integer', value })}
    />
  )

  switch (exercise.kind) {
    case 'arithmetic':
      return (
        <>
          <p className="sr-only">{spoken}</p>
          <ArithmeticPrompt exercise={exercise} outcome={outcome} />
          {tilesOr(numberEntry)}
        </>
      )
    case 'column':
      return (
        <>
          <p className="sr-only">{spoken}</p>
          <ColumnOperation
            exercise={exercise}
            method={subtractionMethod}
            onSubmit={(value) => onAnswer({ type: 'integer', value })}
            outcome={outcome}
          />
        </>
      )
    case 'fraction-read': {
      const { denominator, numerator } = exercise.fraction
      if (exercise.mode === 'build') {
        return (
          <>
            <p className="sr-only">{spoken}</p>
            <p aria-hidden="true" className="exercise-question">
              {t('exercise.buildBefore')}{' '}
              <FractionText denominator={denominator} numerator={numerator} />{' '}
              {t('exercise.buildAfter')}
            </p>
            <PlantingBed
              correct={outcome?.correct ?? null}
              denominator={denominator}
              onToggle={(index) =>
                setPlanted((current) =>
                  current.includes(index)
                    ? current.filter((value) => value !== index)
                    : [...current, index],
                )
              }
              planted={planted}
              settled={settled}
            />
            <output aria-live="polite" className="planting-count">
              {t('exercise.plantedCount', { count: planted.length, parts: denominator })}
            </output>
            <button
              className="primary-button exercise-confirm"
              disabled={settled || planted.length === 0}
              onClick={() => onAnswer({ ids: planted, type: 'selection' })}
              type="button"
            >
              {t('exercise.confirmBuild')}
            </button>
          </>
        )
      }
      const label = t(exercise.shape === 'pot' ? 'figure.potLabel' : 'figure.bedLabel', {
        filled: numerator,
        parts: denominator,
      })
      return (
        <>
          <p className="sr-only">{spoken}</p>
          <p aria-hidden="true" className="exercise-question">
            {t('exercise.readQuestion')}
          </p>
          {exercise.shape === 'pot' ? (
            <GardenPot
              denominator={denominator}
              filled={filledParts(denominator, numerator)}
              label={label}
            />
          ) : (
            <GardenBed
              denominator={denominator}
              filled={filledParts(denominator, numerator)}
              label={label}
            />
          )}
          {tilesOr(
            <FractionKeypad
              disabled={settled}
              label={t('practice.yourAnswer')}
              onSubmit={onAnswer}
              withWhole={false}
            />,
          )}
        </>
      )
    }
    case 'fraction-equal': {
      const { blank, known, target } = exercise
      const filled = outcome === null ? null : String(target[blank])
      return (
        <>
          <p className="sr-only">{spoken}</p>
          <div aria-hidden="true" className="exercise-equation fraction-equation">
            <FractionText denominator={known.denominator} numerator={known.numerator} />
            <span className="equation-equals">=</span>
            <FractionText
              denominator={blank === 'denominator' ? <Blank filled={filled} /> : target.denominator}
              numerator={blank === 'numerator' ? <Blank filled={filled} /> : target.numerator}
            />
          </div>
          {tilesOr(numberEntry)}
        </>
      )
    }
    case 'fraction-pick':
      return (
        <>
          <p className="sr-only">{spoken}</p>
          <p aria-hidden="true" className="exercise-question">
            {t('exercise.pickBefore')}{' '}
            <span className="nowrap">
              <FractionText
                denominator={exercise.reference.denominator}
                numerator={exercise.reference.numerator}
              />{' '}
              ?
            </span>
          </p>
          <MultiPick
            correctIndexes={equalOptionIndexes(exercise)}
            onSubmit={(ids) => onAnswer({ ids, type: 'selection' })}
            options={exercise.options}
            settled={settled}
          />
        </>
      )
    case 'fraction-line': {
      const targetIndex = lineTickIndex(exercise)
      const reveal = settled ? { index: targetIndex, label: formatFraction(exercise.target) } : null
      if (exercise.mode === 'place') {
        return (
          <>
            <p className="sr-only">{spoken}</p>
            <p aria-hidden="true" className="exercise-question">
              {t('exercise.placeBefore')}{' '}
              <FractionText
                denominator={exercise.target.denominator}
                numerator={exercise.target.numerator}
                whole={exercise.target.whole}
              />
            </p>
            <PlacingRuler
              onPlace={(index) => onAnswer({ index, type: 'tick' })}
              reveal={reveal}
              settled={settled}
              ticks={exercise.ticks}
              units={exercise.units}
            />
          </>
        )
      }
      return (
        <>
          <p className="sr-only">{spoken}</p>
          <p aria-hidden="true" className="exercise-question">
            {t('exercise.lineQuestion')}
          </p>
          <FractionRuler
            ladybug={targetIndex}
            reveal={reveal}
            ticks={exercise.ticks}
            units={exercise.units}
          />
          {tilesOr(
            <FractionKeypad
              disabled={settled}
              label={t('practice.yourAnswer')}
              onSubmit={onAnswer}
              withWhole={exercise.units === 2}
            />,
          )}
        </>
      )
    }
    case 'fraction-compare': {
      return (
        <>
          <p className="sr-only">{spoken}</p>
          <div aria-hidden="true" className="exercise-equation fraction-equation">
            <FractionText
              denominator={exercise.left.denominator}
              numerator={exercise.left.numerator}
            />
            <Blank filled={outcome === null ? null : expectedSymbol(exercise)} />
            <FractionText
              denominator={exercise.right.denominator}
              numerator={exercise.right.numerator}
            />
          </div>
          <AnswerTiles
            choices={comparisonChoices}
            className="compare-grid"
            exercise={exercise}
            onChoose={onAnswer}
            selected={chosen}
            settled={settled}
          />
          <p aria-hidden="true" className="recall-note">
            {t('compare.legend', {
              left: fractionInWords(exercise.left, locale),
              right: fractionInWords(exercise.right, locale),
            })}
          </p>
        </>
      )
    }
    case 'fraction-operation':
      return (
        <>
          <p className="sr-only">{spoken}</p>
          <FractionOperationPrompt exercise={exercise} outcome={outcome} />
          {tilesOr(
            <FractionKeypad
              disabled={settled}
              label={t('practice.yourAnswer')}
              onSubmit={onAnswer}
              withWhole={false}
            />,
          )}
        </>
      )
  }
}
