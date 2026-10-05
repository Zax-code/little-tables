import type { PathProgress, SkillId } from '@little-tables/domain'
import { useState } from 'react'

import { useI18n } from '../i18n.js'
import { pathSymbols } from '../learning-path-symbols.js'

const seenKey = (profileId: string) => `little-tables:new-paths-seen:${profileId}`

const readSeen = (profileId: string): boolean => {
  try {
    return window.localStorage.getItem(seenKey(profileId)) === '1'
  } catch {
    return false
  }
}

const rememberSeen = (profileId: string): void => {
  try {
    window.localStorage.setItem(seenKey(profileId), '1')
  } catch {
    // The card simply shows again next time.
  }
}

type NewPathsCardProps = Readonly<{
  automatic: boolean
  paths: ReadonlyArray<PathProgress>
  profileId: string
  tablesAcquired: boolean
}>

/** Celebrates, once per learner, the day tables 1–10 open the new paths. */
export function NewPathsCard({ automatic, paths, profileId, tablesAcquired }: NewPathsCardProps) {
  const { t } = useI18n()
  const [seen, setSeen] = useState(() => readSeen(profileId))
  if (seen || !automatic || !tablesAcquired || !paths.some(({ open }) => open)) return null
  const dismiss = () => {
    rememberSeen(profileId)
    setSeen(true)
  }
  return (
    <aside className="new-paths-card">
      <button
        aria-label={t('home.newPathDismiss')}
        className="new-paths-close"
        onClick={dismiss}
        type="button"
      >
        ×
      </button>
      <div aria-hidden="true" className="new-paths-symbols">
        {paths.flatMap(({ id, open }) => (open ? [<span key={id}>{pathSymbols[id]}</span>] : []))}
      </div>
      <strong>{t('home.newPathHeading')}</strong>
      <p>{t('home.newPathCopy')}</p>
      <button className="new-paths-action" onClick={dismiss} type="button">
        {t('home.newPathAction')}
      </button>
    </aside>
  )
}

type PathPickerProps = Readonly<{
  onChoose: (skill: SkillId) => void
  paths: ReadonlyArray<PathProgress>
}>

/** One row per open path inside “choose a little path”, one chip per open skill. */
export function PathPicker({ onChoose, paths }: PathPickerProps) {
  const { t } = useI18n()
  const open = paths.filter((path) => path.open)
  if (open.length === 0) return null
  return (
    <div className="path-picker">
      {open.map((path) => (
        <section aria-labelledby={`path-picker-${path.id}`} key={path.id}>
          <strong id={`path-picker-${path.id}`}>
            <span aria-hidden="true" className="path-symbol">
              {pathSymbols[path.id]}
            </span>
            {t(`path.${path.id}`)}
          </strong>
          <div>
            {path.skills.flatMap((skill) =>
              skill.open
                ? [
                    <button key={skill.id} onClick={() => onChoose(skill.id)} type="button">
                      {t(`skill.${skill.id}`)}
                    </button>,
                  ]
                : [],
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
