import type { PathProgress, SkillId, SkillProgress } from '@little-tables/domain'

import { useI18n } from '../i18n.js'
import { pathSymbols } from '../learning-path-symbols.js'

function SkillCard({
  onChoose,
  skill,
  tablesAcquired,
}: Readonly<{
  onChoose: (skill: SkillId) => void
  skill: SkillProgress
  tablesAcquired: boolean
}>) {
  const { t } = useI18n()
  const growing = skill.growing + skill.familiar
  const summary = t('tables.summary', {
    growing,
    newCount: skill.unseen,
    rooted: skill.fluent,
  })
  const lockReason = !tablesAcquired ? t('paths.notYet') : t(`lock.${skill.id}`)
  return (
    <article className={`table-progress-card skill-card${skill.open ? '' : ' is-locked'}`}>
      <header>
        <strong>{t(`skill.${skill.id}`)}</strong>
        <span>{skill.total === 0 ? '—' : `${skill.fluent}/${skill.total}`}</span>
      </header>
      {skill.total === 0 ? null : (
        <div aria-label={summary} className="table-progress-track" role="img">
          <i className="table-progress-rooted" style={{ flexGrow: skill.fluent }} />
          <i className="table-progress-growing" style={{ flexGrow: growing }} />
          <i className="table-progress-new" style={{ flexGrow: skill.unseen }} />
        </div>
      )}
      {skill.open ? (
        <>
          <p>{summary}</p>
          <button onClick={() => onChoose(skill.id)} type="button">
            {t('paths.choose')}
          </button>
        </>
      ) : (
        <p className="skill-lock">{lockReason}</p>
      )}
    </article>
  )
}

type PathProgressSectionProps = Readonly<{
  onChoose: (skill: SkillId) => void
  paths: ReadonlyArray<PathProgress>
  tablesAcquired: boolean
}>

/** The three new paths in Stats: open skills can be practised, closed ones say when they open. */
export function PathProgressSection({ onChoose, paths, tablesAcquired }: PathProgressSectionProps) {
  const { t } = useI18n()
  return (
    <section className="table-progress-section path-progress-section">
      <header>
        <h2>{t('stats.pathsHeading')}</h2>
      </header>
      {paths.map((path) => (
        <section aria-labelledby={`path-${path.id}`} className="path-progress" key={path.id}>
          <header>
            <span aria-hidden="true" className="curriculum-symbol">
              {pathSymbols[path.id]}
            </span>
            <div>
              <h3 id={`path-${path.id}`}>{t(`path.${path.id}`)}</h3>
              <p>{t(`path.${path.id}.intro`)}</p>
            </div>
          </header>
          <div className="table-progress-list">
            {path.skills.map((skill) => (
              <SkillCard
                key={skill.id}
                onChoose={onChoose}
                skill={skill}
                tablesAcquired={tablesAcquired}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}
