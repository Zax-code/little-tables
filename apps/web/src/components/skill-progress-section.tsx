import { Ce2Engine, type Ce2Module, type Ce2Skill, type Ce2Snapshot } from '@little-tables/domain'

import { ce2Copy } from '../ce2-i18n.js'
import { useI18n } from '../i18n.js'

type SkillProgressSectionProps = Readonly<{
  available: boolean
  busy: boolean
  module: Ce2Module
  onChoose: (module: Ce2Module, skill: Ce2Skill) => void
  snapshot: Ce2Snapshot
}>

export function SkillProgressSection({
  available,
  busy,
  module,
  onChoose,
  snapshot,
}: SkillProgressSectionProps) {
  const { locale, t } = useI18n()
  const copy = ce2Copy(locale)
  const skills = module === 'arithmetic' ? Ce2Engine.arithmeticSkills : Ce2Engine.fractionSkills

  return (
    <section className="curriculum-section skill-progress-section">
      <header>
        <h2>{t(module === 'arithmetic' ? 'ce2.arithmetic' : 'ce2.fractions')}</h2>
        <p>{t('ce2.progressIntro')}</p>
      </header>
      {!available ? <p>{t('ce2.preparing')}</p> : null}
      {busy ? <p>{t('ce2.busy')}</p> : null}
      <div className="skill-progress-list">
        {skills.map((skill) => {
          const tiers = ([1, 2, 3, 4] as const).map((tier) => ({
            state: snapshot.mastery[Ce2Engine.masteryKey(skill, tier)]?.state ?? 'unseen',
            tier,
          }))
          const current = tiers.find(({ state }) => state !== 'fluent') ?? tiers[3]
          return (
            <article className="skill-progress-card" key={skill}>
              <div className="skill-progress-card__heading">
                <strong>{copy.skill(skill)}</strong>
                <span className="skill-progress-card__state">
                  {t('ce2.level', { level: current?.tier ?? 1 })} ·{' '}
                  {copy.stage(current?.state ?? 'unseen')}
                </span>
              </div>
              <div className="skill-progress-card__tiers">
                {tiers.map(({ state, tier }) => (
                  <span
                    aria-label={`${t('ce2.level', { level: tier })} : ${copy.stage(state)}`}
                    className={
                      state === 'fluent' ? 'is-rooted' : state === 'unseen' ? '' : 'is-growing'
                    }
                    key={tier}
                    role="img"
                  />
                ))}
              </div>
              <button
                aria-label={t('ce2.practiceSkill', { skill: copy.skill(skill) })}
                disabled={!available || busy}
                onClick={() => onChoose(module, skill)}
                type="button"
              >
                {t('ce2.openCourse')}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
