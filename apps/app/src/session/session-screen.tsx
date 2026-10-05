/**
 * A practice session in full screen (mockups C1 to C10): the question at the top, the answer
 * panel at the bottom with the child's character leaning on its edge, and a calm pause.
 */
import { Engine, type EngineApi } from '@little-tables/engine'
import type { PracticeQuestion, PracticeSession } from '@little-tables/engine/schema'
import {
  Alert,
  Button,
  CharacterDock,
  cn,
  IconButton,
  ProgressBar,
  type CharacterPose,
} from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Pause } from 'lucide-react'
import { Effect } from 'effect'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useApp } from '../app/app-context.js'
import { useProfileState, useSetProfileState } from '../app/profile-state.js'
import { useSync } from '../app/sync-manager.js'
import { characterNames, characterOf, sceneOf } from '../characters/characters.js'
import { LocalStore } from '../data/local-store.js'
import { answerQuestion, completeSession, continueSession } from '../data/practice.js'
import type { ProfileState } from '../data/schema.js'
import { useI18n } from '../i18n/i18n.js'
import { firstWrongColumn } from './column-entry.js'
import { exerciseStatement, expectedAnswerText, formatAnswer, isEquivalentForm } from './format.js'
import { ExerciseHint, FactRescue } from './hints.js'
import { QuestionView, type Response, type Settled } from './question-view.js'
import { playChime, prepareChime, tap } from './sound.js'

export function SessionScreen() {
  const state = useProfileState()
  const navigate = useNavigate()
  const session = state.data?.activeSession ?? null
  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (state.data === undefined) return
    if (session !== null) {
      shown.current = session.id
      return
    }
    // The session just finished: its celebration follows, whatever finished it first.
    const finished =
      shown.current !== null && state.data.lastCompletion?.sessionId === shown.current
    void navigate({ replace: true, to: finished ? '/celebration' : '/' })
  }, [navigate, session, state.data])
  if (state.data === undefined || session === null) return <div className="h-dvh bg-bg" />
  return <Session initial={session} state={state.data} />
}

type Feedback = Readonly<{ question: PracticeQuestion; settled: Settled }>

/** Runs an engine operation; the engine is loaded before the first screen. */
const runEngine = <A,>(
  runtime: ReturnType<typeof useApp>['runtime'],
  effect: (engine: EngineApi) => Effect.Effect<A, unknown>,
) => runtime.runSync(Effect.flatMap(Engine, effect))

function Session({ initial, state }: Readonly<{ initial: PracticeSession; state: ProfileState }>) {
  const { activeProfile, preferences, runtime } = useApp()
  const translator = useI18n()
  const { t } = translator
  const navigate = useNavigate()
  const setState = useSetProfileState()
  const sync = useSync()
  const [session, setSession] = useState(initial)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pausing, setPausing] = useState(false)
  const busy = useRef(false)
  const character = characterOf(activeProfile.avatarId)
  const question = feedback?.question ?? session.questions[session.currentIndex]
  const total = session.questions.length

  const engine = <A,>(effect: (engine: EngineApi) => Effect.Effect<A, unknown>) =>
    runEngine(runtime, effect)
  const shownExercise = question?.exercise
  const description = useMemo(
    () =>
      shownExercise === undefined
        ? null
        : runEngine(runtime, (it) => it.describeExercise(shownExercise)),
    [runtime, shownExercise],
  )
  const answer = useMemo(
    () => (question === undefined ? 0 : runEngine(runtime, (it) => it.correctAnswer(question))),
    [runtime, question],
  )
  const strategies = useMemo(
    () =>
      feedback === null || feedback.settled.correct || feedback.question.exercise !== undefined
        ? []
        : runEngine(runtime, (it) =>
            it.deriveRescueStrategies({ question: feedback.question, snapshot: state.snapshot }),
          ),
    [runtime, feedback, state.snapshot],
  )

  const finish = useCallback(async () => {
    await runtime.runPromise(completeSession(activeProfile.id))
    setState(
      await runtime.runPromise(Effect.flatMap(LocalStore, (store) => store.load(activeProfile.id))),
    )
    await navigate({ replace: true, to: '/celebration' })
    void sync.synchronize()
  }, [activeProfile.id, navigate, runtime, setState, sync])

  // A session whose last answer was given before the app closed is finished on opening.
  useEffect(() => {
    if (question === undefined && feedback === null && !busy.current) {
      busy.current = true
      void finish()
    }
  }, [feedback, finish, question])

  if (question === undefined) return <div className="h-dvh bg-bg" />

  const respond = (response: Response) => {
    if (busy.current || feedback !== null) return
    busy.current = true
    if (preferences.sound) prepareChime()
    void runtime
      .runPromise(answerQuestion(activeProfile.id, response))
      .then((result) => {
        if (result === null) return
        if (result.correct && preferences.sound) playChime()
        tap()
        setState(result.state)
        setSession(result.session)
        setFeedback({
          question,
          settled: {
            correct: result.correct,
            response: 'response' in response ? response.response : null,
            selected: 'selected' in response ? response.selected : null,
          },
        })
      })
      .finally(() => {
        busy.current = false
      })
  }

  const next = () => {
    if (busy.current) return
    busy.current = true
    if (session.currentIndex >= session.questions.length) {
      void finish()
      return
    }
    void runtime
      .runPromise(continueSession(activeProfile.id))
      .then((latest) => {
        setState(latest)
        if (latest.activeSession !== null) setSession(latest.activeSession)
        setFeedback(null)
      })
      .finally(() => {
        busy.current = false
      })
  }

  const exercise = question.exercise
  const settled = feedback?.settled ?? null
  const answerText =
    exercise === undefined || description === null
      ? translator.number(answer)
      : expectedAnswerText(exercise, description, translator.language)
  const statement =
    exercise === undefined || description === null
      ? `${question.left} ${question.operation === 'divide' ? '÷' : '×'} ${question.right} = ${answer}`
      : exerciseStatement(exercise, description, translator.language)
  /** A right answer written another way, such as 6/8 for 3/4. */
  const equivalent =
    settled?.correct === true &&
    settled.response !== null &&
    description !== null &&
    isEquivalentForm(description, settled.response)
      ? settled.response
      : null
  const pose: CharacterPose = settled === null ? 'idle' : settled.correct ? 'correct' : 'encourage'
  const wrongColumn =
    exercise?.kind === 'column' &&
    settled !== null &&
    !settled.correct &&
    settled.response?.type === 'integer'
      ? firstWrongColumn(
          String(settled.response.value).split('').reverse(),
          description?.columnResult ?? 0,
        )
      : null

  const bubble =
    settled === null ? null : settled.correct ? (
      <span className="flex flex-col">
        <strong className="text-callout font-extrabold">
          {equivalent !== null
            ? t('practice.yesAlso', {
                answer: answerText,
                given: formatAnswer(equivalent, translator.language),
              })
            : t('session.bubbleYes', { answer: answerText })}
        </strong>
        <span className="text-footnote font-semibold text-label-2">{statement}</span>
      </span>
    ) : (
      <span className="flex flex-col">
        <strong className="text-callout font-extrabold">
          {t('session.bubbleAlmost', { answer: answerText })}
        </strong>
        <span className="text-footnote font-semibold text-label-2">
          {t('session.lookTogether')}
        </span>
      </span>
    )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg safe-top">
      <header className="flex items-center gap-3 px-4 pt-2 pb-1">
        <IconButton label={t('session.pause')} onClick={() => setPausing(true)} tone="surface">
          <Pause aria-hidden className="size-5" />
        </IconButton>
        <ProgressBar
          className="flex-1"
          label={t('session.progress', {
            current: Math.min(session.currentIndex + (settled === null ? 1 : 0), total),
            total,
          })}
          segments={total}
          tone="tint"
          value={session.currentIndex}
        />
        <span className="w-10 text-right text-subhead font-extrabold text-label-2 tabular">
          {Math.min(session.currentIndex + (settled === null ? 1 : 0), total)}/{total}
        </span>
      </header>

      <QuestionView
        answer={answer}
        characterName={characterNames[character]}
        description={description}
        isCorrect={(item, choice) =>
          engine((it) => it.isExerciseAnswerCorrect({ answer: choice, exercise: item }))
        }
        key={question.id}
        method={activeProfile.learningPaths.subtractionMethod}
        onAnswer={respond}
        question={question}
        settled={settled}
      >
        {({ panel, prompt }) => (
          <>
            <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-4">
              {prompt}
            </main>
            <div className="relative">
              <CharacterDock
                bubble={bubble}
                className="-mb-2"
                label={t('session.character', { character: characterNames[character] })}
                pose={pose}
                poses={{
                  correct: sceneOf(character, 'practiceCorrect').src,
                  encourage: sceneOf(character, 'practiceEncourage').src,
                  idle: sceneOf(character, 'practiceIdle').src,
                }}
              />
              <section
                className={cn(
                  'relative flex max-h-[62dvh] flex-col gap-3 overflow-y-auto rounded-t-[2rem] px-4 pt-4 pb-3 safe-bottom transition-colors',
                  settled === null
                    ? 'bg-surface-2'
                    : settled.correct
                      ? 'bg-leaf-soft'
                      : 'bg-sun-soft',
                )}
              >
                {settled !== null && !settled.correct ? (
                  exercise === undefined || description === null ? (
                    <FactRescue answer={answer} question={question} strategies={strategies} />
                  ) : (
                    <ExerciseHint
                      description={description}
                      exercise={exercise}
                      method={activeProfile.learningPaths.subtractionMethod}
                      wrongColumn={wrongColumn}
                    />
                  )
                ) : (
                  panel
                )}
                {settled === null ? null : (
                  <Button
                    autoFocus
                    icon={<ArrowRight aria-hidden className="size-5" />}
                    onClick={next}
                    size="lg"
                    variant={settled.correct ? 'success' : 'primary'}
                    width="full"
                  >
                    {t('session.next')}
                  </Button>
                )}
              </section>
            </div>
          </>
        )}
      </QuestionView>

      <Alert
        art={
          <img
            alt=""
            className="mx-auto h-20 w-auto"
            height={80}
            src={sceneOf(character, 'home').src}
            width={52}
          />
        }
        cancelLabel={t('session.continue')}
        confirmLabel={t('session.takeBreak')}
        description={t('session.pauseCopy')}
        onConfirm={() => void navigate({ to: '/' })}
        onOpenChange={setPausing}
        open={pausing}
        title={t('session.pauseTitle')}
      />
    </div>
  )
}
