import type { ComponentType, ReactNode } from 'react'

type FlowerRenderProps = Readonly<{
  accentColor: string
  centerColor: string
  petalColor: string
}>

type GardenPlantRenderer = Readonly<{
  GrowingBud: ComponentType<FlowerRenderProps>
  MatureHead: ComponentType<FlowerRenderProps>
}>

const ink = 'var(--ink-primary)'

function FlowerGroup({ children, kind }: Readonly<{ children: ReactNode; kind: string }>) {
  return <g className={`garden-plot__flower garden-plot__flower--${kind}`}>{children}</g>
}

function RoseLotusGrowing({ accentColor, petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="rose-lotus">
      <g stroke={ink} strokeLinejoin="round" strokeWidth="2.5" transform="scale(.8)">
        <path d="M70 99C55 89 50 74 57 64C68 65 73 79 70 99Z" fill={petalColor} />
        <path d="M70 99C85 89 90 74 83 64C72 65 67 79 70 99Z" fill={petalColor} />
        <path d="M70 98C62 83 64 70 70 64C78 72 78 84 70 98Z" fill={accentColor} />
      </g>
    </FlowerGroup>
  )
}

function RoseLotusMature({ accentColor, centerColor, petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="rose-lotus">
      <g
        stroke={ink}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        transform="scale(.8)"
      >
        <g fill={petalColor}>
          <path d="M70 83C48 62 42 43 52 34C65 38 71 56 70 83Z" />
          <path d="M70 83C92 62 98 43 88 34C75 38 69 56 70 83Z" />
          <path d="M65 88C40 78 27 64 33 53C48 51 61 64 65 88Z" />
          <path d="M75 88C100 78 113 64 107 53C92 51 79 64 75 88Z" />
        </g>
        <g fill={accentColor}>
          <path d="M70 84C55 64 54 48 64 41C76 49 78 65 70 84Z" />
          <path d="M70 84C85 64 86 48 76 41C64 49 62 65 70 84Z" />
          <path d="M70 91C49 89 34 81 35 69C48 62 62 70 70 91Z" />
          <path d="M70 91C91 89 106 81 105 69C92 62 78 70 70 91Z" />
        </g>
        <path
          d="M53 84C62 88 78 88 87 84C84 98 77 105 70 105C63 105 56 98 53 84Z"
          fill={centerColor}
        />
      </g>
    </FlowerGroup>
  )
}

function TwilightLupineGrowing({ petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="twilight-lupine">
      <g fill={petalColor} stroke={ink} strokeWidth="2.5" transform="scale(.8)">
        <ellipse cx="70" cy="65" rx="7" ry="8" />
        <ellipse cx="62" cy="78" rx="8" ry="9" transform="rotate(-22 62 78)" />
        <ellipse cx="78" cy="78" rx="8" ry="9" transform="rotate(22 78 78)" />
        <ellipse cx="58" cy="93" rx="8" ry="10" transform="rotate(-26 58 93)" />
        <ellipse cx="73" cy="94" rx="8" ry="10" transform="rotate(18 73 94)" />
      </g>
    </FlowerGroup>
  )
}

function TwilightLupineMature({ petalColor }: FlowerRenderProps) {
  const florets = [
    [70, 34, 7, 9, 0],
    [61, 48, 8, 10, -22],
    [79, 48, 8, 10, 22],
    [55, 64, 9, 11, -28],
    [70, 63, 9, 11, 0],
    [85, 64, 9, 11, 28],
    [52, 82, 9, 11, -32],
    [67, 81, 9, 11, -8],
    [83, 82, 9, 11, 20],
    [58, 99, 10, 11, -22],
    [77, 100, 10, 11, 18],
  ] as const
  return (
    <FlowerGroup kind="twilight-lupine">
      <g fill={petalColor} stroke={ink} strokeWidth="2.5" transform="scale(.8)">
        {florets.map(([cx, cy, rx, ry, rotate]) => (
          <ellipse
            cx={cx}
            cy={cy}
            key={`${cx}-${cy}`}
            rx={rx}
            ry={ry}
            transform={rotate === 0 ? undefined : `rotate(${rotate} ${cx} ${cy})`}
          />
        ))}
      </g>
    </FlowerGroup>
  )
}

function BellStem({ mature, petalColor }: FlowerRenderProps & Readonly<{ mature: boolean }>) {
  const bells = mature
    ? [
        [
          'M69 39C55 35 47 41 48 51C49 60 58 62 66 58C62 54 62 48 69 39Z',
          'M51 52C55 54 60 54 65 52',
        ],
        [
          'M71 57C86 52 95 58 94 68C93 77 84 80 75 76C80 71 79 65 71 57Z',
          'M77 70C82 72 87 71 91 68',
        ],
        [
          'M69 78C54 73 45 79 46 90C47 99 57 101 66 97C61 92 61 85 69 78Z',
          'M49 91C54 94 60 94 65 91',
        ],
        [
          'M71 98C84 94 93 100 92 109C91 117 83 120 75 116C79 112 79 105 71 98Z',
          'M77 110C81 112 86 111 89 108',
        ],
      ]
    : [
        [
          'M69 78C58 74 51 79 52 87C53 95 60 97 67 93C63 89 63 84 69 78Z',
          'M55 87C58 89 62 89 66 87',
        ],
        [
          'M71 94C83 90 90 95 89 103C88 111 81 113 74 109C78 105 77 100 71 94Z',
          'M76 103C80 105 84 104 87 102',
        ],
      ]
  return (
    <g transform="scale(.8)">
      {bells.map(([shape, detail]) => (
        <g key={shape}>
          <path d={shape} fill={petalColor} stroke={ink} strokeLinejoin="round" strokeWidth="2.5" />
          <path d={detail} fill="none" stroke={ink} strokeLinecap="round" strokeWidth="2" />
        </g>
      ))}
    </g>
  )
}

function VelvetFoxgloveGrowing(props: FlowerRenderProps) {
  return (
    <FlowerGroup kind="velvet-foxglove">
      <BellStem {...props} mature={false} />
    </FlowerGroup>
  )
}

function VelvetFoxgloveMature(props: FlowerRenderProps) {
  return (
    <FlowerGroup kind="velvet-foxglove">
      <BellStem {...props} mature />
    </FlowerGroup>
  )
}

function SnapdragonStem({ mature, petalColor }: FlowerRenderProps & Readonly<{ mature: boolean }>) {
  const blooms = mature
    ? [
        'M69 39C57 30 47 36 49 46C51 55 60 57 68 52C62 49 62 44 69 39Z',
        'M71 54C83 44 94 50 92 61C90 70 80 72 72 67C79 64 78 59 71 54Z',
        'M69 70C56 60 45 66 47 77C49 86 59 88 68 83C61 80 61 75 69 70Z',
        'M71 86C84 76 95 82 93 93C91 102 81 104 72 99C79 96 79 91 71 86Z',
        'M69 103C57 94 47 100 49 110C51 119 60 121 68 116C62 113 62 108 69 103Z',
      ]
    : [
        'M69 78C59 70 50 75 52 84C54 91 61 93 68 89C63 86 63 82 69 78Z',
        'M71 91C81 83 90 88 88 97C86 104 79 106 72 102C77 99 77 95 71 91Z',
        'M69 105C59 98 51 103 53 111C55 118 62 120 68 116C63 114 63 109 69 105Z',
      ]
  return (
    <g
      fill={petalColor}
      stroke={ink}
      strokeLinejoin="round"
      strokeWidth="2.5"
      transform="scale(.8)"
    >
      {blooms.map((shape) => (
        <path d={shape} key={shape} />
      ))}
    </g>
  )
}

function PlumSnapdragonGrowing(props: FlowerRenderProps) {
  return (
    <FlowerGroup kind="plum-snapdragon">
      <SnapdragonStem {...props} mature={false} />
    </FlowerGroup>
  )
}

function PlumSnapdragonMature(props: FlowerRenderProps) {
  return (
    <FlowerGroup kind="plum-snapdragon">
      <SnapdragonStem {...props} mature />
    </FlowerGroup>
  )
}

function SunsetZinniaGrowing({ centerColor, petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="sunset-zinnia">
      <g fill={petalColor} stroke={ink} strokeWidth="2.5" transform="scale(.8)">
        <ellipse cx="70" cy="87" rx="6" ry="12" />
        <ellipse cx="70" cy="113" rx="6" ry="12" />
        <ellipse cx="57" cy="100" rx="12" ry="6" />
        <ellipse cx="83" cy="100" rx="12" ry="6" />
        <circle cx="70" cy="100" fill={centerColor} r="8" />
      </g>
    </FlowerGroup>
  )
}

function SunsetZinniaMature({ accentColor, centerColor, petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="sunset-zinnia">
      <g stroke={ink} strokeWidth="2.5" transform="scale(.8)">
        <g fill={petalColor}>
          <ellipse cx="70" cy="30" rx="8" ry="19" />
          <ellipse cx="70" cy="98" rx="8" ry="19" />
          <ellipse cx="36" cy="64" rx="19" ry="8" />
          <ellipse cx="104" cy="64" rx="19" ry="8" />
          <ellipse cx="46" cy="40" rx="8" ry="19" transform="rotate(-45 46 40)" />
          <ellipse cx="94" cy="88" rx="8" ry="19" transform="rotate(-45 94 88)" />
          <ellipse cx="94" cy="40" rx="8" ry="19" transform="rotate(45 94 40)" />
          <ellipse cx="46" cy="88" rx="8" ry="19" transform="rotate(45 46 88)" />
        </g>
        <g fill={accentColor}>
          <ellipse cx="70" cy="45" rx="7" ry="14" />
          <ellipse cx="70" cy="83" rx="7" ry="14" />
          <ellipse cx="51" cy="64" rx="14" ry="7" />
          <ellipse cx="89" cy="64" rx="14" ry="7" />
          <ellipse cx="57" cy="51" rx="7" ry="14" transform="rotate(-45 57 51)" />
          <ellipse cx="83" cy="77" rx="7" ry="14" transform="rotate(-45 83 77)" />
          <ellipse cx="83" cy="51" rx="7" ry="14" transform="rotate(45 83 51)" />
          <ellipse cx="57" cy="77" rx="7" ry="14" transform="rotate(45 57 77)" />
        </g>
        <circle cx="70" cy="64" fill={centerColor} r="12" />
      </g>
    </FlowerGroup>
  )
}

const heartPath = (x: number, y: number, size: number) =>
  `M${x} ${y}C${x + size * 0.25} ${y - size * 0.45} ${x + size * 0.75} ${y - size * 0.35} ${x + size * 0.9} ${y}C${x + size * 1.05} ${y - size * 0.35} ${x + size * 1.55} ${y - size * 0.45} ${x + size * 1.8} ${y}C${x + size * 1.75} ${y + size * 0.55} ${x + size * 1.25} ${y + size * 0.9} ${x + size * 0.9} ${y + size * 1.25}C${x + size * 0.55} ${y + size * 0.9} ${x + size * 0.05} ${y + size * 0.55} ${x} ${y}Z`

function RubyHeartGrowing({ petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="ruby-bleeding-heart">
      <g transform="scale(.8)">
        <path
          d={heartPath(48, 91, 12)}
          fill={petalColor}
          stroke={ink}
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      </g>
    </FlowerGroup>
  )
}

function RubyHeartMature({ petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="ruby-bleeding-heart">
      <g transform="scale(.8)">
        <g fill={petalColor} stroke={ink} strokeLinejoin="round" strokeWidth="2.5">
          <path d={heartPath(33, 55, 20)} />
          <path d={heartPath(43, 76, 20)} />
          <path d={heartPath(50, 98, 20)} />
        </g>
      </g>
    </FlowerGroup>
  )
}

function BlushingPeonyGrowing({ accentColor, petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="blushing-peony">
      <g stroke={ink} strokeLinejoin="round" strokeWidth="2.5" transform="scale(.8)">
        <path
          d="M70 112C57 115 48 106 52 96C43 89 48 77 58 78C61 67 76 66 80 77C92 76 97 89 88 97C92 108 82 116 70 112Z"
          fill={petalColor}
        />
        <path
          d="M70 106C62 110 56 103 60 96C55 90 63 83 70 88C76 82 85 90 80 97C84 104 77 109 70 106Z"
          fill={accentColor}
        />
      </g>
    </FlowerGroup>
  )
}

function BlushingPeonyMature({ accentColor, centerColor, petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="blushing-peony">
      <g stroke={ink} strokeLinejoin="round" strokeWidth="2.5" transform="scale(.8)">
        <path
          d="M70 94C52 103 35 96 35 82C20 76 21 59 34 51C29 37 43 27 56 33C62 18 80 18 86 33C101 26 113 39 107 52C122 59 120 78 105 83C104 98 87 103 70 94Z"
          fill={petalColor}
        />
        <path
          d="M70 88C55 96 43 87 47 76C35 69 40 55 51 54C51 41 66 37 72 47C82 38 95 46 92 58C104 65 98 79 87 79C85 90 77 94 70 88Z"
          fill={accentColor}
        />
        <path
          d="M70 80C61 86 54 78 59 70C53 61 63 54 70 60C77 53 87 61 82 70C87 79 78 85 70 80Z"
          fill={accentColor}
        />
        <circle cx="70" cy="69" fill={centerColor} r="7" />
      </g>
    </FlowerGroup>
  )
}

function IvoryMagnoliaGrowing({ accentColor, petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="ivory-magnolia">
      <g stroke={ink} strokeLinejoin="round" strokeWidth="2.5" transform="scale(.8)">
        <path d="M70 102C55 91 52 75 60 65C70 67 75 81 70 102Z" fill={petalColor} />
        <path d="M70 102C85 91 88 75 80 65C70 67 65 81 70 102Z" fill={petalColor} />
        <path d="M70 101C63 84 65 70 70 64C77 72 77 86 70 101Z" fill={accentColor} />
      </g>
    </FlowerGroup>
  )
}

function IvoryMagnoliaMature({ accentColor, centerColor, petalColor }: FlowerRenderProps) {
  return (
    <FlowerGroup kind="ivory-magnolia">
      <g stroke={ink} strokeLinejoin="round" strokeWidth="2.5" transform="scale(.8)">
        <g fill={petalColor}>
          <path d="M70 88C48 76 39 59 46 44C60 43 69 59 70 88Z" />
          <path d="M70 88C92 76 101 59 94 44C80 43 71 59 70 88Z" />
          <path d="M66 91C43 94 29 86 30 72C42 62 57 72 66 91Z" />
          <path d="M74 91C97 94 111 86 110 72C98 62 83 72 74 91Z" />
        </g>
        <g fill={accentColor}>
          <path d="M70 86C58 65 60 48 70 39C80 48 82 65 70 86Z" />
          <path d="M70 91C55 86 49 74 55 64C67 65 71 76 70 91Z" />
          <path d="M70 91C85 86 91 74 85 64C73 65 69 76 70 91Z" />
        </g>
        <path d="M62 84H78L75 101H65Z" fill={centerColor} />
      </g>
    </FlowerGroup>
  )
}

function WisteriaCluster({
  mature,
  accentColor,
  petalColor,
}: FlowerRenderProps & Readonly<{ mature: boolean }>) {
  const flowers: ReadonlyArray<readonly [number, number]> = mature
    ? [
        [36, 52],
        [43, 68],
        [49, 85],
        [55, 102],
      ]
    : [
        [47, 96],
        [53, 110],
      ]
  return (
    <g transform="scale(.8)">
      {flowers.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <path
            d={`M${x} ${y}C${x + 6} ${y - 6} ${x + 16} ${y - 3} ${x + 19} ${y + 5}C${x + 17} ${y + 15} ${x + 7} ${y + 18} ${x} ${y + 11}C${x - 4} ${y + 7} ${x - 4} ${y + 4} ${x} ${y}Z`}
            fill={petalColor}
            stroke={ink}
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
          <circle cx={x + 10} cy={y + 6} fill={accentColor} r="3" stroke={ink} strokeWidth="1.5" />
        </g>
      ))}
    </g>
  )
}

function BlueWisteriaGrowing(props: FlowerRenderProps) {
  return (
    <FlowerGroup kind="blue-wisteria">
      <WisteriaCluster {...props} mature={false} />
    </FlowerGroup>
  )
}

function BlueWisteriaMature(props: FlowerRenderProps) {
  return (
    <FlowerGroup kind="blue-wisteria">
      <WisteriaCluster {...props} mature />
    </FlowerGroup>
  )
}

const gardenPlantRenderers = {
  'blue-wisteria': { GrowingBud: BlueWisteriaGrowing, MatureHead: BlueWisteriaMature },
  'blushing-peony': { GrowingBud: BlushingPeonyGrowing, MatureHead: BlushingPeonyMature },
  'ivory-magnolia': { GrowingBud: IvoryMagnoliaGrowing, MatureHead: IvoryMagnoliaMature },
  'plum-snapdragon': { GrowingBud: PlumSnapdragonGrowing, MatureHead: PlumSnapdragonMature },
  'rose-lotus': { GrowingBud: RoseLotusGrowing, MatureHead: RoseLotusMature },
  'ruby-bleeding-heart': { GrowingBud: RubyHeartGrowing, MatureHead: RubyHeartMature },
  'sunset-zinnia': { GrowingBud: SunsetZinniaGrowing, MatureHead: SunsetZinniaMature },
  'twilight-lupine': { GrowingBud: TwilightLupineGrowing, MatureHead: TwilightLupineMature },
  'velvet-foxglove': { GrowingBud: VelvetFoxgloveGrowing, MatureHead: VelvetFoxgloveMature },
} as const satisfies Readonly<Record<string, GardenPlantRenderer>>

export type GardenPlantKind = keyof typeof gardenPlantRenderers

type GardenFlowerProps = FlowerRenderProps & Readonly<{ kind: GardenPlantKind }>

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

export function GardenRewardFlower({ kind, ...colors }: GardenFlowerProps) {
  return (
    <svg aria-hidden="true" className="reward-flower" viewBox="0 0 112 146">
      <path
        className="reward-stem"
        d="M56 138V76M55 112C43 101 34 103 33 106C36 116 43 122 55 123M57 110C68 97 79 99 81 102C78 115 69 120 57 121"
      />
      <GardenMatureHead kind={kind} {...colors} />
    </svg>
  )
}
