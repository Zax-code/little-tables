import { m, useReducedMotion } from 'motion/react'
import type { GardenPlantStage, GardenProgress } from '@little-tables/domain'
import type { CSSProperties, RefObject } from 'react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

import { gardenPlantDefinition, type GardenPlantDefinition } from './garden-plant-catalog.js'
import { GardenGrowingBud, GardenMatureHead } from './garden-plant-renderers.js'
import { GardenWateringSprite } from './garden-watering-sprite.js'
import {
  initialGardenCaretakerState as initialCaretakerState,
  transitionGardenCaretaker as caretakerReducer,
  type GardenCaretakerPhase as CaretakerPhase,
  type GardenCaretakerTarget as WateringTarget,
} from './garden-caretaker-state.js'
import {
  gardenTargetsForPage,
  pickNextGardenTargetInGarden,
  planGardenJourney,
} from './garden-watering-route.js'
import { GardenWalkingSprite } from './garden-walking-sprite.js'
import { translatePlantName, useI18n } from '../i18n.js'

type GardenPlotProps = Readonly<{
  progress: GardenProgress
}>

type PlantProps = Readonly<{
  definition: GardenPlantDefinition
  reduceMotion: boolean
  stage: Exclude<GardenPlantStage, 'locked'>
}>

type LockedPlotProps = Readonly<{
  definition: GardenPlantDefinition
  reduceMotion: boolean
}>

const plantsPerPlot = 6
const fallbackCaretakerSize = 190
const wateringCycleMs = 3_600
const betweenGardensTravelMs = 650
const sparkles = [
  { id: 'left', symbol: '✦' },
  { id: 'middle', symbol: '✧' },
  { id: 'right', symbol: '✦' },
] as const

const caretakerSizeFor = (canvas: HTMLElement) => {
  const measuredSize = Number.parseFloat(
    window.getComputedStyle(canvas).getPropertyValue('--garden-caretaker-size'),
  )
  return Number.isFinite(measuredSize) ? measuredSize : fallbackCaretakerSize
}

const chapterNameKey = (chapterId: string) => {
  if (chapterId === 'secret-greenhouse') return 'chapter.secret-greenhouse' as const
  if (chapterId === 'starlit-garden') return 'chapter.starlit-garden' as const
  return 'chapter.sunny-meadow' as const
}

function PlantStem({ stage }: Readonly<{ stage: Exclude<GardenPlantStage, 'locked'> }>) {
  const top = stage === 'dormant' ? 90 : stage === 'growing' ? 67 : 48
  return (
    <g className="garden-plot__stem-and-leaves">
      <path
        className="garden-plot__stem"
        d={`M56 108V${top}`}
        fill="none"
        stroke="var(--ink-primary)"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        className="garden-plot__leaf"
        d={
          stage === 'dormant'
            ? 'M55 99C47 91 40 92 39 94C41 102 47 106 55 106Z'
            : 'M55 86C42 73 32 75 31 78C34 91 42 98 55 99Z'
        }
        fill="var(--garden-leaf-light)"
        stroke="var(--ink-primary)"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      {stage === 'dormant' ? null : (
        <path
          className="garden-plot__leaf"
          d="M57 94C68 80 79 81 81 84C78 97 69 102 57 104Z"
          fill="var(--garden-leaf-deep)"
          stroke="var(--ink-primary)"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      )}
    </g>
  )
}

function Pot({ color }: Readonly<{ color: string }>) {
  return (
    <g className="garden-plot__pot">
      <ellipse
        className="garden-plot__soil"
        cx="56"
        cy="108"
        fill="var(--garden-soil)"
        rx="27"
        ry="6"
      />
      <path
        d="M28 112H84L79 139C64 145 48 145 33 139Z"
        fill={color}
        stroke="var(--ink-primary)"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <rect
        x="24"
        y="103"
        width="64"
        height="14"
        rx="4"
        fill={color}
        stroke="var(--ink-primary)"
        strokeWidth="3"
      />
      <path
        d="M31 117H81"
        fill="none"
        stroke="var(--garden-pot-detail)"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </g>
  )
}

function Plant({ definition, reduceMotion, stage }: PlantProps) {
  const stageScale = stage === 'dormant' ? 0.82 : stage === 'growing' ? 0.92 : 1
  return (
    <m.div
      className={`garden-plot__plant garden-plot__plant--${stage}`}
      initial={false}
      animate={{ opacity: 1, rotate: 0, scale: stageScale, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.2,
        ease: 'easeOut',
      }}
    >
      <svg
        className="garden-plot__plant-illustration"
        viewBox="0 0 112 146"
        preserveAspectRatio="xMidYMax meet"
      >
        <PlantStem stage={stage} />
        {stage === 'mature' ? (
          <GardenMatureHead
            centerColor={definition.centerColor}
            kind={definition.kind}
            petalColor={definition.petalColor}
          />
        ) : stage === 'growing' ? (
          <GardenGrowingBud
            centerColor={definition.centerColor}
            kind={definition.kind}
            petalColor={definition.petalColor}
          />
        ) : null}
        <Pot color={definition.potColor} />
      </svg>
    </m.div>
  )
}

function LockedPlot({ definition, reduceMotion }: LockedPlotProps) {
  return (
    <m.div
      className="garden-plot__locked-plot"
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
    >
      <svg
        className="garden-plot__locked-illustration"
        viewBox="0 0 112 146"
        preserveAspectRatio="xMidYMax meet"
      >
        <path
          className="garden-plot__locked-outline"
          d="M35 98V66C35 44 44 29 56 29S77 44 77 66V98Z"
          fill="var(--garden-lock-surface)"
          fillOpacity="0.44"
          stroke="var(--garden-lock-line)"
          strokeDasharray="6 6"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <g className="garden-plot__lock">
          <rect x="46" y="64" width="20" height="18" rx="4" fill="var(--garden-lock-ink)" />
          <path
            d="M50 64V58a6 6 0 0 1 12 0v6"
            fill="none"
            stroke="var(--garden-lock-ink)"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <circle cx="56" cy="72" r="2" fill="var(--garden-lock-surface)" />
        </g>
        <Pot color={definition.potColor} />
      </svg>
    </m.div>
  )
}

function WateringLanding({
  reduceMotion,
  style,
}: Readonly<{ reduceMotion: boolean; style: CSSProperties }>) {
  return (
    <span
      aria-hidden="true"
      className={`garden-plot__watering-landing${reduceMotion ? ' garden-plot__watering-landing--static' : ''}`}
      style={style}
    >
      <i />
      <i />
      <i />
      <b />
    </span>
  )
}

type PlantPage = ReadonlyArray<GardenPlantDefinition>

function ChapterHeading({ chapter }: Readonly<{ chapter: GardenProgress['chapters'][number] }>) {
  const { t } = useI18n()

  return (
    <header className="garden-plot__chapter-heading">
      <div>
        <span>{t('chapter.heading')}</span>
        <strong>{t(chapterNameKey(chapter.id))}</strong>
      </div>
      <p>
        {t('chapter.progress', {
          current: chapter.collectedCount,
          flower: t(chapter.collectedCount === 1 ? 'common.flower' : 'common.flowers'),
          total: chapter.totalCount,
        })}
      </p>
    </header>
  )
}

function PlantPages({
  activePage,
  caretakerPhase,
  currentTargetId,
  lastPage,
  onActivePageChange,
  pages,
  pagesRef,
  reduceMotion,
}: Readonly<{
  activePage: number
  caretakerPhase: CaretakerPhase
  currentTargetId: string | undefined
  lastPage: number
  onActivePageChange: (page: number) => void
  pages: ReadonlyArray<PlantPage>
  pagesRef: RefObject<HTMLDivElement | null>
  reduceMotion: boolean
}>) {
  return (
    <div
      className="garden-plot__pages"
      onScroll={(event) => {
        const pageWidth = event.currentTarget.clientWidth
        if (pageWidth === 0) return
        onActivePageChange(
          Math.max(0, Math.min(lastPage, Math.round(event.currentTarget.scrollLeft / pageWidth))),
        )
      }}
      ref={pagesRef}
    >
      {pages.map((page, pageIndex) => (
        <div
          className="garden-plot__grid"
          data-garden-page={pageIndex}
          key={page[0]?.id ?? `plot-${pageIndex + 1}`}
        >
          {page.map((definition) => {
            const isWateredPlant =
              pageIndex === activePage &&
              caretakerPhase === 'watering' &&
              currentTargetId === definition.id
            return (
              <div
                className={`garden-plot__slot garden-plot__slot--${definition.id} garden-plot__slot--${definition.stage}${isWateredPlant ? ' garden-plot__slot--watered' : ''}`}
                data-locked={definition.stage === 'locked'}
                data-plant-id={definition.id}
                key={definition.id}
              >
                {definition.stage === 'locked' ? (
                  <LockedPlot definition={definition} reduceMotion={reduceMotion} />
                ) : (
                  <Plant
                    definition={definition}
                    reduceMotion={reduceMotion}
                    stage={definition.stage}
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function GardenCaretaker({
  phase,
  reduceMotion,
  target,
  walkDuration,
  walkFacing,
}: Readonly<{
  phase: CaretakerPhase
  reduceMotion: boolean
  target: WateringTarget
  walkDuration: number
  walkFacing: 'left' | 'right'
}>) {
  return (
    <>
      <m.div
        aria-hidden="true"
        animate={{ x: target.caretakerX, y: target.caretakerY }}
        className="garden-plot__caretaker"
        initial={false}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                duration: phase === 'watering' ? 0.18 : walkDuration,
                ease: phase === 'watering' ? 'easeOut' : 'easeInOut',
              }
        }
      >
        {phase !== 'watering' && !reduceMotion ? (
          <GardenWalkingSprite facing={walkFacing} />
        ) : (
          <GardenWateringSprite facing={target.facing} reduceMotion={reduceMotion} />
        )}
      </m.div>
      {phase === 'watering' ? (
        <WateringLanding
          reduceMotion={reduceMotion}
          style={{ left: target.waterX, top: target.waterY }}
        />
      ) : null}
    </>
  )
}

function GardenSparkles({ reduceMotion }: Readonly<{ reduceMotion: boolean }>) {
  return (
    <div className="garden-plot__sparkles">
      {sparkles.map((sparkle, index) => (
        <m.span
          className={`garden-plot__sparkle garden-plot__sparkle--${index + 1}`}
          key={sparkle.id}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
          animate={
            reduceMotion
              ? { opacity: 1, scale: 1 }
              : { opacity: [0, 1, 0.75], scale: [0.4, 1.18, 1] }
          }
          transition={{ delay: 0.35 + index * 0.16, duration: reduceMotion ? 0 : 0.6 }}
        >
          {sparkle.symbol}
        </m.span>
      ))}
    </div>
  )
}

function GardenPagination({
  activePage,
  lastPage,
  onShowPage,
  pages,
}: Readonly<{
  activePage: number
  lastPage: number
  onShowPage: (page: number) => void
  pages: ReadonlyArray<PlantPage>
}>) {
  const { t } = useI18n()

  return (
    <div className="garden-plot__pagination" aria-label={t('garden.pagination')}>
      <button
        aria-label={t('garden.paginationPrevious')}
        disabled={activePage === 0}
        onClick={() => onShowPage(activePage - 1)}
        type="button"
      >
        ‹
      </button>
      <div className="garden-plot__page-dots" aria-hidden="true">
        {pages.map((page, pageIndex) => (
          <i
            className={pageIndex === activePage ? 'garden-plot__page-dot--active' : undefined}
            key={page[0]?.id ?? `plot-dot-${pageIndex + 1}`}
          />
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {t('garden.paginationStatus', {
          current: activePage + 1,
          total: pages.length,
        })}
      </span>
      <button
        aria-label={t('garden.paginationNext')}
        disabled={activePage === lastPage}
        onClick={() => onShowPage(activePage + 1)}
        type="button"
      >
        ›
      </button>
    </div>
  )
}

function useGardenCaretaker(reduceMotion: boolean, caretakerPage: number) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [caretaker, dispatchCaretaker] = useReducer(caretakerReducer, initialCaretakerState)
  const [wateringTargets, setWateringTargets] = useState<readonly WateringTarget[]>([])
  const measureWateringTargets = useCallback(() => {
    const canvas = canvasRef.current
    const pages = pagesRef.current
    if (canvas === null || pages === null) return

    const canvasRect = canvas.getBoundingClientRect()
    const pagesRect = pages.getBoundingClientRect()
    const caretakerSize = caretakerSizeFor(canvas)
    const measuredTargets = Array.from(
      pages.querySelectorAll<HTMLElement>('[data-garden-page]'),
    ).flatMap((grid, pageIndex) => {
      const gridRect = grid.getBoundingClientRect()
      return Array.from(
        grid.querySelectorAll<HTMLElement>('[data-plant-id]:not([data-locked="true"])'),
      ).flatMap((slot): WateringTarget[] => {
        const soil = slot.querySelector<SVGGraphicsElement>('.garden-plot__soil')
        const id = slot.dataset.plantId
        if (soil === null || id === undefined) return []

        const soilRect = soil.getBoundingClientRect()
        const waterX =
          pagesRect.left - canvasRect.left + soilRect.left - gridRect.left + soilRect.width / 2
        const waterY = soilRect.top - canvasRect.top + soilRect.height / 2
        const facing = waterX < canvasRect.width / 2 ? 'left' : 'right'
        const pourPointX = facing === 'right' ? 0.8 : 0.2

        return [
          {
            caretakerX: waterX - caretakerSize * pourPointX,
            caretakerY: waterY - caretakerSize * 0.93,
            facing,
            id,
            pageIndex,
            waterX,
            waterY,
          },
        ]
      })
    })
    const nextTargets = gardenTargetsForPage(caretakerPage, measuredTargets)

    dispatchCaretaker({
      randomValue: Math.random(),
      targets: nextTargets,
      type: 'targets-measured',
    })
    setWateringTargets((currentTargets) => {
      const unchanged =
        currentTargets.length === nextTargets.length &&
        currentTargets.every((target, index) => {
          const nextTarget = nextTargets[index]
          return (
            nextTarget?.id === target.id &&
            nextTarget.pageIndex === target.pageIndex &&
            Math.abs(target.caretakerX - nextTarget.caretakerX) < 0.5 &&
            Math.abs(target.caretakerY - nextTarget.caretakerY) < 0.5
          )
        })
      return unchanged ? currentTargets : nextTargets
    })
  }, [caretakerPage])

  useLayoutEffect(() => {
    const pages = pagesRef.current
    const canvas = canvasRef.current
    if (pages === null || canvas === null) return

    let frame = window.requestAnimationFrame(measureWateringTargets)
    const scheduleMeasurement = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measureWateringTargets)
    }
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasurement)

    pages.addEventListener('scroll', scheduleMeasurement, { passive: true })
    resizeObserver?.observe(canvas)
    return () => {
      window.cancelAnimationFrame(frame)
      pages.removeEventListener('scroll', scheduleMeasurement)
      resizeObserver?.disconnect()
    }
  }, [measureWateringTargets])

  useEffect(() => {
    if (reduceMotion || caretaker.phase !== 'watering' || wateringTargets.length < 2) return

    const timeout = window.setTimeout(() => {
      const previousTarget =
        wateringTargets.find(({ id }) => id === caretaker.target?.id) ?? wateringTargets[0]
      if (previousTarget === undefined) return
      const nextTarget = pickNextGardenTargetInGarden(previousTarget, wateringTargets)
      if (nextTarget === undefined) return

      const canvas = canvasRef.current
      const journey = planGardenJourney(previousTarget, nextTarget, {
        canvasWidth: canvas?.clientWidth ?? 0,
        caretakerWidth: canvas === null ? fallbackCaretakerSize : caretakerSizeFor(canvas),
      })
      if (journey.kind === 'between-gardens') {
        const distance = Math.abs(journey.departure.caretakerX - previousTarget.caretakerX)
        dispatchCaretaker({
          crossGardenJourney: {
            arrival: journey.arrival,
            destination: journey.destination,
            direction: journey.direction,
          },
          target: journey.departure,
          type: 'depart',
          walkDuration: Math.min(1.5, Math.max(0.8, distance / 150)),
          walkFacing: journey.direction,
        })
        return
      }

      const distance = Math.hypot(
        nextTarget.caretakerX - previousTarget.caretakerX,
        nextTarget.caretakerY - previousTarget.caretakerY,
      )
      dispatchCaretaker({
        target: nextTarget,
        type: 'walk',
        walkDuration: Math.min(1.7, Math.max(0.8, distance / 115)),
        walkFacing: nextTarget.caretakerX >= previousTarget.caretakerX ? 'right' : 'left',
      })
    }, wateringCycleMs)

    return () => window.clearTimeout(timeout)
  }, [caretaker.phase, caretaker.target?.id, reduceMotion, wateringTargets])

  useEffect(() => {
    if (caretaker.phase === 'walking') {
      const timeout = window.setTimeout(
        () => dispatchCaretaker({ type: 'water' }),
        caretaker.walkDuration * 1_000,
      )
      return () => window.clearTimeout(timeout)
    }

    if (caretaker.phase === 'departing') {
      const timeout = window.setTimeout(() => {
        dispatchCaretaker({ type: 'travel' })
      }, caretaker.walkDuration * 1_000)
      return () => window.clearTimeout(timeout)
    }

    if (caretaker.phase === 'traveling' && caretaker.crossGardenJourney !== undefined) {
      const journey = caretaker.crossGardenJourney
      const timeout = window.setTimeout(() => {
        const arrivalDistance = Math.abs(
          journey.destination.caretakerX - journey.arrival.caretakerX,
        )
        dispatchCaretaker({
          target: journey.arrival,
          type: 'arrive',
          walkDuration: Math.min(1.7, Math.max(0.8, arrivalDistance / 150)),
          walkFacing: journey.direction,
        })
      }, betweenGardensTravelMs)
      return () => window.clearTimeout(timeout)
    }

    if (caretaker.phase === 'arriving' && caretaker.crossGardenJourney !== undefined) {
      const journey = caretaker.crossGardenJourney
      const frame = window.requestAnimationFrame(() => {
        dispatchCaretaker({ target: journey.destination, type: 'finish-arrival' })
      })
      return () => window.cancelAnimationFrame(frame)
    }

    if (caretaker.phase !== 'finishing-arrival') return
    const timeout = window.setTimeout(
      () => dispatchCaretaker({ type: 'water' }),
      caretaker.walkDuration * 1_000,
    )
    return () => window.clearTimeout(timeout)
  }, [caretaker])

  return { canvasRef, caretaker, pagesRef }
}

export function GardenPlot({ progress }: GardenPlotProps) {
  const { locale, t } = useI18n()
  const reduceMotion = useReducedMotion() === true
  const [activePage, setActivePage] = useState(() => {
    const growingChapter = progress.chapters.findIndex(({ stage }) => stage === 'growing')
    if (growingChapter >= 0) return growingChapter
    return Math.max(
      0,
      progress.chapters.findLastIndex(({ stage }) => stage !== 'locked'),
    )
  })
  const [caretakerPage] = useState(activePage)
  const { canvasRef, caretaker, pagesRef } = useGardenCaretaker(reduceMotion, caretakerPage)
  const plants = useMemo(() => progress.plants.map(gardenPlantDefinition), [progress.plants])
  const plantPages = useMemo(
    () =>
      Array.from({ length: Math.ceil(plants.length / plantsPerPlot) }, (_, pageIndex) =>
        plants.slice(pageIndex * plantsPerPlot, pageIndex * plantsPerPlot + plantsPerPlot),
      ),
    [plants],
  )
  const activePlants = plantPages[activePage] ?? plants
  const activeChapter = progress.chapters[activePage]
  const matureCount = activePlants.filter(({ stage }) => stage === 'mature').length
  const growingCount = activePlants.filter(({ stage }) => stage === 'growing').length
  const lockedPlants = activePlants.filter(({ stage }) => stage === 'locked')
  const hasSparkle = progress.rewards.some(({ kind }) => kind === 'sparkle')
  const growthDescription =
    growingCount === 0
      ? t('garden.plotNoneGrowing')
      : t('garden.plotGrowing', {
          count: growingCount,
          plant: t(growingCount === 1 ? 'common.plant' : 'common.plants'),
        })
  const lockDescription =
    lockedPlants.length === 0
      ? t('garden.plotNoneLocked')
      : lockedPlants
          .map(({ id, masteryRemaining, startAt }) =>
            masteryRemaining > 0
              ? `${translatePlantName(locale, id)} : ${t(
                  masteryRemaining === 1 ? 'chapter.oneToGo' : 'chapter.manyToGo',
                  { count: masteryRemaining },
                )}`
              : t('garden.plotLocked', {
                  bloom: t(startAt === 1 ? 'common.bloom' : 'common.blooms'),
                  count: startAt,
                  plant: translatePlantName(locale, id),
                }),
          )
          .join(', ')
  const ariaLabel = t('garden.plotAria', {
    blooms: t('garden.bloomCount', {
      bloom: t(progress.bloomCount === 1 ? 'common.bloom' : 'common.blooms'),
      count: progress.bloomCount,
    }),
    growing: growthDescription,
    locked: lockDescription,
    mature: t('garden.plotMature', {
      count: matureCount,
      flower: t(matureCount === 1 ? 'common.flower' : 'common.flowers'),
    }),
    sparkle: hasSparkle ? t('garden.plotSparkle') : '',
    caretaker: t(
      caretaker.target?.pageIndex === activePage && caretaker.phase !== 'traveling'
        ? 'garden.plotCaretakerHere'
        : 'garden.plotCaretakerAway',
    ),
  })
  const lastPage = plantPages.length - 1

  const updateActivePage = (nextPage: number) => {
    if (nextPage === activePage) return
    setActivePage(nextPage)
  }

  const showPage = (pageIndex: number) => {
    const nextPage = Math.max(0, Math.min(lastPage, pageIndex))
    updateActivePage(nextPage)
    const pages = pagesRef.current
    if (pages === null) return
    pages.scrollTo({
      behavior: reduceMotion ? 'auto' : 'smooth',
      left: pages.clientWidth * nextPage,
    })
  }
  const className = [
    'garden-plot',
    hasSparkle ? 'garden-plot--sparkling' : '',
    plantPages.length > 1 ? 'garden-plot--paged' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      {activeChapter === undefined ? null : <ChapterHeading chapter={activeChapter} />}
      <div
        aria-label={ariaLabel}
        className="garden-plot__canvas"
        data-caretaker-page={caretaker.target?.pageIndex}
        data-caretaker-phase={caretaker.phase}
        data-caretaker-target={caretaker.target?.id}
        ref={canvasRef}
        role="img"
      >
        <PlantPages
          activePage={activePage}
          caretakerPhase={caretaker.phase}
          currentTargetId={caretaker.target?.id}
          lastPage={lastPage}
          onActivePageChange={updateActivePage}
          pages={plantPages}
          pagesRef={pagesRef}
          reduceMotion={reduceMotion}
        />
        {caretaker.target?.pageIndex !== activePage || caretaker.phase === 'traveling' ? null : (
          <GardenCaretaker
            phase={caretaker.phase}
            reduceMotion={reduceMotion}
            target={caretaker.target}
            walkDuration={caretaker.walkDuration}
            walkFacing={caretaker.walkFacing}
          />
        )}
        {hasSparkle ? <GardenSparkles reduceMotion={reduceMotion} /> : null}
      </div>
      {plantPages.length > 1 ? (
        <GardenPagination
          activePage={activePage}
          lastPage={lastPage}
          onShowPage={showPage}
          pages={plantPages}
        />
      ) : null}
    </div>
  )
}
