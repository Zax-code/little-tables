import {
  type Ce2Answer,
  type Ce2Choice,
  type Ce2ColumnName,
  type Ce2Draft,
  type Ce2Question,
  type Ce2Rational,
} from '@little-tables/domain'
import { useId, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react'

import { ce2Translate } from '../ce2-i18n.js'
import type { Locale } from '../i18n.js'

import './ce2-question-card.css'

export type Ce2QuestionFeedback = Readonly<{
  kind: 'correct' | 'format' | 'incorrect'
  message?: string
}>

export type Ce2QuestionCardProps = Readonly<{
  busy?: boolean
  disabled?: boolean
  draft: Ce2Draft
  feedback?: Ce2QuestionFeedback | null
  locale: Locale
  onDraftChange: (draft: Ce2Draft) => void
  onHelp: () => void
  onSubmit: () => void
  question: Ce2Question
}>

type DraftEditorProps<Q extends Ce2Question = Ce2Question> = Readonly<{
  draft: Ce2Draft
  locale: Locale
  onChange: (draft: Ce2Draft) => void
  question: Q
}>

const columns: ReadonlyArray<Ce2ColumnName> = ['thousands', 'hundreds', 'tens', 'units']

export function Ce2QuestionCard({
  busy = false,
  disabled = false,
  draft,
  feedback = null,
  locale,
  onDraftChange,
  onHelp,
  onSubmit,
  question,
}: Ce2QuestionCardProps) {
  const t = (
    key: Parameters<typeof ce2Translate>[1],
    values?: Readonly<Record<string, string | number>>,
  ) => ce2Translate(locale, key, values)
  const helpId = useId()
  const feedbackId = useId()
  const [visibleHelpFor, setVisibleHelpFor] = useState<string | null>(
    draft.helpOpened ? question.id : null,
  )
  const helpVisible = visibleHelpFor === question.id
  const locked = busy || disabled || (feedback !== null && feedback.kind !== 'format')
  const expression = expressionFor(question)
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.answer !== null) onSubmit()
  }
  const updateDraft = (next: Ce2Draft) => onDraftChange({ ...next, updatedAt: new Date() })
  const showHelp = () => {
    if (helpVisible) {
      setVisibleHelpFor(null)
      return
    }
    setVisibleHelpFor(question.id)
    if (!draft.helpOpened) {
      onDraftChange({ ...draft, helpOpened: true, updatedAt: new Date() })
      onHelp()
    }
  }

  return (
    <form
      aria-busy={busy}
      aria-describedby={
        [helpVisible ? helpId : '', feedback ? feedbackId : ''].filter(Boolean).join(' ') ||
        undefined
      }
      className="ce2-card"
      onSubmit={submit}
    >
      <header className="ce2-card__heading">
        <p className="ce2-card__prompt">{promptFor(question, locale)}</p>
        {expression === null ? null : (
          <div aria-label={expression.accessible} className="ce2-card__expression">
            {expression.visual}
          </div>
        )}
      </header>

      <fieldset className="ce2-card__stage" disabled={locked}>
        <QuestionEditor draft={draft} locale={locale} onChange={updateDraft} question={question} />
      </fieldset>

      {helpVisible ? (
        <p className="ce2-help" id={helpId}>
          {helpFor(question, locale)}
        </p>
      ) : null}

      {feedback ? (
        <div
          aria-live="polite"
          className={`ce2-feedback ce2-feedback--${feedback.kind}`}
          id={feedbackId}
          role="status"
        >
          <p>
            {feedback.message ??
              t(
                feedback.kind === 'correct'
                  ? 'feedbackCorrect'
                  : feedback.kind === 'format'
                    ? 'feedbackFormat'
                    : 'feedbackIncorrect',
              )}
          </p>
          {feedback.kind === 'incorrect' ? (
            <p className="ce2-feedback__answer">
              <span>{t('correctAnswerLabel')}:</span> {solutionContent(question, locale)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="ce2-card__actions">
        <button
          className="ce2-card__submit"
          disabled={draft.answer === null || locked}
          type="submit"
        >
          {t('check')}
        </button>
        <button
          aria-expanded={helpVisible}
          aria-controls={helpId}
          className="ce2-card__help"
          onClick={showHelp}
          type="button"
        >
          {t(helpVisible ? 'helpClose' : 'help')}
        </button>
      </div>
    </form>
  )
}

function QuestionEditor(props: DraftEditorProps) {
  switch (props.question.family) {
    case 'place-value':
      return <PlaceValueEditor {...props} question={props.question} />
    case 'integer':
      return <IntegerEditor {...props} question={props.question} />
    case 'column':
      return <ColumnEditor {...props} question={props.question} />
    case 'problem':
      return <ProblemEditor {...props} question={props.question} />
    case 'fraction':
      return <FractionEditor {...props} question={props.question} />
    case 'comparison':
      return <ComparisonEditor {...props} question={props.question} />
    case 'ordering':
      return <OrderingEditor {...props} question={props.question} />
    case 'number-line':
      return <NumberLineEditor {...props} question={props.question} />
    case 'length':
      return <LengthEditor {...props} question={props.question} />
  }
}

function PlaceValueEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'place-value') return null
  const current = draft.answer?.type === 'place-value' ? draft.answer : null
  const setPlace = (place: 'hundreds' | 'tens' | 'units', raw: string) => {
    const answer = {
      hundreds: current?.hundreds ?? 0,
      tens: current?.tens ?? 0,
      type: 'place-value' as const,
      units: current?.units ?? 0,
      [place]: parseDigits(raw, 2),
    }
    onChange({ ...draft, answer })
  }
  return (
    <>
      {question.representation === 'blocks' ? <PlaceValueBlocks value={question.value} /> : null}
      <div className="ce2-place-value">
        {(['hundreds', 'tens', 'units'] as const).map((place) => (
          <label className="ce2-place-value__field" key={place}>
            {ce2Translate(locale, place === 'units' ? 'placeOnes' : `place${capitalize(place)}`)}
            <input
              aria-label={ce2Translate(
                locale,
                place === 'units' ? 'placeOnes' : `place${capitalize(place)}`,
              )}
              inputMode="numeric"
              maxLength={2}
              onChange={(event) => setPlace(place, event.target.value)}
              pattern="[0-9]*"
              value={String(current?.[place] ?? '')}
            />
          </label>
        ))}
      </div>
    </>
  )
}

function PlaceValueBlocks({ value }: Readonly<{ value: number }>) {
  const hundreds = Math.floor(value / 100)
  const tens = Math.floor((value % 100) / 10)
  const units = value % 10
  return (
    <div aria-hidden="true" className="ce2-place-blocks">
      {Array.from({ length: hundreds }, (_, index) => (
        <span className="ce2-place-blocks__hundred" key={`h-${index}`} />
      ))}
      {Array.from({ length: tens }, (_, index) => (
        <span className="ce2-place-blocks__ten" key={`t-${index}`} />
      ))}
      {Array.from({ length: units }, (_, index) => (
        <span className="ce2-place-blocks__one" key={`u-${index}`} />
      ))}
    </div>
  )
}

function IntegerEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'integer') return null
  const strategy = draft.helpOpened ? <MentalStrategy locale={locale} question={question} /> : null
  if (question.responseMode === 'choice') {
    return (
      <div className="ce2-integer-entry">
        {strategy}
        <ChoiceEditor
          choices={question.choices}
          draft={draft}
          locale={locale}
          multiple={false}
          onChange={onChange}
        />
      </div>
    )
  }
  return (
    <div className="ce2-integer-entry">
      {strategy}
      <IntegerInput
        answer={draft.answer?.type === 'integer' ? draft.answer.value : null}
        locale={locale}
        maxDigits={question.inputConstraints.maxDigits ?? 4}
        onChange={(value) =>
          onChange({ ...draft, answer: value === null ? null : { type: 'integer', value } })
        }
      />
    </div>
  )
}

function MentalStrategy({
  locale,
  question,
}: Readonly<{ locale: Locale; question: Extract<Ce2Question, { family: 'integer' }> }>) {
  if (question.strategy !== 'compensation') return null
  const rounded = Math.round(question.right / 10) * 10
  const adjustment = Math.abs(rounded - question.right)
  const signs = question.operation === 'add' ? ['+', '−'] : ['−', '+']
  return (
    <div aria-label={helpFor(question, locale)} className="ce2-mental-jumps" role="img">
      <span>{question.left}</span>
      <i>
        {signs[0]} {rounded}
      </i>
      <span>?</span>
      <i>
        {signs[1]} {adjustment}
      </i>
      <strong>?</strong>
    </div>
  )
}

function IntegerInput({
  answer,
  locale,
  maxDigits = 4,
  onChange,
}: Readonly<{
  answer: number | null
  locale: Locale
  maxDigits?: number
  onChange: (value: number | null) => void
}>) {
  const append = (digit: number) => {
    const current = answer === null ? '' : String(answer)
    const next = `${current}${digit}`.slice(0, maxDigits)
    onChange(next.length === 0 ? null : Number(next))
  }
  const remove = () => {
    const next = answer === null ? '' : String(answer).slice(0, -1)
    onChange(next.length === 0 ? null : Number(next))
  }
  return (
    <div className="ce2-integer-entry">
      <label className="ce2-field">
        {ce2Translate(locale, 'answer')}
        <input
          autoComplete="off"
          inputMode="numeric"
          maxLength={maxDigits}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, maxDigits)
            onChange(digits.length === 0 ? null : Number(digits))
          }}
          pattern="[0-9]*"
          value={answer ?? ''}
        />
      </label>
      <div aria-label={ce2Translate(locale, 'answer')} className="ce2-number-keypad" role="group">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button key={digit} onClick={() => append(digit)} type="button">
            {digit}
          </button>
        ))}
        <button aria-label={ce2Translate(locale, 'deleteDigit')} onClick={remove} type="button">
          ⌫
        </button>
        <button onClick={() => append(0)} type="button">
          0
        </button>
      </div>
    </div>
  )
}

function ChoiceEditor({
  choices,
  draft,
  locale,
  maximumSelections,
  multiple,
  onChange,
  partitions,
}: Readonly<{
  choices: ReadonlyArray<Ce2Choice>
  draft: Ce2Draft
  locale: Locale
  maximumSelections?: number
  multiple: boolean
  onChange: (draft: Ce2Draft) => void
  partitions?: ReadonlyArray<Readonly<{ id: string; segmentWeights: ReadonlyArray<number> }>>
}>) {
  const selected = draft.answer?.type === 'selection' ? draft.answer.choiceIds : []
  const selectedSet = new Set(selected)
  const selectedPartIdSet = new Set(draft.selectedPartIds)
  const choose = (choice: Ce2Choice) => {
    if (!multiple) {
      onChange({ ...draft, answer: choice.answer, selectedPartIds: [choice.id] })
      return
    }
    const removing = selectedSet.has(choice.id)
    if (!removing && maximumSelections !== undefined && selected.length >= maximumSelections) return
    const choiceIds = removing
      ? selected.filter((id) => id !== choice.id)
      : [...selected, choice.id]
    onChange({
      ...draft,
      answer: choiceIds.length === 0 ? null : { choiceIds, type: 'selection' },
      selectedPartIds: choiceIds,
    })
  }
  return (
    <div>
      <p className="ce2-selection-hint">
        {ce2Translate(locale, multiple ? 'chooseAll' : 'chooseOne')}
        {multiple ? ` ${ce2Translate(locale, 'multipleSelection')}` : ''}
      </p>
      <div className="ce2-choices">
        {choices.map((choice, choiceIndex) => {
          const pressed = multiple ? selectedSet.has(choice.id) : selectedPartIdSet.has(choice.id)
          const partition = partitions?.find((candidate) => candidate.id === choice.id)
          return (
            <button
              aria-label={
                partition === undefined
                  ? undefined
                  : ce2Translate(locale, 'shapeOption', {
                      option: String.fromCharCode(65 + choiceIndex),
                      widths: partition.segmentWeights.join(', '),
                    })
              }
              aria-pressed={pressed}
              className="ce2-choice"
              key={choice.id}
              onClick={() => choose(choice)}
              type="button"
            >
              {partitions === undefined ? (
                answerContent(choice.answer, choice.label)
              ) : (
                <PartitionChoice weights={partition?.segmentWeights ?? []} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FractionEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'fraction') return null
  const multiple = question.responseMode === 'multi-select'
  if (question.responseMode === 'choice' || multiple) {
    return (
      <div className="ce2-fraction-models">
        {question.task === 'equal-parts'
          ? null
          : identifyRationals(question.operands).map(({ id, rational }) => (
              <FractionModel
                filled={rational.numerator}
                key={`choice-model-${id}`}
                rational={rational}
                representation={question.representation}
              />
            ))}
        <ChoiceEditor
          choices={question.choices}
          draft={draft}
          locale={locale}
          {...(question.inputConstraints.maximumSelections === null
            ? {}
            : { maximumSelections: question.inputConstraints.maximumSelections })}
          multiple={multiple}
          onChange={onChange}
          {...(question.task === 'equal-parts' ? { partitions: question.partitions } : {})}
        />
      </div>
    )
  }
  const model = question.operands[0]
  if (question.task === 'represent' && model) {
    return (
      <SelectableFractionModel
        draft={draft}
        locale={locale}
        onChange={onChange}
        rational={model}
        representation={question.representation}
      />
    )
  }
  const identifiedOperands = identifyRationals(question.operands)
  return (
    <div className="ce2-fraction-models">
      {identifiedOperands.map(({ id, rational }) => (
        <FractionModel
          filled={rational.numerator}
          key={id}
          rational={rational}
          representation={question.representation}
        />
      ))}
      {draft.helpOpened && question.operands.length > 1 ? (
        <CommonPartitionModel operands={question.operands} />
      ) : null}
      <FractionInput
        answer={draft.answer?.type === 'fraction' ? draft.answer : null}
        denominatorMax={question.inputConstraints.denominatorMax ?? 12}
        draft={draft}
        locale={locale}
        numeratorMax={question.inputConstraints.numeratorMax ?? 12}
        onChange={onChange}
      />
    </div>
  )
}

function CommonPartitionModel({ operands }: Readonly<{ operands: ReadonlyArray<Ce2Rational> }>) {
  const denominator = Math.max(...operands.map((operand) => operand.denominator))
  return (
    <div className="ce2-common-partition">
      {identifyRationals(operands).map(({ id, rational: operand }) => {
        const numerator = operand.numerator * (denominator / operand.denominator)
        return (
          <FractionModel
            filled={numerator}
            key={`common-${id}`}
            rational={{ denominator, numerator }}
            representation="bar"
          />
        )
      })}
    </div>
  )
}

function FractionInput({
  answer,
  denominatorMax,
  draft,
  locale,
  numeratorMax,
  onChange,
}: Readonly<{
  answer: Extract<Ce2Answer, { type: 'fraction' }> | null
  denominatorMax: number
  draft: Ce2Draft
  locale: Locale
  numeratorMax: number
  onChange: (draft: Ce2Draft) => void
}>) {
  const numerator = numericEntry(draft.columnEntries, 'fraction-numerator', answer?.numerator)
  const denominator = numericEntry(draft.columnEntries, 'fraction-denominator', answer?.denominator)
  const update = (key: 'fraction-denominator' | 'fraction-numerator', value?: number) => {
    const columnEntries = setNumericEntry(draft.columnEntries, key, value)
    const nextNumerator = numericEntry(columnEntries, 'fraction-numerator', answer?.numerator)
    const nextDenominator = numericEntry(columnEntries, 'fraction-denominator', answer?.denominator)
    onChange({
      ...draft,
      answer:
        nextNumerator === undefined || nextDenominator === undefined || nextDenominator === 0
          ? null
          : {
              denominator: Math.min(denominatorMax, nextDenominator),
              numerator: Math.min(numeratorMax, nextNumerator),
              type: 'fraction',
            },
      columnEntries,
    })
  }
  return (
    <div>
      <div className="ce2-fraction-entry">
        <label className="ce2-field">
          {ce2Translate(locale, 'numerator')}
          <input
            inputMode="numeric"
            maxLength={2}
            onChange={(event) =>
              update('fraction-numerator', parseOptionalDigits(event.target.value, 2))
            }
            pattern="[0-9]*"
            value={numerator ?? ''}
          />
        </label>
        <label className="ce2-field">
          {ce2Translate(locale, 'denominator')}
          <input
            inputMode="numeric"
            maxLength={2}
            onChange={(event) =>
              update('fraction-denominator', parseOptionalDigits(event.target.value, 2))
            }
            pattern="[0-9]*"
            value={denominator ?? ''}
          />
        </label>
        <span aria-hidden="true" className="ce2-fraction-entry__bar" />
      </div>
      <p className="ce2-entry-hint">{ce2Translate(locale, 'fractionEntryHint')}</p>
    </div>
  )
}

function SelectableFractionModel({
  draft,
  locale,
  onChange,
  rational,
  representation,
}: Readonly<{
  draft: Ce2Draft
  locale: Locale
  onChange: (draft: Ce2Draft) => void
  rational: Ce2Rational
  representation: Ce2Question['representation']
}>) {
  const toggle = (id: string) => {
    const selectedPartIds = draft.selectedPartIds.includes(id)
      ? draft.selectedPartIds.filter((partId) => partId !== id)
      : [...draft.selectedPartIds, id]
    onChange({
      ...draft,
      answer: {
        denominator: rational.denominator,
        numerator: selectedPartIds.length,
        type: 'fraction',
      },
      selectedPartIds,
    })
  }
  const disc = representation === 'disk'
  const partIds = fractionPartIds(rational.denominator)
  const selectedIds = new Set(draft.selectedPartIds)
  return (
    <div>
      {disc ? (
        <DiscModel
          denominator={rational.denominator}
          selected={draft.selectedPartIds.map((id) => Number(id.replace('part-', '')))}
        />
      ) : null}
      <div
        aria-label={ce2Translate(locale, 'selectedCount', {
          selected: draft.selectedPartIds.length,
          total: rational.denominator,
        })}
        className={disc ? 'ce2-part-selector' : 'ce2-band'}
        role="group"
        style={
          {
            '--ce2-disc-columns': Math.min(4, rational.denominator),
            '--ce2-parts': rational.denominator,
          } as CSSProperties
        }
      >
        {partIds.map((id) => {
          const index = Number(id.slice('part-'.length))
          const pressed = selectedIds.has(id)
          return (
            <button
              aria-label={ce2Translate(locale, pressed ? 'partSelected' : 'partUnselected', {
                part: index + 1,
                total: rational.denominator,
              })}
              aria-pressed={pressed}
              className={disc ? 'ce2-part-selector__button' : 'ce2-part'}
              key={id}
              onClick={() => toggle(id)}
              type="button"
            />
          )
        })}
      </div>
      <p className="ce2-unit-label">{ce2Translate(locale, 'unitReference')}</p>
    </div>
  )
}

function FractionModel({
  filled,
  rational,
  representation,
}: Readonly<{
  filled: number
  rational: Ce2Rational
  representation: Ce2Question['representation']
}>) {
  const disc = representation === 'disk'
  if (disc) {
    return (
      <DiscModel
        denominator={rational.denominator}
        label={`${filled}/${rational.denominator}`}
        selected={Array.from({ length: filled }, (_, index) => index)}
      />
    )
  }
  return (
    <div
      aria-label={`${filled}/${rational.denominator}`}
      className="ce2-band"
      role="img"
      style={
        {
          '--ce2-disc-columns': Math.min(4, rational.denominator),
          '--ce2-parts': rational.denominator,
        } as CSSProperties
      }
    >
      {Array.from({ length: rational.denominator }, (_, index) => (
        <span className={index < filled ? 'ce2-part ce2-part--filled' : 'ce2-part'} key={index} />
      ))}
    </div>
  )
}

function DiscModel({
  denominator,
  label,
  selected,
}: Readonly<{ denominator: number; label?: string; selected: ReadonlyArray<number> }>) {
  const partIds = fractionPartIds(denominator)
  const selectedParts = new Set(selected)
  return (
    <svg aria-label={label} className="ce2-disc-model" role="img" viewBox="0 0 120 120">
      {partIds.map((id) => {
        const index = Number(id.slice('part-'.length))
        return (
          <path
            className={selectedParts.has(index) ? 'ce2-disc-model__part--filled' : undefined}
            d={sectorPath(index, denominator)}
            key={id}
          />
        )
      })}
    </svg>
  )
}

function PartitionChoice({ weights }: Readonly<{ weights: ReadonlyArray<number> }>) {
  const safeWeights = weights.length > 0 ? weights : [1, 1, 1, 1]
  return (
    <span
      aria-hidden="true"
      className="ce2-partition-choice"
      style={{ gridTemplateColumns: safeWeights.map((weight) => `${weight}fr`).join(' ') }}
    >
      {safeWeights.map((_, part) => (
        <i key={part} />
      ))}
    </span>
  )
}

function ComparisonEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'comparison') return null
  const selected = draft.answer?.type === 'comparison' ? draft.answer.relation : null
  return (
    <div>
      <div className="ce2-fraction-models">
        <FractionModel
          filled={question.left.numerator}
          rational={question.left}
          representation="bar"
        />
        <FractionModel
          filled={question.right.numerator}
          rational={question.right}
          representation="bar"
        />
      </div>
      <div className="ce2-relations" role="group">
        {(
          [
            ['less', '<'],
            ['equal', '='],
            ['greater', '>'],
          ] as const
        ).map(([relation, symbol]) => (
          <button
            aria-label={ce2Translate(locale, relation)}
            aria-pressed={selected === relation}
            className="ce2-relation"
            key={relation}
            onClick={() => onChange({ ...draft, answer: { relation, type: 'comparison' } })}
            type="button"
          >
            {symbol}
          </button>
        ))}
      </div>
    </div>
  )
}

function OrderingEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'ordering') return null
  const orderedIds =
    draft.orderedIds.length > 0 ? draft.orderedIds : question.items.map(({ id }) => id)
  const move = (id: string, direction: -1 | 1) => {
    const from = orderedIds.indexOf(id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= orderedIds.length) return
    const next = [...orderedIds]
    const [item] = next.splice(from, 1)
    if (item === undefined) return
    next.splice(to, 0, item)
    onChange({ ...draft, answer: { orderedIds: next, type: 'ordering' }, orderedIds: next })
  }
  return (
    <div className="ce2-ordering">
      <p>{ce2Translate(locale, 'smallestToLargest')}</p>
      <ol>
        {orderedIds.map((id, index) => {
          const item = question.items.find((candidate) => candidate.id === id)
          if (item === undefined) return null
          const fraction = `${item.value.numerator}/${item.value.denominator}`
          return (
            <li key={id}>
              <Fraction rational={item.value} />
              <span className="ce2-ordering__controls">
                <button
                  aria-label={ce2Translate(locale, 'moveEarlier', { fraction })}
                  disabled={index === 0}
                  onClick={() => move(id, -1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={ce2Translate(locale, 'moveLater', { fraction })}
                  disabled={index === orderedIds.length - 1}
                  onClick={() => move(id, 1)}
                  type="button"
                >
                  ↓
                </button>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function NumberLineEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'number-line') return null
  const tick = draft.answer?.type === 'number-line' ? draft.answer.tick : 0
  const total = question.tickCount
  const tickIds = Array.from({ length: total + 1 }, (_, tickIndex) => `tick-${tickIndex}`)
  const setTick = (next: number) =>
    onChange({
      ...draft,
      answer: { tick: Math.max(0, Math.min(total, next)), type: 'number-line' },
    })
  const markerX = 16 + (tick / total) * 288
  return (
    <div className="ce2-line">
      <svg
        aria-label={ce2Translate(locale, 'lineCurrent', { current: tick, total })}
        className="ce2-line__svg"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 320 104"
      >
        <line className="ce2-line__axis" x1="16" x2="304" y1="58" y2="58" />
        {Array.from({ length: total + 1 }, (_, index) => {
          const x = 16 + (index / total) * 288
          return (
            <g key={index}>
              <line className="ce2-line__tick" x1={x} x2={x} y1="48" y2="68" />
              <text textAnchor="middle" x={x} y="88">
                {index === 0 ? '0' : index === total ? '1' : ''}
              </text>
            </g>
          )
        })}
        <circle className="ce2-line__marker" cx={markerX} cy="34" r="9" />
      </svg>
      <div className="ce2-line__controls">
        <button
          aria-label={ce2Translate(locale, 'linePrevious')}
          className="ce2-line-control"
          disabled={tick === 0}
          onClick={() => setTick(tick - 1)}
          type="button"
        >
          −
        </button>
        <p className="ce2-line-value">
          {ce2Translate(locale, 'lineCurrent', { current: tick, total })}
        </p>
        <button
          aria-label={ce2Translate(locale, 'lineNext')}
          className="ce2-line-control"
          disabled={tick === total}
          onClick={() => setTick(tick + 1)}
          type="button"
        >
          +
        </button>
      </div>
      <div
        aria-label={ce2Translate(locale, 'answer')}
        className="ce2-line__ticks"
        role="group"
        style={{ '--ce2-ticks': total + 1 } as CSSProperties}
      >
        {tickIds.map((id) => {
          const index = Number(id.slice('tick-'.length))
          return (
            <button
              aria-label={`${index}/${total}`}
              aria-pressed={tick === index}
              key={id}
              onClick={() => setTick(index)}
              type="button"
            >
              {index}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LengthEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'length') return null
  const current = draft.answer?.type === 'length' ? draft.answer : null
  const whole = numericEntry(draft.columnEntries, 'length-whole', current?.whole)
  const numerator = numericEntry(draft.columnEntries, 'length-numerator', current?.numerator)
  const denominator = numericEntry(draft.columnEntries, 'length-denominator', current?.denominator)
  const set = (key: 'length-denominator' | 'length-numerator' | 'length-whole', value?: number) => {
    const columnEntries = setNumericEntry(draft.columnEntries, key, value)
    const nextWhole = numericEntry(columnEntries, 'length-whole', current?.whole)
    const nextNumerator = numericEntry(columnEntries, 'length-numerator', current?.numerator)
    const nextDenominator = numericEntry(columnEntries, 'length-denominator', current?.denominator)
    onChange({
      ...draft,
      answer:
        nextWhole === undefined ||
        nextNumerator === undefined ||
        nextDenominator === undefined ||
        nextDenominator === 0
          ? null
          : {
              denominator: Math.min(
                question.inputConstraints.denominatorMax ?? 12,
                nextDenominator,
              ),
              numerator: Math.min(question.inputConstraints.numeratorMax ?? 12, nextNumerator),
              type: 'length',
              whole: nextWhole,
            },
      columnEntries,
    })
  }
  return (
    <div className="ce2-unit-strip">
      <div className="ce2-unit-strip__units" role="img">
        {Array.from({ length: question.wholeUnits + 1 }, (_, index) => (
          <span
            className={`ce2-unit-strip__unit${
              index < question.wholeUnits
                ? ' ce2-unit-strip__unit--filled'
                : ' ce2-unit-strip__unit--partial'
            }`}
            key={index}
            style={
              index === question.wholeUnits
                ? ({ '--ce2-parts': question.fraction.denominator } as CSSProperties)
                : undefined
            }
          >
            {index === question.wholeUnits
              ? Array.from({ length: question.fraction.denominator }, (_, part) => (
                  <i
                    className={
                      part < question.fraction.numerator ? 'ce2-unit-strip__part--filled' : ''
                    }
                    key={`length-part-${part + 1}`}
                  />
                ))
              : null}
          </span>
        ))}
      </div>
      <p className="ce2-unit-label">{ce2Translate(locale, 'unitReference')}</p>
      <div className="ce2-length-entry">
        <NumberField
          label={ce2Translate(locale, 'lengthWhole')}
          onChange={(value) => set('length-whole', value)}
          value={whole}
        />
        <NumberField
          label={ce2Translate(locale, 'numeratorShort')}
          onChange={(value) => set('length-numerator', value)}
          value={numerator}
        />
        <NumberField
          label={ce2Translate(locale, 'denominatorShort')}
          onChange={(value) => set('length-denominator', value)}
          value={denominator}
        />
      </div>
    </div>
  )
}

function NumberField({
  label,
  maxDigits = 2,
  onChange,
  value,
}: Readonly<{
  label: string
  maxDigits?: number
  onChange: (value: number | undefined) => void
  value: number | undefined
}>) {
  return (
    <label className="ce2-field">
      {label}
      <input
        inputMode="numeric"
        maxLength={maxDigits}
        onChange={(event) => onChange(parseOptionalDigits(event.target.value, maxDigits))}
        pattern="[0-9]*"
        value={value ?? ''}
      />
    </label>
  )
}

function ColumnEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'column') return null
  const showThousands = question.left + (question.operation === 'add' ? question.right : 0) >= 1000
  const visibleColumns = showThousands ? columns : columns.slice(1)
  const activeColumn = draft.activeColumn ?? 'units'
  const activeIndex = visibleColumns.indexOf(activeColumn)
  const carryColumn = visibleColumns[Math.max(0, activeIndex - 1)] ?? activeColumn
  const operandRows =
    question.mode === 'autonomous'
      ? [['left', question.left] as const, ['right', question.right] as const]
      : []
  const setEntry = (key: string, digit: number) => {
    const columnEntries = { ...draft.columnEntries, [key]: digit }
    const answer = columnAnswer(columnEntries, visibleColumns, question)
    onChange({ ...draft, activeColumn, answer, columnEntries })
  }
  const activeKey = `result-${activeColumn}`
  const toggleMethod = () => {
    const freeMode = !draft.freeMode
    onChange({
      ...draft,
      answer:
        freeMode && draft.answer?.type === 'column'
          ? { ...draft.answer, alignment: [] }
          : draft.answer,
      freeMode,
      switchedToFree: draft.switchedToFree || !draft.freeMode,
    })
  }
  if (draft.freeMode) {
    return (
      <div className="ce2-column">
        <button className="ce2-method-toggle" onClick={toggleMethod} type="button">
          {ce2Translate(locale, 'guidedMethod')}
        </button>
        <IntegerInput
          answer={draft.answer?.type === 'column' ? draft.answer.value : null}
          locale={locale}
          maxDigits={question.inputConstraints.maxDigits ?? 4}
          onChange={(value) =>
            onChange({
              ...draft,
              answer:
                value === null
                  ? null
                  : {
                      alignment: [],
                      type: 'column',
                      value,
                    },
            })
          }
        />
      </div>
    )
  }
  return (
    <div className="ce2-column">
      <button className="ce2-method-toggle" onClick={toggleMethod} type="button">
        {ce2Translate(locale, 'freeMethod')}
      </button>
      <div
        className="ce2-column__grid"
        style={{ '--ce2-columns': visibleColumns.length } as CSSProperties}
      >
        <span />
        {visibleColumns.map((column) => (
          <span className="ce2-column__label" key={column}>
            {columnInitial(column, locale)}
            <span className="sr-only">{columnLabel(column, locale)}</span>
          </span>
        ))}
        <span />
        {visibleColumns.map((column) => (
          <span className="ce2-column__digit" key={`carry-${column}`}>
            {draft.carries[column] ?? draft.borrows[column] ?? ''}
          </span>
        ))}
        {question.mode === 'guided' ? (
          <>
            <span />
            {visibleColumns.map((column) => (
              <span className="ce2-column__digit" key={`left-${column}`}>
                {digitAt(question.left, column, showThousands)}
              </span>
            ))}
            <span className="ce2-column__operator">{question.operation === 'add' ? '+' : '−'}</span>
            {visibleColumns.map((column) => (
              <span className="ce2-column__digit" key={`right-${column}`}>
                {digitAt(question.right, column, showThousands)}
              </span>
            ))}
          </>
        ) : (
          operandRows.flatMap(([operand]) => [
            <span className="ce2-column__operator" key={`${operand}-operator`}>
              {operand === 'right' ? (question.operation === 'add' ? '+' : '−') : ''}
            </span>,
            ...visibleColumns.map((column) => {
              const key = `${operand}-${column}`
              return (
                <button
                  aria-label={`${ce2Translate(
                    locale,
                    operand === 'left' ? 'upperNumber' : 'lowerNumber',
                  )}, ${columnLabel(column, locale)}`}
                  aria-pressed={
                    draft.activeColumn === column && draft.selectedPartIds[0] === operand
                  }
                  className="ce2-column-cell"
                  key={key}
                  onClick={() =>
                    onChange({ ...draft, activeColumn: column, selectedPartIds: [operand] })
                  }
                  type="button"
                >
                  {draft.columnEntries[key] ?? ''}
                </button>
              )
            }),
          ])
        )}
        <span className="ce2-column__rule" />
        <span />
        {visibleColumns.map((column) => {
          const key = `result-${column}`
          return (
            <button
              aria-label={`${ce2Translate(locale, 'result')}, ${columnLabel(column, locale)}`}
              aria-pressed={
                activeColumn === column &&
                draft.selectedPartIds[0] !== 'left' &&
                draft.selectedPartIds[0] !== 'right'
              }
              className="ce2-column-cell"
              key={key}
              onClick={() => onChange({ ...draft, activeColumn: column, selectedPartIds: [] })}
              type="button"
            >
              {draft.columnEntries[key] ?? ''}
            </button>
          )
        })}
      </div>
      <div className="ce2-column__keypad" role="group">
        {Array.from({ length: 10 }, (_, digit) => (
          <button
            key={digit}
            onClick={() => {
              const operand = draft.selectedPartIds[0]
              const key =
                operand === 'left' || operand === 'right' ? `${operand}-${activeColumn}` : activeKey
              setEntry(key, digit)
            }}
            type="button"
          >
            {digit}
          </button>
        ))}
      </div>
      <div className="ce2-exchanges">
        {question.requiresCarry ? (
          <button
            aria-pressed={(draft.carries[carryColumn] ?? 0) > 0}
            className="ce2-exchange"
            onClick={() =>
              onChange({
                ...draft,
                carries: { ...draft.carries, [carryColumn]: draft.carries[carryColumn] ? 0 : 1 },
              })
            }
            type="button"
          >
            {ce2Translate(locale, draft.carries[carryColumn] ? 'carried' : 'carry')}
          </button>
        ) : null}
        {question.requiresExchange ? (
          <button
            aria-pressed={(draft.borrows[activeColumn] ?? 0) > 0}
            className="ce2-exchange"
            onClick={() =>
              onChange({
                ...draft,
                borrows: { ...draft.borrows, [activeColumn]: draft.borrows[activeColumn] ? 0 : 1 },
              })
            }
            type="button"
          >
            {ce2Translate(locale, draft.borrows[activeColumn] ? 'borrowed' : 'borrow')}
          </button>
        ) : null}
      </div>
      {question.zeroBridge && draft.helpOpened ? (
        <ZeroBridgeExchange locale={locale} value={question.left} />
      ) : null}
    </div>
  )
}

function ZeroBridgeExchange({ locale, value }: Readonly<{ locale: Locale; value: number }>) {
  const hundreds = Math.floor(value / 100)
  const tens = Math.floor((value % 100) / 10)
  const units = value % 10
  return (
    <div aria-label={helpForZeroBridge(locale)} className="ce2-exchange-story" role="img">
      <span>
        {hundreds}C · {tens}D · {units}U
      </span>
      <b>→</b>
      <span>
        {hundreds - 1}C · {tens + 10}D · {units}U
      </span>
      <b>→</b>
      <span>
        {hundreds - 1}C · {tens + 9}D · {units + 10}U
      </span>
    </div>
  )
}

function ProblemEditor({ draft, locale, onChange, question }: DraftEditorProps) {
  if (question.family !== 'problem') return null
  if (question.solution.type === 'problem' && question.skill === 'P1') {
    if (question.choices.length > 0) {
      return (
        <div className="ce2-problem">
          <p className="ce2-problem__story">{storyFor(question, locale)}</p>
          <PartWholeModel values={question.values} />
          <ChoiceEditor
            choices={question.choices}
            draft={draft}
            locale={locale}
            multiple={false}
            onChange={onChange}
          />
        </div>
      )
    }
    const current = draft.answer?.type === 'problem' ? draft.answer : null
    const updateProblem = (patch: Partial<Extract<Ce2Answer, { type: 'problem' }>>) =>
      onChange({
        ...draft,
        answer: {
          intermediateResults: current?.intermediateResults ?? [],
          operation: current?.operation ?? null,
          type: 'problem',
          value: current?.value ?? null,
          ...patch,
        },
      })
    return (
      <div className="ce2-problem">
        <p className="ce2-problem__story">{storyFor(question, locale)}</p>
        <PartWholeModel values={question.values} />
        <div className="ce2-operation-choices">
          {(['add', 'subtract'] as const).map((operation) => (
            <button
              aria-pressed={current?.operation === operation}
              className="ce2-choice"
              key={operation}
              onClick={() => updateProblem({ operation })}
              type="button"
            >
              {operation === 'add' ? '+ ' : '− '}
              {ce2Translate(locale, operation === 'add' ? 'operationAdd' : 'operationSubtract')}
            </button>
          ))}
        </div>
        <IntegerInput
          answer={current?.value ?? null}
          locale={locale}
          maxDigits={question.inputConstraints.maxDigits ?? 4}
          onChange={(value) => updateProblem({ value })}
        />
      </div>
    )
  }
  if (question.solution.type === 'fraction') {
    return (
      <div className="ce2-problem">
        <p className="ce2-problem__story">{storyFor(question, locale)}</p>
        {question.values.length >= 3 ? (
          <div className="ce2-fraction-models">
            {[question.values[0] ?? 0, question.values[1] ?? 0].map((numerator, index) => (
              <FractionModel
                filled={numerator}
                key={`problem-fraction-${index + 1}`}
                rational={{ denominator: question.values[2] ?? 1, numerator }}
                representation="bar"
              />
            ))}
          </div>
        ) : null}
        <FractionInput
          answer={draft.answer?.type === 'fraction' ? draft.answer : null}
          denominatorMax={question.inputConstraints.denominatorMax ?? 12}
          draft={draft}
          locale={locale}
          numeratorMax={question.inputConstraints.numeratorMax ?? 12}
          onChange={onChange}
        />
      </div>
    )
  }
  const stepCount = Math.max(1, question.operations.length)
  return (
    <div className="ce2-problem">
      <p className="ce2-problem__story">{storyFor(question, locale)}</p>
      {Array.from({ length: stepCount }, (_, index) => {
        const key = `problem-${index}`
        const final = index === stepCount - 1
        return (
          <fieldset className="ce2-problem__step" key={key}>
            <legend>{ce2Translate(locale, 'problemStep', { step: index + 1 })}</legend>
            <NumberField
              label={final ? ce2Translate(locale, 'result') : ce2Translate(locale, 'answer')}
              maxDigits={question.inputConstraints.maxDigits ?? 4}
              onChange={(value) => {
                const columnEntries = setNumericEntry(draft.columnEntries, key, value)
                const firstStep = columnEntries['problem-0']
                const finalStep = columnEntries[`problem-${stepCount - 1}`]
                onChange({
                  ...draft,
                  answer:
                    firstStep === undefined || finalStep === undefined
                      ? null
                      : {
                          intermediateResults: [firstStep],
                          operation: null,
                          type: 'problem',
                          value: finalStep,
                        },
                  columnEntries,
                })
              }}
              value={draft.columnEntries[key]}
            />
          </fieldset>
        )
      })}
    </div>
  )
}

function PartWholeModel({ values }: Readonly<{ values: ReadonlyArray<number> }>) {
  return (
    <div aria-hidden="true" className="ce2-part-whole">
      <span>{values[0] ?? '?'}</span>
      <span>{values[1] ?? '?'}</span>
      <strong>?</strong>
    </div>
  )
}

function columnAnswer(
  entries: Readonly<Record<string, number>>,
  visibleColumns: ReadonlyArray<Ce2ColumnName>,
  question: Extract<Ce2Question, { family: 'column' }>,
): Extract<Ce2Answer, { type: 'column' }> | null {
  const resultDigits = visibleColumns.map((column) => entries[`result-${column}`])
  if (resultDigits.some((digit) => digit === undefined)) return null
  if (
    question.mode === 'autonomous' &&
    question.solution.alignment.some(
      ({ column, operand }) => entries[`${operand}-${column}`] === undefined,
    )
  ) {
    return null
  }
  const value = Number(resultDigits.join(''))
  const alignment = question.mode === 'autonomous' ? columnAlignment(entries, visibleColumns) : []
  return { alignment, type: 'column', value }
}

function columnAlignment(
  entries: Readonly<Record<string, number>>,
  visibleColumns: ReadonlyArray<Ce2ColumnName>,
): Extract<Ce2Answer, { type: 'column' }>['alignment'] {
  return (['left', 'right'] as const).flatMap((operand) =>
    visibleColumns.flatMap((column) => {
      const digit = entries[`${operand}-${column}`]
      return digit === undefined ? [] : [{ column, digit, operand }]
    }),
  )
}

function expressionFor(question: Ce2Question): { accessible: string; visual: ReactNode } | null {
  if (question.family === 'integer' || question.family === 'column') {
    const operator = question.operation === 'add' ? '+' : '−'
    return {
      accessible: `${question.left} ${operator} ${question.right}`,
      visual: `${question.left} ${operator} ${question.right}`,
    }
  }
  if (question.family === 'place-value') {
    return { accessible: String(question.value), visual: question.value }
  }
  if (question.family === 'comparison') {
    return {
      accessible: `${question.left.numerator}/${question.left.denominator}, ${question.right.numerator}/${question.right.denominator}`,
      visual: (
        <>
          <Fraction rational={question.left} /> ? <Fraction rational={question.right} />
        </>
      ),
    }
  }
  if (question.family === 'number-line') {
    return {
      accessible: `${question.target.numerator}/${question.target.denominator}`,
      visual: <Fraction rational={question.target} />,
    }
  }
  if (
    question.family === 'fraction' &&
    question.operands.length > 0 &&
    question.task !== 'equal-parts' &&
    !(question.task === 'represent' && question.responseMode === 'choice')
  ) {
    const operator = question.task === 'add' ? '+' : question.task === 'subtract' ? '−' : null
    const visual = identifyRationals(question.operands).map(({ id, rational: operand }, index) => (
      <span key={id}>
        {index > 0 && operator ? ` ${operator} ` : null}
        <Fraction rational={operand} />
      </span>
    ))
    return {
      accessible: question.operands
        .map((operand) => `${operand.numerator}/${operand.denominator}`)
        .join(operator ? ` ${operator} ` : ', '),
      visual,
    }
  }
  return null
}

function Fraction({ rational }: Readonly<{ rational: Ce2Rational }>) {
  return (
    <span aria-label={`${rational.numerator}/${rational.denominator}`} className="ce2-fraction">
      <span>{rational.numerator}</span>
      <span>{rational.denominator}</span>
    </span>
  )
}

function answerContent(answer: Ce2Answer, fallback: string): ReactNode {
  switch (answer.type) {
    case 'integer':
      return answer.value
    case 'fraction':
      return <Fraction rational={answer} />
    case 'comparison':
      return answer.relation === 'less' ? '<' : answer.relation === 'equal' ? '=' : '>'
    case 'operation':
      return answer.operation === 'add' ? '+' : '−'
    case 'length':
      return (
        <>
          {answer.whole} + <Fraction rational={answer} />
        </>
      )
    case 'column':
      return answer.value
    case 'number-line':
      return answer.tick
    case 'place-value':
      return `${answer.hundreds} · ${answer.tens} · ${answer.units}`
    default:
      return fallback
  }
}

function solutionContent(question: Ce2Question, locale: Locale): ReactNode {
  if (question.family === 'fraction' && question.task === 'equal-parts') {
    return ce2Translate(locale, 'correctEqualShape')
  }
  if (question.family === 'ordering') {
    return question.solution.orderedIds.map((id, index) => {
      const item = question.items.find((candidate) => candidate.id === id)
      return item === undefined ? null : (
        <span key={id}>
          {index > 0 ? ' < ' : null}
          <Fraction rational={item.value} />
        </span>
      )
    })
  }
  if (question.solution.type === 'problem') {
    if (question.solution.value !== null) return question.solution.value
    return question.solution.operation === 'add' ? '+' : '−'
  }
  return answerContent(question.solution, ce2Translate(locale, 'correctAnswerLabel'))
}

function helpFor(question: Ce2Question, locale: Locale): string {
  if (question.family === 'integer' && question.strategy === 'compensation') {
    const rounded = Math.round(question.right / 10) * 10
    const adjustment = Math.abs(rounded - question.right)
    const firstSign = question.operation === 'add' ? '+' : '−'
    const secondSign = question.operation === 'add' ? '−' : '+'
    return {
      en: `Use a round number: ${firstSign}${rounded}, then ${secondSign}${adjustment}.`,
      fr: `Utilise un nombre rond : ${firstSign}${rounded}, puis ${secondSign}${adjustment}.`,
      'zh-Hans': `先用整十数：${firstSign}${rounded}，再 ${secondSign}${adjustment}。`,
    }[locale]
  }
  if (
    question.family === 'fraction' &&
    question.operands.length > 1 &&
    new Set(question.operands.map(({ denominator }) => denominator)).size > 1
  ) {
    const denominator = Math.max(...question.operands.map((operand) => operand.denominator))
    return {
      en: `Repartition both strips into ${denominator} equal parts before calculating.`,
      fr: `Repartage les deux bandes en ${denominator} parts égales avant de calculer.`,
      'zh-Hans': `先把两个条形图都平均分成 ${denominator} 份，再计算。`,
    }[locale]
  }
  if (question.family === 'column' && question.zeroBridge) return helpForZeroBridge(locale)
  const copy: Record<Locale, Record<Ce2Question['family'], string>> = {
    en: {
      column:
        question.family === 'column' && question.operation === 'subtract'
          ? 'Start with the ones. If there are not enough, exchange one ten for ten ones.'
          : 'Start with the ones. Write a carry above the next column when ten are regrouped.',
      comparison: 'Use bands of the same length. Compare how much of the unit is filled.',
      fraction: 'The denominator counts all equal parts. The numerator counts the parts taken.',
      integer: 'Break the number into hundreds, tens and ones, or pass through a round number.',
      length: 'Count the complete reference units, then the equal parts of the next unit.',
      'number-line': 'The spaces are equal. Count the intervals from 0, one tick at a time.',
      ordering: 'Compare the fractions, then move each one from the smallest to the largest.',
      'place-value': 'A hundred is ten tens. A ten is ten ones.',
      problem: 'Find what changes in the story, then choose the operation for each step.',
    },
    fr: {
      column:
        question.family === 'column' && question.operation === 'subtract'
          ? 'Commence par les unités. S’il n’y en a pas assez, échange une dizaine contre dix unités.'
          : 'Commence par les unités. Écris une retenue au-dessus de la colonne suivante quand tu regroupes dix.',
      comparison: 'Utilise des bandes de même longueur. Compare la partie remplie de l’unité.',
      fraction:
        'Le dénominateur compte toutes les parts égales. Le numérateur compte les parts prises.',
      integer: 'Décompose en centaines, dizaines et unités, ou passe par un nombre rond.',
      length: 'Compte les unités de référence entières, puis les parts égales de l’unité suivante.',
      'number-line': 'Les intervalles sont égaux. Compte-les depuis 0, graduation par graduation.',
      ordering: 'Compare les fractions, puis range-les de la plus petite à la plus grande.',
      'place-value': 'Une centaine, c’est dix dizaines. Une dizaine, c’est dix unités.',
      problem: 'Repère ce qui change dans l’histoire, puis choisis l’opération de chaque étape.',
    },
    'zh-Hans': {
      column:
        question.family === 'column' && question.operation === 'subtract'
          ? '从个位开始。不够减时，把一个十换成十个一。'
          : '从个位开始。凑成十时，在下一位上方写进位。',
      comparison: '使用同样长的条形图，比较单位中涂色的部分。',
      fraction: '分母表示平均分成的总份数，分子表示取走的份数。',
      integer: '把数拆成百、十和个，或者先算到一个整十数。',
      length: '先数完整的参考单位，再数下一个单位中的等份。',
      'number-line': '每段距离相等。从 0 开始，一格一格地数。',
      ordering: '比较这些分数，再从小到大排列。',
      'place-value': '一百等于十个十，一十等于十个一。',
      problem: '找出故事中发生的变化，再为每一步选择运算。',
    },
  }
  return copy[locale][question.family]
}

function helpForZeroBridge(locale: Locale): string {
  return {
    en: 'Exchange one hundred for ten tens, then one ten for ten ones.',
    fr: 'Échange une centaine contre dix dizaines, puis une dizaine contre dix unités.',
    'zh-Hans': '把一个百换成十个十，再把一个十换成十个一。',
  }[locale]
}

function promptFor(question: Ce2Question, locale: Locale): string {
  if (!question.prompt.startsWith('ce2.')) return question.prompt
  const equalPartCount =
    question.family === 'fraction' ? question.operands[0]?.denominator : undefined
  const prompts: Record<Locale, Partial<Record<Ce2Question['skill'], string>>> = {
    en: {
      A1: 'Calculate.',
      A2: 'Calculate.',
      A3: 'Calculate.',
      A4: 'Calculate.',
      A5: 'Set out the addition and calculate.',
      F1: `Which shape is divided into ${equalPartCount} equal parts?`,
      F2: question.requiredDenominator
        ? `Write the amount in ${question.requiredDenominator} equal parts.`
        : 'Read or show the fraction.',
      F3: 'Find the fraction that shows the same amount.',
      F4: 'Compare the two fractions.',
      F5: 'Place the fraction on the number line.',
      F6: 'Measure using the reference unit.',
      F7: 'Calculate with the equal parts.',
      F8: 'Repartition, then calculate.',
      F9: 'Solve the fraction problem.',
      N1: 'Break the number into hundreds, tens and ones.',
      P1: 'Which operation tells the story?',
      P2: 'Solve the problem in two steps.',
      S1: 'Calculate.',
      S2: 'Calculate.',
      S3: 'Calculate.',
      S4: 'Calculate.',
      S5: 'Set out the subtraction and calculate.',
    },
    fr: {
      A1: 'Calcule.',
      A2: 'Calcule.',
      A3: 'Calcule.',
      A4: 'Calcule.',
      A5: 'Pose l’addition puis calcule.',
      F1: `Quelle forme est partagée en ${equalPartCount} parts égales ?`,
      F2: question.requiredDenominator
        ? `Écris la quantité en ${question.requiredDenominator} parts égales.`
        : 'Lis ou représente la fraction.',
      F3: 'Trouve la fraction qui représente la même quantité.',
      F4: 'Compare les deux fractions.',
      F5: 'Place la fraction sur la graduation.',
      F6: 'Mesure avec l’unité de référence.',
      F7: 'Calcule avec les parts égales.',
      F8: 'Repartage, puis calcule.',
      F9: 'Résous le problème de fractions.',
      N1: 'Décompose en centaines, dizaines et unités.',
      P1: 'Quelle opération raconte l’histoire ?',
      P2: 'Résous le problème en deux étapes.',
      S1: 'Calcule.',
      S2: 'Calcule.',
      S3: 'Calcule.',
      S4: 'Calcule.',
      S5: 'Pose la soustraction puis calcule.',
    },
    'zh-Hans': {
      A1: '计算。',
      A2: '计算。',
      A3: '计算。',
      A4: '计算。',
      A5: '列竖式并计算。',
      F1: `哪个图形被平均分成 ${equalPartCount} 份？`,
      F2: question.requiredDenominator
        ? `请用 ${question.requiredDenominator} 个等份表示这个数量。`
        : '读出或表示这个分数。',
      F3: '找出表示相同数量的分数。',
      F4: '比较两个分数。',
      F5: '把分数标在数轴上。',
      F6: '用参考单位测量。',
      F7: '用相同的等份计算。',
      F8: '重新分份，再计算。',
      F9: '解决分数问题。',
      N1: '把数分解成百、十和个。',
      P1: '哪个运算符合故事？',
      P2: '分两步解决问题。',
      S1: '计算。',
      S2: '计算。',
      S3: '计算。',
      S4: '计算。',
      S5: '列竖式并计算。',
    },
  }
  return prompts[locale][question.skill] ?? question.prompt
}

function storyFor(question: Extract<Ce2Question, { family: 'problem' }>, locale: Locale): string {
  if (!question.story.includes('-')) return question.story
  const [first = 0, second = 0, third = 0] = question.values
  const stories: Record<Locale, Record<string, string>> = {
    en: {
      'painted-strip-additional-part': `${first} of ${third} equal parts are painted, then ${second} more are painted. How much is painted?`,
      'seed-reserve-receives': `A reserve holds ${first} seeds and receives ${second} more. How many seeds are there now?`,
      'seed-reserve-two-steps': `A reserve holds ${first} seeds. It receives ${second}, then ${third} are used. How many remain?`,
      'seed-reserve-uses': `A reserve holds ${first} seeds and ${second} are used. How many remain?`,
    },
    fr: {
      'painted-strip-additional-part': `${first} parts sur ${third} sont peintes, puis ${second} autres sont peintes. Quelle quantité est peinte ?`,
      'seed-reserve-receives': `Une réserve contient ${first} graines et en reçoit ${second}. Combien y en a-t-il maintenant ?`,
      'seed-reserve-two-steps': `Une réserve contient ${first} graines. Elle en reçoit ${second}, puis ${third} sont utilisées. Combien en reste-t-il ?`,
      'seed-reserve-uses': `Une réserve contient ${first} graines et ${second} sont utilisées. Combien en reste-t-il ?`,
    },
    'zh-Hans': {
      'painted-strip-additional-part': `${third} 等份中先涂了 ${first} 份，又涂了 ${second} 份。一共涂了多少？`,
      'seed-reserve-receives': `仓库里有 ${first} 颗种子，又收到 ${second} 颗。现在一共有多少颗？`,
      'seed-reserve-two-steps': `仓库里有 ${first} 颗种子，收到 ${second} 颗，然后用了 ${third} 颗。还剩多少颗？`,
      'seed-reserve-uses': `仓库里有 ${first} 颗种子，用了 ${second} 颗。还剩多少颗？`,
    },
  }
  return stories[locale][question.story] ?? question.story
}

function sectorPath(index: number, denominator: number): string {
  const radius = 52
  const center = 60
  const start = -Math.PI / 2 + (index * Math.PI * 2) / denominator
  const end = -Math.PI / 2 + ((index + 1) * Math.PI * 2) / denominator
  const startX = center + radius * Math.cos(start)
  const startY = center + radius * Math.sin(start)
  const endX = center + radius * Math.cos(end)
  const endY = center + radius * Math.sin(end)
  const largeArc = end - start > Math.PI ? 1 : 0
  return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`
}

function fractionPartIds(denominator: number): ReadonlyArray<string> {
  return Array.from({ length: denominator }, (_, index) => `part-${index}`)
}

function identifyRationals(
  values: ReadonlyArray<Ce2Rational>,
): ReadonlyArray<Readonly<{ id: string; rational: Ce2Rational }>> {
  const occurrences = new Map<string, number>()
  return values.map((rational) => {
    const valueKey = `${rational.numerator}/${rational.denominator}`
    const occurrence = (occurrences.get(valueKey) ?? 0) + 1
    occurrences.set(valueKey, occurrence)
    return { id: `${valueKey}-${occurrence}`, rational }
  })
}

function parseDigits(value: string, length: number): number {
  const digits = value.replace(/\D/g, '').slice(0, length)
  return digits.length === 0 ? 0 : Number(digits)
}

function parseOptionalDigits(value: string, length: number): number | undefined {
  const digits = value.replace(/\D/g, '').slice(0, length)
  return digits.length === 0 ? undefined : Number(digits)
}

function setNumericEntry(
  entries: Readonly<Record<string, number>>,
  key: string,
  value: number | undefined,
): Readonly<Record<string, number>> {
  const emptyKey = `${key}-empty`
  const retained = Object.fromEntries(
    Object.entries(entries).filter(([entryKey]) => entryKey !== key && entryKey !== emptyKey),
  )
  return value === undefined ? { ...retained, [emptyKey]: 1 } : { ...retained, [key]: value }
}

function numericEntry(
  entries: Readonly<Record<string, number>>,
  key: string,
  fallback: number | undefined,
): number | undefined {
  return entries[`${key}-empty`] === undefined ? (entries[key] ?? fallback) : undefined
}

function digitAt(value: number, column: Ce2ColumnName, includeThousands: boolean): string {
  const text = String(value).padStart(includeThousands ? 4 : 3, '0')
  const index = columns.indexOf(column) - (includeThousands ? 0 : 1)
  if (index < 0) return ''
  const digit = text[index]
  return digit === '0' && value < 10 ** (text.length - index - 1) ? '' : (digit ?? '')
}

function columnLabel(column: Ce2ColumnName, locale: Locale): string {
  return ce2Translate(
    locale,
    column === 'units' ? 'columnOnes' : (`column${capitalize(column)}` as 'columnHundreds'),
  )
}

function columnInitial(column: Ce2ColumnName, locale: Locale): string {
  const initials: Record<Locale, Record<Ce2ColumnName, string>> = {
    en: { hundreds: 'H', tens: 'T', thousands: 'Th', units: 'O' },
    fr: { hundreds: 'C', tens: 'D', thousands: 'M', units: 'U' },
    'zh-Hans': { hundreds: '百', tens: '十', thousands: '千', units: '个' },
  }
  return initials[locale][column]
}

function capitalize<Value extends string>(value: Value): Capitalize<Value> {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` as Capitalize<Value>
}

export type { Ce2Answer, Ce2Draft, Ce2Question }
