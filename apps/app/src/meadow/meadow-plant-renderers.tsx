/**
 * The nine flower heads of the verb meadow and its bud, in the garden's 140 × 190 frame before
 * `scale(.8)`, head centred on (70, 62). The paths are those of the R7 board in
 * `design/little-tables-rewrite.pen` (« Les fleurs du pré »).
 */
import type { MeadowSilhouette } from '@little-tables/engine/schema'
import type { ComponentType, ReactNode } from 'react'

export type MeadowColors = Readonly<{
  accent: string
  center: string
  petal: string
}>

const ink = 'var(--ink-primary)'

function Head({ children, kind }: Readonly<{ children: ReactNode; kind: string }>) {
  return (
    <g
      className={`meadow-plant__head meadow-plant__head--${kind}`}
      stroke={ink}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      transform="scale(.8)"
    >
      {children}
    </g>
  )
}

function Sunflower({ center, petal }: MeadowColors) {
  return (
    <Head kind="sunflower">
      <path
        d="M70 53a6 15 0 1 0 0-30 6 15 0 1 0 0 30z m3.9 0.9a6 15 25.71 1 0 13-27 6 15 25.71 1 0-13 27z m3.1 2.5a6 15 51.43 1 0 23.5-18.7 6 15 51.43 1 0-23.5 18.7z m1.8 3.6a6 15 77.14 1 0 29.2-6.7 6 15 77.14 1 0-29.2 6.7z m0 4a6 15 102.86 1 0 29.2 6.7 6 15 102.86 1 0-29.2-6.7z m-1.8 3.6a6 15 128.57 1 0 23.5 18.7 6 15 128.57 1 0-23.5-18.7z m-3.1 2.5a6 15 154.29 1 0 13 27 6 15 154.29 1 0-13-27z m-3.9 0.9a6 15 180 1 0 0 30 6 15 180 1 0 0-30z m-3.9-0.9a6 15 205.71 1 0-13 27 6 15 205.71 1 0 13-27z m-3.1-2.5a6 15 231.43 1 0-23.5 18.7 6 15 231.43 1 0 23.5-18.7z m-1.8-3.6a6 15 257.14 1 0-29.2 6.7 6 15 257.14 1 0 29.2-6.7z m0-4a6 15 282.86 1 0-29.2-6.7 6 15 282.86 1 0 29.2 6.7z m1.8-3.6a6 15 308.57 1 0-23.5-18.7 6 15 308.57 1 0 23.5 18.7z m3.1-2.5a6 15 334.29 1 0-13-27 6 15 334.29 1 0 13 27z"
        fill={petal}
      />
      <path d="M70 77a15 15 0 1 0 0-30 15 15 0 1 0 0 30z" fill={center} />
      <path d="M70 71a9 9 0 1 0 0-18 9 9 0 1 0 0 18z" fill="var(--meadow-heart)" />
    </Head>
  )
}

function Tulip({ accent, petal }: MeadowColors) {
  return (
    <Head kind="tulip">
      <path d="M70 92c-22-8-26-36-14-54 8 6 12 24 14 54z" fill={petal} />
      <path d="M70 92c22-8 26-36 14-54-8 6-12 24-14 54z" fill={petal} />
      <path d="M70 92c-10-20-12-42 0-58 12 16 10 38 0 58z" fill={accent} />
    </Head>
  )
}

function Daisy({ center, petal }: MeadowColors) {
  return (
    <Head kind="daisy">
      <path
        d="M70 59a5 17 0 1 0 0-34 5 17 0 1 0 0 34z m1.8 0.6a5 17 36 1 0 19.9-27.5 5 17 36 1 0-19.9 27.5z m1.1 1.5a5 17 72 1 0 32.3-10.5 5 17 72 1 0-32.3 10.5z m0 1.8a5 17 108 1 0 32.3 10.5 5 17 108 1 0-32.3-10.5z m-1.1 1.5a5 17 144 1 0 19.9 27.5 5 17 144 1 0-19.9-27.5z m-1.8 0.6a5 17 180 1 0 0 34 5 17 180 1 0 0-34z m-1.8-0.6a5 17 216 1 0-19.9 27.5 5 17 216 1 0 19.9-27.5z m-1.1-1.5a5 17 252 1 0-32.3 10.5 5 17 252 1 0 32.3-10.5z m0-1.8a5 17 288 1 0-32.3-10.5 5 17 288 1 0 32.3 10.5z m1.1-1.5a5 17 324 1 0-19.9-27.5 5 17 324 1 0 19.9 27.5z"
        fill={petal}
      />
      <path d="M70 71a9 9 0 1 0 0-18 9 9 0 1 0 0 18z" fill={center} />
    </Head>
  )
}

function Cosmos({ accent, center, petal }: MeadowColors) {
  return (
    <Head kind="cosmos">
      <path
        d="M70 61a10 17 0 1 0 0-34 10 17 0 1 0 0 34z m0.7 0.3a10 17 45 1 0 24-24 10 17 45 1 0-24 24z m0.3 0.7a10 17 90 1 0 34 0 10 17 90 1 0-34 0z m-0.3 0.7a10 17 135 1 0 24 24 10 17 135 1 0-24-24z m-0.7 0.3a10 17 180 1 0 0 34 10 17 180 1 0 0-34z m-0.7-0.3a10 17 225 1 0-24 24 10 17 225 1 0 24-24z m-0.3-0.7a10 17 270 1 0-34 0 10 17 270 1 0 34 0z m0.3-0.7a10 17 315 1 0-24-24 10 17 315 1 0 24 24z"
        fill={petal}
      />
      <path
        d="M70.4 61.1a6 11 22.5 1 0 8.4-20.3 6 11 22.5 1 0-8.4 20.3z m0.5 0.5a6 11 67.5 1 0 20.3-8.4 6 11 67.5 1 0-20.3 8.4z m0 0.8a6 11 112.5 1 0 20.3 8.4 6 11 112.5 1 0-20.3-8.4z m-0.5 0.5a6 11 157.5 1 0 8.4 20.3 6 11 157.5 1 0-8.4-20.3z m-0.8 0a6 11 202.5 1 0-8.4 20.3 6 11 202.5 1 0 8.4-20.3z m-0.5-0.5a6 11 247.5 1 0-20.3 8.4 6 11 247.5 1 0 20.3-8.4z m0-0.8a6 11 292.5 1 0-20.3-8.4 6 11 292.5 1 0 20.3 8.4z m0.5-0.5a6 11 337.5 1 0-8.4-20.3 6 11 337.5 1 0 8.4 20.3z"
        fill={accent}
      />
      <path d="M70 69a7 7 0 1 0 0-14 7 7 0 1 0 0 14z" fill={center} />
    </Head>
  )
}

function Bellflower({ accent, petal }: MeadowColors) {
  return (
    <Head kind="bellflower">
      <path
        d="M60 40c0-10 20-10 20 0 0 14 6 26 14 36-8 6-18 8-24 8-6 0-16-2-24-8 8-10 14-22 14-36z"
        fill={petal}
      />
      <path d="M66 42c0-4 8-4 8 0 0 14 2 26 6 36-6 2-14 2-20 0 4-10 6-22 6-36z" fill={accent} />
    </Head>
  )
}

function Cornflower({ accent, center, petal }: MeadowColors) {
  return (
    <Head kind="cornflower">
      <path
        d="M70 55l-5.9-10.9 5.9-11.1 5.9 11.1z m4.5 1.6l2.5-12.1 11.6-4.7-2.6 12.3z m2.4 4.2l9.7-7.7 12 3.9-9.9 7.7z m-0.8 4.7l12.4 0.3 6.6 10.7-12.6-0.4z m-3.7 3.1l9.3 8.2-1.8 12.5-9.4-8.5z m-4.8 0l1.9 12.2-9.4 8.5-1.8-12.5z m-3.7-3.1l-6.4 10.6-12.6 0.4 6.6-10.7z m-0.8-4.7l-11.8 3.9-9.9-7.7 12-3.9z m2.4-4.2l-11.5-4.5-2.6-12.3 11.6 4.7z"
        fill={petal}
      />
      <path
        d="M72.4 55.4l-2-7 6.8-6.1 1.3 9z m3.7 3.1l3-6.7 9.1-0.3-4.8 7.7z m0.8 4.7l6.6-3.2 7.2 5.6-8.7 2.9z m-2.4 4.2l7.1 1.8 1.9 8.9-8.5-3.4z m-4.5 1.6l4.3 6-4.3 8-4.3-8z m-4.5-1.6l-0.5 7.3-8.5 3.4 1.9-8.9z m-2.4-4.2l-5.1 5.3-8.7-2.9 7.2-5.6z m0.8-4.7l-7.3 0.7-4.8-7.7 9.1 0.3z m3.7-3.1l-6.1-4.1 1.3-9 6.8 6.1z"
        fill={accent}
      />
      <path d="M70 69a7 7 0 1 0 0-14 7 7 0 1 0 0 14z" fill={center} />
    </Head>
  )
}

function Dahlia({ accent, center, petal }: MeadowColors) {
  return (
    <Head kind="dahlia">
      <path
        d="M70 60a8 18 0 1 0 0-36 8 18 0 1 0 0 36z m1.4 0.6a8 18 45 1 0 25.5-25.5 8 18 45 1 0-25.5 25.5z m0.6 1.4a8 18 90 1 0 36 0 8 18 90 1 0-36 0z m-0.6 1.4a8 18 135 1 0 25.5 25.5 8 18 135 1 0-25.5-25.5z m-1.4 0.6a8 18 180 1 0 0 36 8 18 180 1 0 0-36z m-1.4-0.6a8 18 225 1 0-25.5 25.5 8 18 225 1 0 25.5-25.5z m-0.6-1.4a8 18 270 1 0-36 0 8 18 270 1 0 36 0z m0.6-1.4a8 18 315 1 0-25.5-25.5 8 18 315 1 0 25.5 25.5z"
        fill={petal}
      />
      <path
        d="M70 62a7 13 22.5 1 0 9.9-24 7 13 22.5 1 0-9.9 24z m0 0a7 13 67.5 1 0 24-9.9 7 13 67.5 1 0-24 9.9z m0 0a7 13 112.5 1 0 24 9.9 7 13 112.5 1 0-24-9.9z m0 0a7 13 157.5 1 0 9.9 24 7 13 157.5 1 0-9.9-24z m0 0a7 13 202.5 1 0-9.9 24 7 13 202.5 1 0 9.9-24z m0 0a7 13 247.5 1 0-24 9.9 7 13 247.5 1 0 24-9.9z m0 0a7 13 292.5 1 0-24-9.9 7 13 292.5 1 0 24 9.9z m0 0a7 13 337.5 1 0-9.9-24 7 13 337.5 1 0 9.9 24z"
        fill={accent}
      />
      <path d="M70 70a8 8 0 1 0 0-16 8 8 0 1 0 0 16z" fill={center} />
    </Head>
  )
}

function Poppy({ center, petal }: MeadowColors) {
  return (
    <Head kind="poppy">
      <path
        d="M77.1 56.9a12.6 12.6 0 1 1 0 14.2 12.6 12.6 0 1 1-14.2 0 12.6 12.6 0 1 1 0-14.2 12.6 12.6 0 1 1 14.2 0z"
        fill={petal}
      />
      <path d="M70 73a9 9 0 1 0 0-18 9 9 0 1 0 0 18z" fill={ink} />
      <path d="M70 68a4 4 0 1 0 0-8 4 4 0 1 0 0 8z" fill={center} />
    </Head>
  )
}

function Anemone({ accent, petal }: MeadowColors) {
  return (
    <Head kind="anemone">
      <path
        d="M70 51a10.1 10.1 0 1 1 9.5 5.5 10.1 10.1 0 1 1 0 11 10.1 10.1 0 1 1-9.5 5.5 10.1 10.1 0 1 1-9.5-5.5 10.1 10.1 0 1 1 0-11 10.1 10.1 0 1 1 9.5-5.5z"
        fill={petal}
      />
      <path d="M70 73a11 11 0 1 0 0-22 11 11 0 1 0 0 22z" fill={accent} />
      <path d="M70 67a5 5 0 1 0 0-10 5 5 0 1 0 0 10z" fill={ink} />
    </Head>
  )
}

const heads: Readonly<Record<MeadowSilhouette, ComponentType<MeadowColors>>> = {
  anemone: Anemone,
  bellflower: Bellflower,
  cornflower: Cornflower,
  cosmos: Cosmos,
  dahlia: Dahlia,
  daisy: Daisy,
  poppy: Poppy,
  sunflower: Sunflower,
  tulip: Tulip,
}

/** The flower of a verb at its mature stage. */
export function MeadowHead({
  silhouette,
  ...colors
}: MeadowColors & Readonly<{ silhouette: MeadowSilhouette }>) {
  const Head = heads[silhouette]
  return <Head {...colors} />
}

/** The one bud of every family: two closed petals in a point. */
export function MeadowBud({ accent, petal }: MeadowColors) {
  return (
    <Head kind="bud">
      <path d="M70 114c-12-8-12-24 0-32 12 8 12 24 0 32z" fill={petal} />
      <path d="M70 114c-5-8-5-22 0-28 5 6 5 20 0 28z" fill={accent} />
    </Head>
  )
}
