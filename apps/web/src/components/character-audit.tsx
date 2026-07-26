import type { CSSProperties, ReactNode } from 'react'

import {
  characterCatalog,
  type CharacterCatalogEntry,
  type CharacterSceneId,
} from '../character-catalog.js'
import { SelectedCharacterContext } from '../selected-character-context.js'
import { CelebrationSprite } from './celebration-sprite.js'
import { GardenWalkingSprite } from './garden-walking-sprite.js'
import { GardenWateringSprite } from './garden-watering-sprite.js'
import './character-audit.css'

const characters = Object.values(characterCatalog)

const staticScenes = [
  ['connectProfile', 'Connect profile'],
  ['home', 'Home'],
  ['practiceIdle', 'Practice idle'],
  ['practiceCorrect', 'Practice correct'],
  ['practiceEncourage', 'Practice encourage'],
  ['updateRecovery', 'Update recovery'],
] as const satisfies ReadonlyArray<readonly [CharacterSceneId, string]>

const sequences = [
  {
    columns: 4,
    frameCount: 4,
    framePrefix: 'C',
    rows: 1,
    sceneId: 'celebration',
  },
  {
    columns: 2,
    frameCount: 4,
    framePrefix: 'W',
    rows: 2,
    sceneId: 'gardenWalk',
  },
  {
    columns: 2,
    frameCount: 4,
    framePrefix: 'G',
    rows: 2,
    sceneId: 'gardenWater',
  },
] as const

function CharacterColumns({
  children,
}: Readonly<{
  children: (character: CharacterCatalogEntry) => ReactNode
}>) {
  return characters.map((character) => (
    <div className="character-audit__cell" key={character.id}>
      {children(character)}
    </div>
  ))
}

function SceneRow({
  children,
  label,
}: Readonly<{
  children: (character: CharacterCatalogEntry) => ReactNode
  label: string
}>) {
  return (
    <>
      <h2 className="character-audit__row-label">{label}</h2>
      <CharacterColumns>{children}</CharacterColumns>
    </>
  )
}

function Playback({
  character,
  staticMotion,
  sceneId,
}: Readonly<{
  character: CharacterCatalogEntry
  staticMotion: boolean
  sceneId: 'celebration' | 'gardenWalk' | 'gardenWater'
}>) {
  return (
    <SelectedCharacterContext value={character}>
      <div className="character-audit__playback">
        {sceneId === 'celebration' ? <CelebrationSprite /> : null}
        {sceneId === 'gardenWalk' ? (
          <>
            <GardenWalkingSprite facing="right" />
            <GardenWalkingSprite facing="left" />
          </>
        ) : null}
        {sceneId === 'gardenWater' ? (
          <>
            <GardenWateringSprite facing="right" reduceMotion={staticMotion} />
            <GardenWateringSprite facing="left" reduceMotion={staticMotion} />
          </>
        ) : null}
      </div>
    </SelectedCharacterContext>
  )
}

function SequenceFrame({
  character,
  columns,
  frameIndex,
  rows,
  sceneId,
}: Readonly<{
  character: CharacterCatalogEntry
  columns: number
  frameIndex: number
  rows: number
  sceneId: 'celebration' | 'gardenWalk' | 'gardenWater'
}>) {
  const column = frameIndex % columns
  const row = Math.floor(frameIndex / columns)
  const style = {
    backgroundImage: `url(${character.scenes[sceneId].src})`,
    backgroundPosition: `${columns === 1 ? 0 : (column / (columns - 1)) * 100}% ${
      rows === 1 ? 0 : (row / (rows - 1)) * 100
    }%`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
  } satisfies CSSProperties

  return <span aria-hidden="true" className="character-audit__frame" style={style} />
}

export function CharacterAudit() {
  const query = new URLSearchParams(window.location.search)
  const slowMotion = query.has('slow')
  const staticMotion = query.has('static')

  return (
    <main
      className={`character-audit${slowMotion ? ' character-audit--slow' : ''}${staticMotion ? ' character-audit--static' : ''}`}
    >
      <header>
        <p>Development-only fixture · six production characters</p>
        <h1>Character scene audit</h1>
        <p>
          Static scenes use their production rasters. Sprite rows use the production playback CSS,
          followed by every source cell in semantic order.
        </p>
      </header>

      <section className="character-audit__grid">
        <span aria-hidden="true" />
        {characters.map((character) => (
          <h2 className="character-audit__character-label" key={character.id}>
            {character.id}
          </h2>
        ))}

        {staticScenes.map(([sceneId, label]) => (
          <SceneRow key={sceneId} label={label}>
            {(character) => (
              <img
                alt={`${character.id} ${label}`}
                draggable={false}
                src={character.scenes[sceneId].src}
              />
            )}
          </SceneRow>
        ))}

        <SceneRow label="Celebration playback">
          {(character) => (
            <Playback character={character} sceneId="celebration" staticMotion={staticMotion} />
          )}
        </SceneRow>
        <SceneRow label="Garden walk playback · right / mirrored left">
          {(character) => (
            <Playback character={character} sceneId="gardenWalk" staticMotion={staticMotion} />
          )}
        </SceneRow>
        <SceneRow label="Garden water playback · right / mirrored left">
          {(character) => (
            <Playback character={character} sceneId="gardenWater" staticMotion={staticMotion} />
          )}
        </SceneRow>

        {sequences.flatMap((sequence) =>
          Array.from({ length: sequence.frameCount }, (_, frameIndex) => (
            <SceneRow
              key={`${sequence.sceneId}-${frameIndex}`}
              label={`${sequence.framePrefix}${frameIndex + 1}`}
            >
              {(character) => (
                <SequenceFrame
                  character={character}
                  columns={sequence.columns}
                  frameIndex={frameIndex}
                  rows={sequence.rows}
                  sceneId={sequence.sceneId}
                />
              )}
            </SceneRow>
          )),
        )}
      </section>
    </main>
  )
}
