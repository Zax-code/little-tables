import { motion, useReducedMotion } from 'motion/react'
import type { GardenPlantStage, GardenProgress } from '@little-tables/domain'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { gardenPlantDefinition, type GardenPlantDefinition } from './garden-plant-catalog.js'
import { GardenGrowingBud, GardenMatureHead } from './garden-plant-renderers.js'
import { GardenWateringSprite } from './garden-watering-sprite.js'
import { pickNextGardenTarget } from './garden-watering-route.js'
import { GardenWalkingSprite } from './garden-walking-sprite.js'

type GardenPlotProps = Readonly<{
  progress: GardenProgress
}>

type PlantProps = Readonly<{
  definition: GardenPlantDefinition
  index: number
  reduceMotion: boolean
  stage: Exclude<GardenPlantStage, 'locked'>
}>

type LockedPlotProps = Readonly<{
  definition: GardenPlantDefinition
  index: number
  reduceMotion: boolean
}>

const plantsPerPlot = 6
const caretakerSize = 190
const wateringCycleMs = 3_600

type CaretakerPhase = 'walking' | 'watering'

type WateringTarget = Readonly<{
  caretakerX: number
  caretakerY: number
  facing: 'left' | 'right'
  id: string
  waterX: number
  waterY: number
}>

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

function Plant({ definition, index, reduceMotion, stage }: PlantProps) {
  const stageScale = stage === 'dormant' ? 0.82 : stage === 'growing' ? 0.92 : 1
  return (
    <motion.div
      className={`garden-plot__plant garden-plot__plant--${stage}`}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.65, y: 14 }}
      animate={
        reduceMotion
          ? { opacity: 1, rotate: 0, scale: stageScale, y: 0 }
          : {
              opacity: [0, 1, 1],
              rotate: stage === 'mature' ? [0, -1.8, 1.2, 0] : [0, -0.7, 0],
              scale: [0.65, stageScale * 1.04, stageScale],
              y: [14, -2, 0],
            }
      }
      transition={{
        delay: reduceMotion ? 0 : index * 0.11,
        duration: reduceMotion ? 0 : 0.76,
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
    </motion.div>
  )
}

function LockedPlot({ definition, index, reduceMotion }: LockedPlotProps) {
  return (
    <motion.div
      className="garden-plot__locked-plot"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.84 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.11, duration: reduceMotion ? 0 : 0.5 }}
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
    </motion.div>
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

function pluralize(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`
}

export function GardenPlot({ progress }: GardenPlotProps) {
  const reduceMotion = useReducedMotion() === true
  const canvasRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)
  const [caretakerPhase, setCaretakerPhase] = useState<CaretakerPhase>('watering')
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0)
  const [walkFacing, setWalkFacing] = useState<'left' | 'right'>('right')
  const [walkDuration, setWalkDuration] = useState(1)
  const [wateringTargets, setWateringTargets] = useState<readonly WateringTarget[]>([])
  const plants = progress.plants.map(gardenPlantDefinition)
  const plantPages = Array.from(
    { length: Math.ceil(plants.length / plantsPerPlot) },
    (_, pageIndex) =>
      plants.slice(pageIndex * plantsPerPlot, pageIndex * plantsPerPlot + plantsPerPlot),
  )
  const matureCount = plants.filter(({ stage }) => stage === 'mature').length
  const growingCount = plants.filter(({ stage }) => stage === 'growing').length
  const lockedPlants = plants.filter(({ stage }) => stage === 'locked')
  const hasSparkle = progress.rewards.some(({ kind }) => kind === 'sparkle')
  const growthDescription =
    growingCount === 0 ? '' : `, ${growingCount} growing ${pluralize(growingCount, 'plant')}`
  const lockDescription =
    lockedPlants.length === 0
      ? ''
      : `, and ${lockedPlants.map(({ name, startAt }) => `${name} locked until ${startAt} blooms`).join(', ')}`
  const ariaLabel = `Little garden earned from ${progress.bloomCount} ${pluralize(progress.bloomCount, 'bloom')}: ${matureCount} mature ${pluralize(matureCount, 'flower')}${growthDescription}${lockDescription}${hasSparkle ? ', with a mastery sparkle' : ''}. Miffy is watering the garden.`
  const lastPage = plantPages.length - 1
  const measureWateringTargets = useCallback(() => {
    const canvas = canvasRef.current
    const pages = pagesRef.current
    if (canvas === null || pages === null) return

    const canvasRect = canvas.getBoundingClientRect()
    const activeGrid = pages.querySelector<HTMLElement>(`[data-garden-page="${activePage}"]`)
    if (activeGrid === null) return

    const nextTargets = Array.from(
      activeGrid.querySelectorAll<HTMLElement>('[data-plant-id]:not([data-locked="true"])'),
    ).flatMap((slot): WateringTarget[] => {
      const soil = slot.querySelector<SVGGraphicsElement>('.garden-plot__soil')
      const id = slot.dataset.plantId
      if (soil === null || id === undefined) return []

      const soilRect = soil.getBoundingClientRect()
      const waterX = soilRect.left - canvasRect.left + soilRect.width / 2
      const waterY = soilRect.top - canvasRect.top + soilRect.height / 2
      const facing = waterX < canvasRect.width / 2 ? 'left' : 'right'
      const pourPointX = facing === 'right' ? 0.8 : 0.2

      return [
        {
          caretakerX: waterX - caretakerSize * pourPointX,
          caretakerY: waterY - caretakerSize * 0.93,
          facing,
          id,
          waterX,
          waterY,
        },
      ]
    })

    setWateringTargets((currentTargets) => {
      const unchanged =
        currentTargets.length === nextTargets.length &&
        currentTargets.every((target, index) => {
          const nextTarget = nextTargets[index]
          return (
            nextTarget?.id === target.id &&
            Math.abs(target.caretakerX - nextTarget.caretakerX) < 0.5 &&
            Math.abs(target.caretakerY - nextTarget.caretakerY) < 0.5
          )
        })
      return unchanged ? currentTargets : nextTargets
    })
  }, [activePage])

  useLayoutEffect(() => {
    const pages = pagesRef.current
    const canvas = canvasRef.current
    if (pages === null || canvas === null) return

    let frame = window.requestAnimationFrame(measureWateringTargets)
    const settledMeasurement = window.setTimeout(measureWateringTargets, 950)
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
      window.clearTimeout(settledMeasurement)
      pages.removeEventListener('scroll', scheduleMeasurement)
      resizeObserver?.disconnect()
    }
  }, [measureWateringTargets])

  const updateActivePage = (nextPage: number) => {
    if (nextPage === activePage) return
    setActivePage(nextPage)
    setCurrentTargetIndex(0)
    setCaretakerPhase('watering')
  }

  useEffect(() => {
    if (reduceMotion || caretakerPhase !== 'watering' || wateringTargets.length < 2) return

    const timeout = window.setTimeout(() => {
      setCurrentTargetIndex((currentIndex) => {
        const normalizedCurrentIndex = currentIndex % wateringTargets.length
        const nextIndex = pickNextGardenTarget(currentIndex, wateringTargets.length)
        const currentTarget = wateringTargets[normalizedCurrentIndex]
        const nextTarget = wateringTargets[nextIndex]
        if (currentTarget === undefined || nextTarget === undefined) return currentIndex

        const distance = Math.hypot(
          nextTarget.caretakerX - currentTarget.caretakerX,
          nextTarget.caretakerY - currentTarget.caretakerY,
        )
        setWalkFacing(nextTarget.caretakerX >= currentTarget.caretakerX ? 'right' : 'left')
        setWalkDuration(Math.min(1.7, Math.max(0.8, distance / 115)))
        setCaretakerPhase('walking')
        return nextIndex
      })
    }, wateringCycleMs)

    return () => window.clearTimeout(timeout)
  }, [caretakerPhase, reduceMotion, wateringTargets])

  const currentTarget = wateringTargets[currentTargetIndex % wateringTargets.length]
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
      <div className="garden-plot__canvas" ref={canvasRef} role="img" aria-label={ariaLabel}>
        <div
          className="garden-plot__pages"
          onScroll={(event) => {
            const pageWidth = event.currentTarget.clientWidth
            if (pageWidth === 0) return
            updateActivePage(
              Math.max(
                0,
                Math.min(lastPage, Math.round(event.currentTarget.scrollLeft / pageWidth)),
              ),
            )
          }}
          ref={pagesRef}
        >
          {plantPages.map((page, pageIndex) => (
            <div
              className="garden-plot__grid"
              data-garden-page={pageIndex}
              key={page[0]?.id ?? `plot-${pageIndex + 1}`}
            >
              {page.map((definition, index) => {
                const isWateredPlant =
                  pageIndex === activePage &&
                  caretakerPhase === 'watering' &&
                  currentTarget?.id === definition.id
                return (
                  <div
                    className={`garden-plot__slot garden-plot__slot--${definition.id} garden-plot__slot--${definition.stage}${isWateredPlant ? ' garden-plot__slot--watered' : ''}`}
                    data-locked={definition.stage === 'locked'}
                    data-plant-id={definition.id}
                    key={definition.id}
                  >
                    {definition.stage === 'locked' ? (
                      <LockedPlot
                        definition={definition}
                        index={pageIndex * plantsPerPlot + index}
                        reduceMotion={reduceMotion}
                      />
                    ) : (
                      <Plant
                        definition={definition}
                        index={pageIndex * plantsPerPlot + index}
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
        {currentTarget === undefined ? null : (
          <>
            <motion.div
              aria-hidden="true"
              animate={{ x: currentTarget.caretakerX, y: currentTarget.caretakerY }}
              className="garden-plot__caretaker"
              initial={false}
              onAnimationComplete={() => {
                if (caretakerPhase === 'walking') setCaretakerPhase('watering')
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: caretakerPhase === 'walking' ? walkDuration : 0.18,
                      ease: caretakerPhase === 'walking' ? 'easeInOut' : 'easeOut',
                    }
              }
            >
              {caretakerPhase === 'walking' && !reduceMotion ? (
                <GardenWalkingSprite facing={walkFacing} />
              ) : (
                <GardenWateringSprite facing={currentTarget.facing} reduceMotion={reduceMotion} />
              )}
            </motion.div>
            {caretakerPhase === 'watering' ? (
              <WateringLanding
                reduceMotion={reduceMotion}
                style={{ left: currentTarget.waterX, top: currentTarget.waterY }}
              />
            ) : null}
          </>
        )}
        {hasSparkle ? (
          <div className="garden-plot__sparkles">
            {['✦', '✧', '✦'].map((sparkle, index) => (
              <motion.span
                className={`garden-plot__sparkle garden-plot__sparkle--${index + 1}`}
                key={`${sparkle}-${index}`}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
                animate={
                  reduceMotion
                    ? { opacity: 1, scale: 1 }
                    : { opacity: [0, 1, 0.75], scale: [0.4, 1.18, 1] }
                }
                transition={{ delay: 0.35 + index * 0.16, duration: reduceMotion ? 0 : 0.6 }}
              >
                {sparkle}
              </motion.span>
            ))}
          </div>
        ) : null}
      </div>
      {plantPages.length > 1 ? (
        <div className="garden-plot__pagination" aria-label="Garden pages">
          <button
            aria-label="Previous garden page"
            disabled={activePage === 0}
            onClick={() => showPage(activePage - 1)}
            type="button"
          >
            ‹
          </button>
          <div className="garden-plot__page-dots" aria-hidden="true">
            {plantPages.map((page, pageIndex) => (
              <i
                className={pageIndex === activePage ? 'garden-plot__page-dot--active' : undefined}
                key={page[0]?.id ?? `plot-dot-${pageIndex + 1}`}
              />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            Garden page {activePage + 1} of {plantPages.length}
          </span>
          <button
            aria-label="Next garden page"
            disabled={activePage === lastPage}
            onClick={() => showPage(activePage + 1)}
            type="button"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  )
}
