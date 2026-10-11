/**
 * The meadow's butterflies, from the R7 board (« Papillon · vol »), drawn about 42 × 36: one
 * shape, the wings painted after the species.
 */
import type { MeadowSpecies } from '@little-tables/engine/schema'
import { cn } from '@little-tables/ui'

type Paint = 'spot' | 'wing' | 'wingLight'

const species: Readonly<Record<MeadowSpecies, Readonly<Record<Paint, string>>>> = {
  brimstone: { spot: '#F99A54', wing: '#FDECA0', wingLight: '#FDDD7B' },
  'cabbage-white': { spot: '#4A4038', wing: '#FBF8EE', wingLight: '#ECE7D6' },
  'common-blue': { spot: '#5577C9', wing: '#A8C9F4', wingLight: '#CFE2FA' },
  peacock: { spot: '#4A68B8', wing: '#E0603F', wingLight: '#F2956A' },
  'red-admiral': { spot: '#F7F1E3', wing: '#4A3B45', wingLight: '#E8603E' },
  swallowtail: { spot: '#5C86D6', wing: '#F8E07A', wingLight: '#3F342A' },
}

const line = '#5A3D26'
const body = '#C28B56'

type Shape = Readonly<{
  fill: string
  stroke?: string
  strokeWidth?: number
  /** `x y` of the shape's top-left corner in the 52 × 44 frame. */
  translate: string
}> &
  (Readonly<{ d: string }> | Readonly<{ rotate: number; rx: number; ry: number }>)

/** Wing by wing, in the board's painting order: the wings overlap. */
const shapes: ReadonlyArray<Shape> = [
  {
    d: 'M2.67 4.63c-1.41 1.71-2.67 3.93-2.67 6.03 0 3.36 3.75 5 5.94 5 3.38 0 5.52-3.32 5.52-6.73 0-2.01-0.45-4.18-0.78-5.64l-1.62-3.29c-1.99 1.59-4.15 3.34-6.39 4.63z',
    fill: 'wing',
    stroke: line,
    strokeWidth: 0.74,
    translate: '18.49 25.28',
  },
  {
    d: 'M4.34 0c-1.56 1.94-4.34 4.92-4.34 6.78 0 1.44 1.17 2.22 2.12 2.22 1.04 0 2.07-0.85 2.35-2.42 0.32-1.85 0.15-4.71 0.06-6.48l-0.19-0.09z',
    fill: 'wingLight',
    translate: '23.3 25.38',
  },
  { fill: 'spot', rx: 1.63, ry: 1.95, rotate: 16.75, translate: '22.82 35.09' },
  { fill: 'spot', rx: 0.75, ry: 1.12, rotate: 19.19, translate: '21.29 32.91' },
  { fill: 'spot', rx: 0.67, ry: 0.98, rotate: 9.64, translate: '26.64 34.95' },
  {
    d: 'M7.82 0c4.19 0.05 7.85 2.06 7.85 5.74 0 3.18-2.5 6.45-5.58 6.45-4.37 0-7.03-4.19-8.77-6.83l-1.23-3.71-0.08-0.1c2.52-0.41 5.31-1.13 7.82-1.54z',
    fill: 'wing',
    stroke: line,
    strokeWidth: 0.74,
    translate: '29.88 22.65',
  },
  {
    d: 'M0 0c1.9 0.06 4.41 0.2 5.85 0.48 1.86 0.36 2.78 1.44 2.78 2.73 0 1.34-1.16 2.42-2.41 2.42-2.29 0-4.77-3.75-6.21-5.46l0-0.17z',
    fill: 'wingLight',
    translate: '30.17 24.45',
  },
  { fill: 'spot', rx: 1.92, ry: 1.7, rotate: 29.55, translate: '40.56 27.99' },
  { fill: 'spot', rx: 1.14, ry: 0.81, rotate: 27.63, translate: '40.45 25.16' },
  { fill: 'spot', rx: 0.96, ry: 0.66, rotate: 34.35, translate: '37.52 30.73' },
  {
    d: 'M12.91 0c2.23 0 3.25 1.71 3.25 4.11 0 1.89-0.73 3.26-0.73 4.15 0 0.9 0.65 1.64 0.65 3.51 0 3.97-2.86 6.33-7.07 7.68-2.64 0.82-5.69 1.55-8.19 1.83l-0.82-1.85c0.17-2.37 0.63-5.41 1.44-7.88 2.5-7.7 8.27-11.56 11.48-11.56z',
    fill: 'wing',
    stroke: line,
    strokeWidth: 0.74,
    translate: '29.14 3',
  },
  {
    d: 'M6.5 0c1.26 0 1.97 1.3 1.97 2.89 0 4.77-4.66 6.86-8.22 7.77l-0.25-1.07c1.37-4.11 3.97-9.59 6.5-9.59z',
    fill: 'wingLight',
    translate: '29.66 13.37',
  },
  { fill: 'spot', rx: 2.02, ry: 2.44, rotate: 47.15, translate: '40.95 4.68' },
  { fill: 'spot', rx: 1.11, ry: 1.32, rotate: 49.38, translate: '40.79 11.02' },
  { fill: 'spot', rx: 0.65, ry: 0.87, rotate: 49.38, translate: '41 15.25' },
  { fill: 'spot', rx: 0.75, ry: 1.12, rotate: 30.49, translate: '36.56 9.54' },
  {
    d: 'M6.39 0c5.25 0 10.3 2.74 13.73 5.95 0.07 1.02 0.35 1.78 0.92 2.28-3.02 2.66-7.61 5.87-10.54 5.87-2.82 0-5-1.88-5.98-4.41-0.22-0.6-0.56-1-1.11-1.38-1.9-1.29-3.42-2.9-3.42-4.58 0-2.4 3.35-3.73 6.39-3.73z',
    fill: 'wing',
    stroke: line,
    strokeWidth: 0.74,
    translate: '6.5 17.09',
  },
  {
    d: 'M2.44 0c2.11 0 5.47 1.43 7.29 2.16 0.1 0.5 0.3 0.92 0.59 1.18-1.68 1.15-3.94 2.3-5.76 2.3-2.72 0-4.57-2.37-4.57-3.78 0-1.26 1.17-1.86 2.44-1.86z',
    fill: 'wingLight',
    translate: '16.93 21.83',
  },
  { fill: 'spot', rx: 2.16, ry: 1.93, rotate: 0, translate: '9.37 19.24' },
  { fill: 'spot', rx: 1.2, ry: 1.08, rotate: 0, translate: '13.03 23.69' },
  { fill: 'spot', rx: 0.94, ry: 0.69, rotate: 23.19, translate: '15.3 19.99' },
  { fill: 'spot', rx: 0.79, ry: 0.62, rotate: 0, translate: '15.38 26.86' },
  {
    d: 'M4.35 4.1c-1.13-1.8-2.71-3.62-4.35-4.1',
    fill: 'none',
    stroke: line,
    strokeWidth: 0.64,
    translate: '20.71 14',
  },
  {
    d: 'M0.42 6.37c-0.53-2.24-0.61-4.64 0.06-6.37',
    fill: 'none',
    stroke: line,
    strokeWidth: 0.71,
    translate: '26.25 11.02',
  },
  {
    d: 'M1.56 0c0.33 0 0.53 0.24 0.53 0.54 0 0.55-0.48 1.01-1.01 1.31-0.47 0.26-0.85 0.62-1.08 0.92-0.02-1.56 0.89-2.77 1.56-2.77z',
    fill: body,
    stroke: line,
    strokeWidth: 0.6,
    translate: '26.67 8.52',
  },
  {
    d: 'M0.93 0c0.72 0 1.47 0.34 1.91 0.85-0.69-0.14-1.28 0.39-1.94 0.39-0.57 0-0.9-0.29-0.9-0.64 0-0.41 0.43-0.59 0.93-0.59z',
    fill: body,
    stroke: line,
    strokeWidth: 0.6,
    translate: '18.03 13.11',
  },
  {
    fill: body,
    rx: 2.51,
    ry: 2.51,
    rotate: 0,
    stroke: line,
    strokeWidth: 0.58,
    translate: '24.35 17.38',
  },
  { fill: '#4F2910', rx: 0.52, ry: 0.65, rotate: -15.11, translate: '24.89 19.74' },
  { fill: '#ffffff', rx: 0.18, ry: 0.18, rotate: 0, translate: '25.28 19.86' },
  { fill: '#4F2910', rx: 0.52, ry: 0.65, rotate: -15.11, translate: '27.27 18.8' },
  { fill: '#ffffff', rx: 0.18, ry: 0.18, rotate: 0, translate: '27.63 18.92' },
  {
    d: 'M0 0.32c0.27 0.47 1.02 0.17 0.86-0.32',
    fill: 'none',
    stroke: '#5A341F',
    strokeWidth: 0.37,
    translate: '26.62 20.33',
  },
  { fill: '#F7AB7D', rx: 0.49, ry: 0.4, rotate: 0, translate: '25.1 20.93' },
  { fill: '#F7AB7D', rx: 0.49, ry: 0.4, rotate: 0, translate: '28.07 19.73' },
  {
    d: 'M1.77 0c0.85 0.59 1.5 1.51 1.58 2.61 0.78 1.54 1.45 4.29 1.45 5.53 0 0.5-0.17 0.77-0.48 0.77-1.01 0-2.85-3.58-3.39-5.2-0.68-0.28-0.93-1.07-0.93-1.91 0-0.43 0.06-0.85 0.19-1.17 0.63-0.02 1.17-0.28 1.58-0.64z',
    fill: '#B57D4C',
    stroke: line,
    strokeWidth: 0.51,
    translate: '26.6 21.52',
  },
  {
    d: 'M2.41 0c0.18 0.46 0.35 0.98 0.48 1.52-0.48 0.68-1.4 1-2.14 0.95-0.31-0.52-0.59-1.02-0.75-1.47 0.98 0.16 1.89-0.32 2.41-1.01z',
    fill: '#D8A673',
    translate: '27.64 24.5',
  },
  {
    d: 'M1.8 0c0.13 0.41 0.28 0.87 0.36 1.29-0.29 0.54-0.91 0.75-1.41 0.69-0.29-0.39-0.54-0.81-0.75-1.17 0.75 0.07 1.42-0.31 1.8-0.82z',
    fill: '#D8A673',
    translate: '28.98 27.37',
  },
  {
    d: 'M2.14 0c0.12 0.43 0.26 0.87 0.36 1.27-0.45 0.65-1.25 0.87-1.86 0.82-0.24-0.4-0.46-0.81-0.64-1.18 0.8 0.06 1.66-0.31 2.14-0.91z',
    fill: '#A47044',
    translate: '28.38 26.08',
  },
  {
    d: 'M2.31 0c0.06 0.27 0.14 0.52 0.21 0.76-0.48 0.92-1.51 1.28-2.32 1.22-0.09-0.2-0.17-0.4-0.21-0.59 1.06 0.2 2.03-0.43 2.31-1.39z',
    fill: '#A47044',
    translate: '27.47 23.66',
  },
]

const paint = (fill: string, colors: Readonly<Record<Paint, string>>) =>
  fill in colors ? colors[fill as Paint] : fill

export function Butterfly({
  className,
  kind = 'brimstone',
}: Readonly<{ className?: string; kind?: MeadowSpecies }>) {
  const colors = species[kind]
  return (
    <svg
      aria-hidden
      className={cn('h-9 w-[2.62rem]', className)}
      data-butterfly={kind}
      viewBox="0 0 52 44"
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {shapes.map((shape) =>
          'd' in shape ? (
            <path
              d={shape.d}
              fill={paint(shape.fill, colors)}
              key={shape.translate}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
              transform={`translate(${shape.translate})`}
            />
          ) : (
            <ellipse
              cx={shape.rx}
              cy={shape.ry}
              fill={paint(shape.fill, colors)}
              key={shape.translate}
              rx={shape.rx}
              ry={shape.ry}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
              transform={`translate(${shape.translate}) rotate(${shape.rotate})`}
            />
          ),
        )}
      </g>
    </svg>
  )
}
