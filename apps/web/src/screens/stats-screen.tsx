import { LearningEngine, type SkillId } from '@little-tables/domain'

import { PathProgressSection } from '../components/learning-path-progress.js'
import { TableProgressCard } from '../components/table-progress-card.js'
import { learningPathsFor } from '../learning-path-settings.js'
import { useFamilyProfile } from '../use-family-profile.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { usePracticeLauncher } from '../hooks/use-practice-launcher.js'
import { useI18n } from '../i18n.js'

export function StatsScreen() {
  const { t } = useI18n()
  const bootstrap = useLocalBootstrap()
  const data = bootstrap.data
  const launcher = usePracticeLauncher(data)
  const { activeProfile } = useFamilyProfile()
  const progress = LearningEngine.deriveLearningProgress({
    curriculum: {
      packs: ['core', 'bonus-11-12', 'inverse-division'],
      paths: learningPathsFor(activeProfile),
    },
    snapshot: data?.snapshot ?? LearningEngine.emptySnapshot(),
  })
  const { divisionFacts, facts, packs, paths, tables } = progress
  const pathFacts = paths.flatMap(({ skills }) => skills)
  const rootedPathLevels = pathFacts.reduce((total, skill) => total + skill.fluent, 0)
  const familiarPathLevels = pathFacts.reduce((total, skill) => total + skill.familiar, 0)
  const growingPathLevels = pathFacts.reduce((total, skill) => total + skill.growing, 0)
  const metPathLevels = pathFacts.reduce((total, skill) => total + skill.total - skill.unseen, 0)

  const chooseSkill = (skill: SkillId) => {
    if (data?.activeSession !== null && data?.activeSession !== undefined) {
      void launcher.resume()
      return
    }
    void launcher.startSkill(skill)
  }

  const chooseTable = (table: number) => {
    if (data?.activeSession !== null && data?.activeSession !== undefined) {
      void launcher.resume()
      return
    }
    if (table === 11 || table === 12) void launcher.startTableElevenOrTwelve(table)
    else void launcher.startTable(table)
  }

  const chooseDivision = () => {
    if (data?.activeSession !== null && data?.activeSession !== undefined) {
      void launcher.resume()
      return
    }
    void launcher.startDivision()
  }

  return (
    <section className="stats-screen">
      <header>
        <p className="eyebrow">{t('stats.progress')}</p>
        <h1>{t('stats.heading')}</h1>
        <p>{t('stats.intro')}</p>
      </header>
      <div className="stat-hero">
        <strong>{facts.fluent + rootedPathLevels}</strong>
        <span>{t('stats.factsFluent')}</span>
      </div>
      <div className="stat-grid">
        <div>
          <strong>{facts.familiar + familiarPathLevels}</strong>
          <span>{t('stats.familiar')}</span>
        </div>
        <div>
          <strong>{facts.growing + growingPathLevels}</strong>
          <span>{t('stats.growing')}</span>
        </div>
        <div>
          <strong>{data?.completedSessions ?? 0}</strong>
          <span>{t('stats.tinyWins')}</span>
        </div>
        <div>
          <strong>{facts.total - facts.unseen + metPathLevels}</strong>
          <span>{t('stats.factsMet')}</span>
        </div>
      </div>

      <section className="table-progress-section">
        <header>
          <h2>{t('tables.heading')}</h2>
        </header>
        <div className="table-progress-list">
          {tables.map((table) => (
            <TableProgressCard key={table.table} onChoose={chooseTable} progress={table} />
          ))}
        </div>
      </section>

      <PathProgressSection
        onChoose={chooseSkill}
        paths={paths}
        tablesAcquired={packs.bonus1112.unlocked}
      />

      <section className="curriculum-section">
        <header>
          <p className="eyebrow">{t('curriculum.optional')}</p>
          <h2>{t('curriculum.heading')}</h2>
        </header>
        <div className={`curriculum-card${packs.bonus1112.unlocked ? '' : ' is-locked'}`}>
          <div>
            <span aria-hidden="true" className="curriculum-symbol">
              11·12
            </span>
            <div>
              <strong>
                {packs.bonus1112.unlocked ? t('curriculum.unlocked') : t('curriculum.locked')}
              </strong>
              {packs.bonus1112.unlocked ? (
                <>
                  <p>{t('curriculum.elevenPattern')}</p>
                  <p>{t('curriculum.twelvePattern')}</p>
                </>
              ) : null}
            </div>
          </div>
          {packs.bonus1112.unlocked ? (
            <div className="curriculum-actions">
              <button onClick={() => chooseTable(11)} type="button">
                {t('curriculum.table11')}
              </button>
              <button onClick={() => chooseTable(12)} type="button">
                {t('curriculum.table12')}
              </button>
            </div>
          ) : (
            <small>{t('curriculum.bonusNotYet')}</small>
          )}
        </div>

        <div className={`curriculum-card${packs.inverseDivision.unlocked ? '' : ' is-locked'}`}>
          <div>
            <span aria-hidden="true" className="curriculum-symbol">
              ÷
            </span>
            <div>
              <strong>{t('curriculum.divisionHeading')}</strong>
              <p>{t('curriculum.divisionIntro')}</p>
              {packs.inverseDivision.unlocked ? (
                <>
                  <p>{t('curriculum.divisionFamily', { answer: 56, left: 7, right: 8 })}</p>
                  <p>
                    {t('curriculum.divisionProgress', {
                      rooted: divisionFacts.fluent,
                      total: divisionFacts.total,
                    })}
                  </p>
                </>
              ) : null}
            </div>
          </div>
          {packs.inverseDivision.unlocked ? (
            <button onClick={chooseDivision} type="button">
              {t('curriculum.divisionTry')}
            </button>
          ) : (
            <small>{t('curriculum.divisionNotYet')}</small>
          )}
        </div>
      </section>

      <div className="progress-note">
        <span aria-hidden="true">✿</span>
        <p>{t('stats.note')}</p>
      </div>
    </section>
  )
}
