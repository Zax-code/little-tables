import type { ComponentType } from 'react'

type FlowerRenderProps = Readonly<{
  centerColor: string
  petalColor: string
}>

type GardenPlantRenderer = Readonly<{
  GrowingBud: ComponentType<FlowerRenderProps>
  MatureHead: ComponentType<FlowerRenderProps>
  RewardBloom: ComponentType
}>

function TulipMatureHead({ petalColor }: FlowerRenderProps) {
  return (
    <g className="garden-plot__flower garden-plot__flower--tulip">
      <path
        d="M34 45C33 31 37 20 45 27L56 15L66 27C75 19 80 30 78 45C76 57 67 63 56 63S36 57 34 45Z"
        fill={petalColor}
        stroke="var(--ink-primary)"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        d="M45 27C48 37 51 43 56 48C61 43 64 37 66 27"
        fill="none"
        stroke="var(--ink-primary)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </g>
  )
}

function DaisyMatureHead({ centerColor, petalColor }: FlowerRenderProps) {
  return (
    <g className="garden-plot__flower garden-plot__flower--daisy">
      <ellipse
        cx="56"
        cy="22"
        fill={petalColor}
        rx="8"
        ry="14"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
      />
      <ellipse
        cx="56"
        cy="54"
        fill={petalColor}
        rx="8"
        ry="14"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
      />
      <ellipse
        cx="40"
        cy="38"
        fill={petalColor}
        rx="14"
        ry="8"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
      />
      <ellipse
        cx="72"
        cy="38"
        fill={petalColor}
        rx="14"
        ry="8"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
      />
      <ellipse
        cx="45"
        cy="27"
        fill={petalColor}
        rx="8"
        ry="13"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
        transform="rotate(-45 45 27)"
      />
      <ellipse
        cx="67"
        cy="49"
        fill={petalColor}
        rx="8"
        ry="13"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
        transform="rotate(-45 67 49)"
      />
      <ellipse
        cx="67"
        cy="27"
        fill={petalColor}
        rx="8"
        ry="13"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
        transform="rotate(45 67 27)"
      />
      <ellipse
        cx="45"
        cy="49"
        fill={petalColor}
        rx="8"
        ry="13"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
        transform="rotate(45 45 49)"
      />
      <circle
        cx="56"
        cy="38"
        fill={centerColor}
        r="10"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
      />
    </g>
  )
}

function TulipGrowingBud({ petalColor }: FlowerRenderProps) {
  return (
    <path
      d="M47 70C46 59 50 51 56 54C62 50 67 58 65 69C64 76 60 80 56 80C51 80 48 76 47 70Z"
      fill={petalColor}
      stroke="var(--ink-primary)"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  )
}

function DaisyGrowingBud({ centerColor, petalColor }: FlowerRenderProps) {
  return (
    <>
      <circle
        cx="56"
        cy="65"
        fill={petalColor}
        r="10"
        stroke="var(--ink-primary)"
        strokeWidth="2.5"
      />
      <circle cx="56" cy="65" fill={centerColor} r="4" />
    </>
  )
}

function TulipRewardBloom() {
  return <path className="reward-bloom" d="M17 18c-6 0-10-5-9-12l5 4 4-7 4 7 5-4c1 7-3 12-9 12Z" />
}

function DaisyRewardBloom() {
  return (
    <g className="reward-daisy">
      <ellipse cx="17" cy="5" rx="3.5" ry="6" />
      <ellipse cx="17" cy="17" rx="3.5" ry="6" />
      <ellipse cx="11" cy="11" rx="6" ry="3.5" />
      <ellipse cx="23" cy="11" rx="6" ry="3.5" />
      <circle className="reward-daisy-center" cx="17" cy="11" r="3.5" />
    </g>
  )
}

export const gardenPlantRenderers = {
  daisy: {
    GrowingBud: DaisyGrowingBud,
    MatureHead: DaisyMatureHead,
    RewardBloom: DaisyRewardBloom,
  },
  tulip: {
    GrowingBud: TulipGrowingBud,
    MatureHead: TulipMatureHead,
    RewardBloom: TulipRewardBloom,
  },
} as const satisfies Readonly<Record<string, GardenPlantRenderer>>

export type GardenPlantKind = keyof typeof gardenPlantRenderers

type GardenFlowerProps = FlowerRenderProps &
  Readonly<{
    kind: GardenPlantKind
  }>

export function GardenMatureHead({ kind, ...colors }: GardenFlowerProps) {
  const MatureHead = gardenPlantRenderers[kind].MatureHead
  return <MatureHead {...colors} />
}

export function GardenGrowingBud({ kind, ...colors }: GardenFlowerProps) {
  const GrowingBud = gardenPlantRenderers[kind].GrowingBud
  return (
    <g className="garden-plot__bud">
      <GrowingBud {...colors} />
    </g>
  )
}

export function GardenRewardFlower({ kind }: Readonly<{ kind: GardenPlantKind }>) {
  const RewardBloom = gardenPlantRenderers[kind].RewardBloom
  return (
    <svg aria-hidden="true" className="reward-flower" viewBox="0 0 34 38">
      <path
        className="reward-stem"
        d="M17 35V16M17 29c-5-6-9-5-11-5 1 6 5 10 11 9M18 27c4-5 8-5 10-4-1 6-5 9-10 8"
      />
      <RewardBloom />
    </svg>
  )
}
