import type { GardenPlantStage } from '@little-tables/domain'

import type { GardenPlantDefinition } from './garden-plant-catalog.js'
import { GardenGrowingBud, GardenMatureHead } from './garden-plant-renderers.js'

type VisiblePlantStage = Exclude<GardenPlantStage, 'locked'>
type FloweringPlantStage = Extract<VisiblePlantStage, 'growing' | 'mature'>

type PlantBody = Readonly<{
  detail?: string
  leafDeep: string
  leafLight: string
  stem: string
}>

type FloweringBodies = Readonly<
  Record<GardenPlantDefinition['kind'], Readonly<Record<FloweringPlantStage, PlantBody>>>
>

const ink = 'var(--ink-primary)'

export const gardenPlantViewBox = '0 0 112 152'

const dormantBody: PlantBody = {
  leafDeep: 'M71 145C82 132 92 134 93 138C89 147 81 150 71 150Z',
  leafLight: 'M69 139C57 127 47 129 46 133C51 143 59 146 69 146Z',
  stem: 'M70 154V124',
}

const floweringBodies: FloweringBodies = {
  'blue-wisteria': {
    growing: {
      detail: 'M64 92L54 99M67 105L59 113',
      leafDeep: 'M72 145C90 126 104 129 106 135C99 149 86 152 72 151Z',
      leafLight: 'M68 138C50 121 36 124 34 130C41 145 54 149 68 147Z',
      stem: 'M70 154C71 128 73 105 64 87C59 78 53 76 47 79',
    },
    mature: {
      detail: 'M61 47L47 55M66 61L53 70M69 77L58 87M71 94L63 103',
      leafDeep: 'M72 145C92 123 107 127 109 133C102 149 87 152 72 151Z',
      leafLight: 'M68 137C48 118 33 122 31 128C39 145 53 150 68 147Z',
      stem: 'M70 154C72 114 77 74 60 39C53 26 42 24 32 30',
    },
  },
  'blushing-peony': {
    growing: {
      leafDeep: 'M72 145C91 125 105 129 107 135C100 149 87 152 72 151Z',
      leafLight: 'M68 139C49 122 35 126 33 132C40 147 53 150 68 149Z',
      stem: 'M70 154V105',
    },
    mature: {
      leafDeep: 'M72 145C93 122 108 127 110 134C102 150 87 153 72 152Z',
      leafLight: 'M68 139C47 120 32 125 30 131C38 148 53 151 68 149Z',
      stem: 'M70 154V102',
    },
  },
  'ivory-magnolia': {
    growing: {
      leafDeep: 'M72 145C91 125 105 129 107 135C100 149 87 152 72 151Z',
      leafLight: 'M68 139C49 122 35 126 33 132C40 147 53 150 68 149Z',
      stem: 'M70 154V95',
    },
    mature: {
      leafDeep: 'M72 145C94 122 109 127 111 134C103 150 88 153 72 152Z',
      leafLight: 'M68 140C46 121 31 126 29 133C38 149 52 152 68 149Z',
      stem: 'M70 154V98',
    },
  },
  'plum-snapdragon': {
    growing: {
      leafDeep: 'M71 138C85 123 97 125 99 130C93 143 84 147 71 148Z',
      leafLight: 'M69 127C54 114 41 116 39 121C45 134 55 140 69 140Z',
      stem: 'M70 154C71 126 69 99 70 71',
    },
    mature: {
      leafDeep: 'M71 137C86 121 99 123 101 128C95 141 85 146 71 147Z',
      leafLight: 'M69 126C53 112 39 114 37 119C43 133 53 139 69 139Z',
      stem: 'M70 154C71 119 68 78 70 34',
    },
  },
  'rose-lotus': {
    growing: {
      leafDeep: 'M72 145C91 125 106 129 108 135C101 149 87 152 72 151Z',
      leafLight: 'M68 139C49 122 34 126 32 132C40 147 53 151 68 149Z',
      stem: 'M70 154V91',
    },
    mature: {
      leafDeep: 'M72 145C93 123 109 128 111 135C103 150 88 153 72 152Z',
      leafLight: 'M68 139C47 120 31 126 29 133C38 149 52 152 68 149Z',
      stem: 'M70 154V100',
    },
  },
  'ruby-bleeding-heart': {
    growing: {
      detail: 'M63 89L53 95',
      leafDeep: 'M72 145C90 126 104 129 106 135C99 149 86 152 72 151Z',
      leafLight: 'M68 138C50 121 36 124 34 130C41 145 54 149 68 147Z',
      stem: 'M70 154C70 126 73 101 61 82C56 74 50 71 44 73',
    },
    mature: {
      detail: 'M60 51L45 58M66 70L54 78M69 91L60 98',
      leafDeep: 'M72 143C91 122 106 126 108 132C101 148 87 151 72 150Z',
      leafLight: 'M68 135C49 116 34 120 32 126C39 143 53 148 68 145Z',
      stem: 'M69 154C70 116 77 72 55 40C48 30 37 27 27 32',
    },
  },
  'sunset-zinnia': {
    growing: {
      leafDeep: 'M72 144C89 127 102 130 104 135C97 148 85 151 72 150Z',
      leafLight: 'M68 136C51 121 38 124 36 129C43 143 54 147 68 146Z',
      stem: 'M70 154V104',
    },
    mature: {
      leafDeep: 'M72 143C90 124 104 128 106 133C98 147 86 150 72 150Z',
      leafLight: 'M68 134C49 117 35 121 33 126C40 142 53 146 68 145Z',
      stem: 'M70 154V97',
    },
  },
  'twilight-lupine': {
    growing: {
      leafDeep: 'M71 138C86 122 99 125 101 130C95 143 85 147 71 148Z',
      leafLight: 'M69 128C53 114 39 117 37 122C43 136 54 141 69 140Z',
      stem: 'M70 154V67',
    },
    mature: {
      leafDeep: 'M71 136C87 120 102 123 105 128C98 143 86 147 71 148Z',
      leafLight: 'M69 126C51 111 36 115 34 120C41 136 54 141 69 139Z',
      stem: 'M70 154V36',
    },
  },
  'velvet-foxglove': {
    growing: {
      leafDeep: 'M71 138C86 121 99 124 101 129C95 142 85 147 71 148Z',
      leafLight: 'M69 127C53 111 39 114 37 119C43 134 54 140 69 140Z',
      stem: 'M70 154C70 126 69 99 70 70',
    },
    mature: {
      leafDeep: 'M71 135C87 117 101 120 103 125C96 140 87 145 71 147Z',
      leafLight: 'M69 125C52 108 37 111 35 116C41 132 52 139 69 139Z',
      stem: 'M70 154C70 116 68 73 70 31',
    },
  },
}

function GardenPlantBody({
  definition,
  stage,
}: Readonly<{ definition: GardenPlantDefinition; stage: VisiblePlantStage }>) {
  const body = stage === 'dormant' ? dormantBody : floweringBodies[definition.kind][stage]

  return (
    <g className="garden-plot__stem-and-leaves" transform="scale(.8)">
      <path
        className="garden-plot__stem"
        d={body.stem}
        data-plant-stem={`${definition.kind}-${stage}`}
        fill="none"
        stroke={ink}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        className="garden-plot__leaf"
        d={body.leafLight}
        fill="var(--garden-leaf-light)"
        stroke={ink}
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        className="garden-plot__leaf"
        d={body.leafDeep}
        fill="var(--garden-leaf-deep)"
        stroke={ink}
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      {body.detail === undefined ? null : (
        <path
          d={body.detail}
          fill="none"
          stroke={ink}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </g>
  )
}

function GardenPlantPot({ color }: Readonly<{ color: string }>) {
  return (
    <g className="garden-plot__pot" transform="scale(.8)">
      <ellipse cx="70" cy="155" fill="var(--garden-soil)" rx="29" ry="6" />
      <path
        d="M39 159H101L95 184C79 189 61 189 45 184Z"
        fill={color}
        stroke={ink}
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <rect
        x="35"
        y="150"
        width="70"
        height="14"
        rx="4"
        fill={color}
        stroke={ink}
        strokeWidth="3"
      />
      <path
        d="M42 164H98"
        fill="none"
        stroke="var(--garden-pot-detail)"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </g>
  )
}

export function GardenPlantArtwork({
  definition,
  stage,
}: Readonly<{ definition: GardenPlantDefinition; stage: VisiblePlantStage }>) {
  return (
    <>
      <GardenPlantBody definition={definition} stage={stage} />
      {stage === 'mature' ? (
        <GardenMatureHead
          accentColor={definition.accentColor}
          centerColor={definition.centerColor}
          kind={definition.kind}
          petalColor={definition.petalColor}
        />
      ) : stage === 'growing' ? (
        <GardenGrowingBud
          accentColor={definition.accentColor}
          centerColor={definition.centerColor}
          kind={definition.kind}
          petalColor={definition.petalColor}
        />
      ) : null}
      <GardenPlantPot color={definition.potColor} />
    </>
  )
}
