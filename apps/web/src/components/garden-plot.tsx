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
import { GardenPlantArtwork, gardenPlantViewBox } from './garden-plant-illustration.js'
import { GardenWateringSprite } from './garden-watering-sprite.js'
import {
  initialGardenCaretakerState as initialCaretakerState,
  transitionGardenCaretaker as caretakerReducer,
  type GardenCaretakerPhase as CaretakerPhase,
  type GardenCaretakerState as CaretakerState,
  type GardenCaretakerTarget as WateringTarget,
} from './garden-caretaker-state.js'
import {
  gardenWateringCycleMs,
  gardenWorldX,
  pickNextGardenTarget,
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

const plantsPerPlot = 3
const fallbackCaretakerSize = 150
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
        viewBox={gardenPlantViewBox}
        preserveAspectRatio="xMidYMax meet"
      >
        <GardenPlantArtwork definition={definition} stage={stage} />
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

export function PlantPages({
  caretaker,
  lastPage,
  onActivePageChange,
  pages,
  pagesRef,
  reduceMotion,
}: Readonly<{
  caretaker: CaretakerState
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
      <div className="garden-plot__world" style={{ width: `${pages.length * 100}%` }}>
        {pages.map((page, pageIndex) => (
          <div
            className="garden-plot__grid"
            data-garden-page={pageIndex}
            key={page[0]?.id ?? `plot-${pageIndex + 1}`}
          >
            {page.map((definition) => {
              const isWateredPlant =
                caretaker.phase === 'watering' &&
                caretaker.target?.pageIndex === pageIndex &&
                caretaker.target.id === definition.id
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
        {caretaker.target === undefined ? null : (
          <GardenCaretaker
            phase={caretaker.phase}
            reduceMotion={reduceMotion}
            target={caretaker.target}
            walkDuration={caretaker.walkDuration}
            walkFacing={caretaker.walkFacing}
          />
        )}
      </div>
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
        <svg aria-hidden="true" className="garden-plot__pagination-icon" viewBox="0 0 24 24">
          <path d="m14.5 6-6 6 6 6" />
        </svg>
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
        <svg aria-hidden="true" className="garden-plot__pagination-icon" viewBox="0 0 24 24">
          <path d="m9.5 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}

function useGardenCaretaker(reduceMotion: boolean, initialPage: number) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [caretaker, dispatchCaretaker] = useReducer(caretakerReducer, initialCaretakerState)
  const [wateringTargets, setWateringTargets] = useState<readonly WateringTarget[]>([])
  const measureWateringTargets = useCallback(() => {
    const canvas = canvasRef.current
    const pages = pagesRef.current
    if (canvas === null || pages === null) return

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
        const localWaterX = soilRect.left - gridRect.left + soilRect.width / 2
        const waterX = gardenWorldX(pageIndex, gridRect.width, localWaterX)
        const waterY = soilRect.top - gridRect.top + soilRect.height / 2
        const facing = localWaterX < gridRect.width / 2 ? 'left' : 'right'
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
    dispatchCaretaker({
      initialPage,
      randomValue: Math.random(),
      targets: measuredTargets,
      type: 'targets-measured',
    })
    setWateringTargets((currentTargets) => {
      const unchanged =
        currentTargets.length === measuredTargets.length &&
        currentTargets.every((target, index) => {
          const nextTarget = measuredTargets[index]
          return (
            nextTarget?.id === target.id &&
            nextTarget.pageIndex === target.pageIndex &&
            Math.abs(target.caretakerX - nextTarget.caretakerX) < 0.5 &&
            Math.abs(target.caretakerY - nextTarget.caretakerY) < 0.5
          )
        })
      return unchanged ? currentTargets : measuredTargets
    })
  }, [initialPage])

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
      const nextTarget = pickNextGardenTarget(previousTarget.id, wateringTargets)
      if (nextTarget === undefined || nextTarget.id === previousTarget.id) return
      const distance = Math.hypot(
        nextTarget.caretakerX - previousTarget.caretakerX,
        nextTarget.caretakerY - previousTarget.caretakerY,
      )
      dispatchCaretaker({
        target: nextTarget,
        type: 'walk',
        walkDuration: Math.min(6, Math.max(0.8, distance / 160)),
        walkFacing: nextTarget.caretakerX >= previousTarget.caretakerX ? 'right' : 'left',
      })
    }, gardenWateringCycleMs)

    return () => window.clearTimeout(timeout)
  }, [caretaker.phase, caretaker.target?.id, reduceMotion, wateringTargets])

  useEffect(() => {
    if (caretaker.phase !== 'walking') return
    if (reduceMotion) {
      dispatchCaretaker({ type: 'water' })
      return
    }
    const timeout = window.setTimeout(
      () => dispatchCaretaker({ type: 'water' }),
      caretaker.walkDuration * 1_000,
    )
    return () => window.clearTimeout(timeout)
  }, [caretaker.phase, caretaker.walkDuration, reduceMotion])

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
  const [caretakerInitialPage] = useState(activePage)
  const { canvasRef, caretaker, pagesRef } = useGardenCaretaker(reduceMotion, caretakerInitialPage)
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
      caretaker.target?.pageIndex === activePage
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
          caretaker={caretaker}
          lastPage={lastPage}
          onActivePageChange={updateActivePage}
          pages={plantPages}
          pagesRef={pagesRef}
          reduceMotion={reduceMotion}
        />
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
