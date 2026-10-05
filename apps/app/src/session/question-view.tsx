/**
 * One question: what is asked at the top and how to answer in the panel at the bottom
 * (mockups C1 to C9). Rendered with a fresh key per question, so each keeps its own entry state.
 */
import type {
  Exercise,
  ExerciseDescription,
  LearningPathSettings,
  PracticeAnswer,
  PracticeQuestion,
} from '@little-tables/engine/schema'
import { Button, cn, FractionText } from '@little-tables/ui'
import { Sprout } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { useI18n } from '../i18n/i18n.js'
import { ColumnGrid } from './column.js'
import { useColumnEntry } from './column-entry.js'
import { GardenBed, GardenPot, PlantingBed } from './figures.js'
import { filledParts } from './fraction-figures.js'
import { formatFraction, formatNumber, fractionInWords, spokenPrompt } from './format.js'
import { ChoiceTiles, ComparisonTiles, DigitsPad, FractionPad, MultiPick } from './pads.js'
import { useTypedNumber } from './typed-number.js'
import { RulerControls, RulerDrawing, RulerSlider } from './ruler.js'

export type Response = Readonly<{ response: PracticeAnswer }> | Readonly<{ selected: number }>

export type Settled = Readonly<{
  correct: boolean
  response: PracticeAnswer | null
  selected: number | null
}>

export type QuestionParts = Readonly<{ panel: ReactNode; prompt: ReactNode }>

type QuestionViewProps = Readonly<{
  /** The answer to a multiplication or division. */
  answer: number
  description: ExerciseDescription | null
  isCorrect: (exercise: Exercise, answer: PracticeAnswer) => boolean
  method: LearningPathSettings['subtractionMethod']
  onAnswer: (response: Response) => void
  question: PracticeQuestion
  /** How the child's character names itself in stories. */
  characterName: string
  settled: Settled | null
  children: (parts: QuestionParts) => ReactNode
}>

const bigText = 'text-[4rem] leading-none font-black tabular tracking-tight'

/** A blank to fill in an equation; it shows what is typed, then the answer. */
function Blank({
  children,
  state,
}: Readonly<{ children: ReactNode; state: 'correct' | 'idle' | 'wrong' }>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[1.15em] min-w-[1.4em] items-center justify-center rounded-[0.3em] border-[0.06em] px-[0.15em]',
        state === 'idle' && 'border-tint bg-surface',
        state === 'correct' && 'border-leaf bg-leaf-soft text-leaf',
        state === 'wrong' && 'border-sun bg-sun-soft text-sun',
      )}
    >
      {children}
    </span>
  )
}

export function QuestionView(props: QuestionViewProps) {
  const { children, question } = props
  return question.exercise === undefined ? (
    <FactQuestion {...props}>{children}</FactQuestion>
  ) : (
    <ExerciseQuestion {...props} exercise={question.exercise}>
      {children}
    </ExerciseQuestion>
  )
}

/* Multiplications and divisions (C1 to C4) ----------------------------------------------------- */

function FactQuestion({ answer, children, onAnswer, question, settled }: QuestionViewProps) {
  const { language, t } = useI18n()
  const typed = useTypedNumber(3)
  const symbol = question.operation === 'divide' ? '÷' : '×'
  const spoken = t(question.operation === 'divide' ? 'session.divide' : 'session.times', {
    left: question.left,
    right: question.right,
  })
  const blankState = settled === null ? 'idle' : settled.correct ? 'correct' : 'wrong'
  const prompt = (
    <div className="flex flex-col items-center gap-6">
      <p className="sr-only">{spoken}</p>
      <p aria-hidden className={bigText}>
        {question.left} {symbol} {question.right}
      </p>
      {question.answerMode === 'keypad' ? (
        <output
          aria-label={t('session.answerFor', { question: spoken })}
          aria-live="polite"
          className="text-[2.5rem] font-black tabular"
        >
          <Blank state={blankState}>
            {settled === null ? typed.value || ' ' : formatNumber(settled.selected ?? 0, language)}
          </Blank>
        </output>
      ) : (
        <p className="text-callout font-semibold text-label-2">{t('session.touchAnswer')}</p>
      )}
    </div>
  )
  const panel =
    question.answerMode === 'choice' ? (
      <ChoiceTiles
        chosen={settled === null ? null : { type: 'integer', value: settled.selected ?? -1 }}
        choices={question.choices.map((value) => ({ type: 'integer', value }))}
        isCorrect={(choice) => choice.type === 'integer' && choice.value === answer}
        onChoose={(choice) => onAnswer({ selected: choice.type === 'integer' ? choice.value : 0 })}
      />
    ) : (
      <DigitsPad
        canSubmit={typed.value !== ''}
        disabled={settled !== null}
        onDigit={typed.press}
        onSubmit={() => onAnswer({ selected: Number(typed.value) })}
      />
    )
  return <>{children({ panel, prompt })}</>
}

/* Learning-path exercises (C5 to C9) ----------------------------------------------------------- */

type ExerciseQuestionProps = QuestionViewProps & Readonly<{ exercise: Exercise }>

function ExerciseQuestion(props: ExerciseQuestionProps) {
  const { children, exercise } = props
  switch (exercise.kind) {
    case 'arithmetic':
      return <ArithmeticQuestion {...props} exercise={exercise} />
    case 'column':
      return <ColumnQuestion {...props} exercise={exercise} />
    case 'fraction-read':
      return exercise.mode === 'build' ? (
        <BuildQuestion {...props} exercise={exercise} />
      ) : (
        <ReadQuestion {...props} exercise={exercise} />
      )
    case 'fraction-equal':
      return <EqualQuestion {...props} exercise={exercise} />
    case 'fraction-pick':
      return <PickQuestion {...props} exercise={exercise} />
    case 'fraction-line':
      return exercise.mode === 'place' ? (
        <PlaceQuestion {...props} exercise={exercise} />
      ) : (
        <LineReadQuestion {...props} exercise={exercise} />
      )
    case 'fraction-compare':
      return <CompareQuestion {...props} exercise={exercise} />
    case 'fraction-operation':
      return <OperationQuestion {...props} exercise={exercise} />
    default:
      return <>{children({ panel: null, prompt: null })}</>
  }
}

type KindProps<Kind extends Exercise['kind']> = QuestionViewProps &
  Readonly<{ exercise: Extract<Exercise, { kind: Kind }> }>

const skillTitle = (title: string) => (
  <p className="text-footnote font-extrabold tracking-wide text-tint">{title}</p>
)

/** Choices when the exercise has some, otherwise the given typed control. */
function choicesOr(props: QuestionViewProps & Readonly<{ exercise: Exercise }>, typed: ReactNode) {
  const { exercise, isCorrect, onAnswer, settled } = props
  return 'choices' in exercise && exercise.choices.length > 0 ? (
    <ChoiceTiles
      chosen={settled?.response ?? null}
      choices={exercise.choices}
      isCorrect={(answer) => isCorrect(exercise, answer)}
      onChoose={(response) => onAnswer({ response })}
    />
  ) : (
    typed
  )
}

function useIntegerPad(props: QuestionViewProps) {
  const typed = useTypedNumber(5)
  const pad = (
    <DigitsPad
      canSubmit={typed.value !== ''}
      disabled={props.settled !== null}
      onDigit={typed.press}
      onSubmit={() => props.onAnswer({ response: { type: 'integer', value: Number(typed.value) } })}
    />
  )
  return { pad, typed: typed.value }
}

function ArithmeticQuestion(props: KindProps<'arithmetic'>) {
  const { children, description, exercise, settled } = props
  const { language, t } = useI18n()
  const { pad, typed } = useIntegerPad(props)
  const number = (value: number) => formatNumber(value, language)
  const expected = description?.expected.type === 'integer' ? description.expected.value : 0
  const usesPad = exercise.choices.length === 0
  const state = settled === null ? 'idle' : settled.correct ? 'correct' : 'wrong'
  const blank = (
    <Blank state={state}>
      {settled !== null ? number(expected) : usesPad && typed !== '' ? number(Number(typed)) : '?'}
    </Blank>
  )
  const length = `${exercise.left}${exercise.right}`.length
  const size = length > 7 ? 'text-[2.25rem]' : length > 4 ? 'text-[2.75rem]' : 'text-[3.25rem]'
  let equation: ReactNode
  if (exercise.operation === 'double' || exercise.operation === 'half') {
    equation = (
      <div className="flex flex-col items-center gap-2">
        <span className="text-title-3 font-extrabold text-label-2">
          {t(exercise.operation === 'double' ? 'exercise.doubleOf' : 'exercise.halfOf')}
        </span>
        <span className={cn('flex items-center gap-3 font-black tabular', size)}>
          {number(exercise.left)} <span className="text-label-3">→</span> {blank}
        </span>
      </div>
    )
  } else {
    const result =
      exercise.operation === 'add' ? exercise.left + exercise.right : exercise.left - exercise.right
    const part = (value: number, isBlank: boolean) =>
      isBlank ? blank : <span>{number(value)}</span>
    const operation = (
      <>
        {part(exercise.left, exercise.blank === 'left')}
        <span className="text-label-2">{exercise.operation === 'add' ? '+' : '−'}</span>
        {part(exercise.right, exercise.blank === 'right')}
      </>
    )
    const total = part(result, exercise.blank === 'result')
    equation = (
      <span
        className={cn(
          'flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-black tabular',
          size,
        )}
      >
        {exercise.resultFirst ? (
          <>
            {total}
            <span className="text-label-2">=</span>
            {operation}
          </>
        ) : (
          <>
            {operation}
            <span className="text-label-2">=</span>
            {total}
          </>
        )}
      </span>
    )
  }
  const prompt = (
    <div className="flex flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t(`skill.${exercise.skill}`))}
      <div aria-hidden>{equation}</div>
    </div>
  )
  return <>{children({ panel: choicesOr(props, pad), prompt })}</>
}

function ColumnQuestion(props: KindProps<'column'>) {
  const { children, description, exercise, method, onAnswer, settled } = props
  const { language } = useI18n()
  const result = description?.columnResult ?? 0
  const entry = useColumnEntry(exercise, result)
  const prompt = (
    <>
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      <ColumnGrid
        entry={entry}
        exercise={exercise}
        method={method}
        outcome={settled === null ? null : { correct: settled.correct }}
        result={result}
      />
    </>
  )
  const panel = (
    <DigitsPad
      canSubmit={entry.canSubmit}
      disabled={settled !== null}
      onDigit={(key) => (key === 'erase' ? entry.erase() : entry.write(key))}
      onSubmit={() => {
        if (entry.written !== null)
          onAnswer({ response: { type: 'integer', value: entry.written } })
      }}
    />
  )
  return <>{children({ panel, prompt })}</>
}

function ReadQuestion(props: KindProps<'fraction-read'>) {
  const { children, exercise, settled } = props
  const { language, t } = useI18n()
  const { denominator, numerator } = exercise.fraction
  const label = t(exercise.shape === 'pot' ? 'figure.potLabel' : 'figure.bedLabel', {
    filled: numerator,
    parts: denominator,
  })
  const prompt = (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-read'))}
      <h2 aria-hidden className="text-title-2 font-extrabold">
        {t('exercise.readQuestion')}
      </h2>
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
    </div>
  )
  return (
    <>
      {children({
        panel: choicesOr(
          props,
          <FractionPad
            disabled={settled !== null}
            onSubmit={(response) => props.onAnswer({ response })}
            withWhole={false}
          />,
        ),
        prompt,
      })}
    </>
  )
}

function BuildQuestion(props: KindProps<'fraction-read'>) {
  const { children, exercise, onAnswer, settled } = props
  const { language, t } = useI18n()
  const [planted, setPlanted] = useState<ReadonlyArray<number>>([])
  const { denominator, numerator } = exercise.fraction
  const prompt = (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-read'))}
      <h2 aria-hidden className="flex items-center gap-2 text-title-2 font-extrabold">
        {t('exercise.buildBefore')}{' '}
        <FractionText
          denominator={denominator}
          label={fractionInWords(exercise.fraction, language)}
          numerator={numerator}
        />{' '}
        {t('exercise.buildAfter')}
      </h2>
      <PlantingBed
        correct={settled?.correct ?? null}
        denominator={denominator}
        onToggle={(index) =>
          setPlanted((current) =>
            current.includes(index)
              ? current.filter((value) => value !== index)
              : [...current, index],
          )
        }
        planted={planted}
        settled={settled !== null}
      />
      <output aria-live="polite" className="text-subhead font-bold text-label-2">
        {t('exercise.plantedCount', { count: planted.length, parts: denominator })}
      </output>
    </div>
  )
  const panel =
    settled === null ? (
      <Button
        disabled={planted.length === 0}
        icon={<Sprout aria-hidden className="size-5" />}
        onClick={() => onAnswer({ response: { ids: planted, type: 'selection' } })}
        size="lg"
        width="full"
      >
        {t('exercise.confirmBuild')}
      </Button>
    ) : null
  return <>{children({ panel, prompt })}</>
}

function EqualQuestion(props: KindProps<'fraction-equal'>) {
  const { children, exercise, settled } = props
  const { language, t } = useI18n()
  const { pad, typed } = useIntegerPad(props)
  const state = settled === null ? 'idle' : settled.correct ? 'correct' : 'wrong'
  const blank = (
    <Blank state={state}>
      {settled !== null
        ? exercise.target[exercise.blank]
        : exercise.choices.length === 0 && typed !== ''
          ? typed
          : '?'}
    </Blank>
  )
  const prompt = (
    <div className="flex flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-equal'))}
      <div aria-hidden className="flex items-center gap-4 text-[3rem]">
        <FractionText
          denominator={exercise.known.denominator}
          numerator={exercise.known.numerator}
        />
        <span className="font-black text-label-2">=</span>
        <FractionText
          denominator={exercise.blank === 'denominator' ? blank : exercise.target.denominator}
          numerator={exercise.blank === 'numerator' ? blank : exercise.target.numerator}
        />
      </div>
    </div>
  )
  return <>{children({ panel: choicesOr(props, pad), prompt })}</>
}

function PickQuestion(props: KindProps<'fraction-pick'>) {
  const { children, description, exercise, onAnswer, settled } = props
  const { language, t } = useI18n()
  const prompt = (
    <div className="flex flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-equal'))}
      <h2 aria-hidden className="flex items-center gap-2 text-title-2 font-extrabold">
        {t('exercise.pickBefore')}{' '}
        <FractionText
          className="text-[2rem]"
          denominator={exercise.reference.denominator}
          numerator={exercise.reference.numerator}
        />{' '}
        ?
      </h2>
    </div>
  )
  const panel = (
    <MultiPick
      correct={description?.equalOptions ?? []}
      onSubmit={(ids) => onAnswer({ response: { ids, type: 'selection' } })}
      options={exercise.options}
      settled={settled !== null}
    />
  )
  return <>{children({ panel, prompt })}</>
}

function PlaceQuestion(props: KindProps<'fraction-line'>) {
  const { children, description, exercise, onAnswer, settled } = props
  const { language, t } = useI18n()
  const [position, setPosition] = useState(0)
  const steps = exercise.ticks * exercise.units
  const confirm = () => onAnswer({ response: { index: position, type: 'tick' } })
  const reveal =
    settled === null
      ? null
      : { index: description?.tickIndex ?? 0, label: formatFraction(exercise.target) }
  const prompt = (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-line'))}
      <h2 aria-hidden className="flex items-center gap-2 text-title-2 font-extrabold">
        {t('exercise.placeBefore')}{' '}
        <FractionText
          className="text-tint"
          denominator={exercise.target.denominator}
          label={fractionInWords(exercise.target, language)}
          numerator={exercise.target.numerator}
          whole={exercise.target.whole}
        />
      </h2>
      <RulerSlider
        onConfirm={confirm}
        onMove={setPosition}
        position={position}
        reveal={reveal}
        settled={settled !== null}
        ticks={exercise.ticks}
        units={exercise.units}
      />
    </div>
  )
  const panel =
    settled === null ? (
      <RulerControls
        onConfirm={confirm}
        onMove={setPosition}
        position={position}
        settled={false}
        steps={steps}
      />
    ) : null
  return <>{children({ panel, prompt })}</>
}

function LineReadQuestion(props: KindProps<'fraction-line'>) {
  const { children, description, exercise, settled } = props
  const { language, t } = useI18n()
  const index = description?.tickIndex ?? 0
  const prompt = (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-line'))}
      <h2 aria-hidden className="text-title-2 font-extrabold">
        {t('exercise.lineQuestion')}
      </h2>
      <RulerDrawing
        ladybug={index}
        reveal={settled === null ? null : { index, label: formatFraction(exercise.target) }}
        ticks={exercise.ticks}
        units={exercise.units}
      />
    </div>
  )
  return (
    <>
      {children({
        panel: choicesOr(
          props,
          <FractionPad
            disabled={settled !== null}
            onSubmit={(response) => props.onAnswer({ response })}
            withWhole={exercise.units === 2}
          />,
        ),
        prompt,
      })}
    </>
  )
}

function CompareQuestion(props: KindProps<'fraction-compare'>) {
  const { children, description, exercise, onAnswer, settled } = props
  const { language, t } = useI18n()
  const symbol = description?.expected.type === 'comparison' ? description.expected.symbol : '?'
  const state = settled === null ? 'idle' : settled.correct ? 'correct' : 'wrong'
  const prompt = (
    <div className="flex flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-compare'))}
      <div aria-hidden className="flex items-center gap-5 text-[3.5rem]">
        <FractionText denominator={exercise.left.denominator} numerator={exercise.left.numerator} />
        <Blank state={state}>{settled === null ? '?' : symbol}</Blank>
        <FractionText
          denominator={exercise.right.denominator}
          numerator={exercise.right.numerator}
        />
      </div>
    </div>
  )
  const panel = (
    <ComparisonTiles
      chosen={settled?.response ?? null}
      expected={description?.expected ?? { symbol: '=', type: 'comparison' }}
      onChoose={(response) => onAnswer({ response })}
    />
  )
  return <>{children({ panel, prompt })}</>
}

function OperationQuestion(props: KindProps<'fraction-operation'>) {
  const { characterName, children, description, exercise, settled } = props
  const { language, t } = useI18n()
  const result = description?.operationResult
  const state = settled === null ? 'idle' : settled.correct ? 'correct' : 'wrong'
  const prompt = exercise.story ? (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-operation'))}
      <p className="text-callout font-semibold">
        {t('story.watering', { character: characterName, part: formatFraction(exercise.right) })}
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
      <h2 className="text-title-3 font-extrabold">{t('story.question')}</h2>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-4">
      <p className="sr-only">{spokenPrompt(exercise, language)}</p>
      {skillTitle(t('skill.fraction-operation'))}
      <div aria-hidden className="flex items-center gap-3 text-[2.75rem] font-black">
        <FractionText denominator={exercise.left.denominator} numerator={exercise.left.numerator} />
        <span className="text-label-2">{exercise.operation === 'add' ? '+' : '−'}</span>
        <FractionText
          denominator={exercise.right.denominator}
          numerator={exercise.right.numerator}
        />
        <span className="text-label-2">=</span>
        <Blank state={state}>
          {settled === null || result === undefined ? (
            '?'
          ) : (
            <FractionText denominator={result.denominator} numerator={result.numerator} />
          )}
        </Blank>
      </div>
    </div>
  )
  return (
    <>
      {children({
        panel: choicesOr(
          props,
          <FractionPad
            disabled={settled !== null}
            onSubmit={(response) => props.onAnswer({ response })}
            withWhole={false}
          />,
        ),
        prompt,
      })}
    </>
  )
}
