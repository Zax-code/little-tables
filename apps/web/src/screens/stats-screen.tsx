import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { useI18n } from '../i18n.js'

export function StatsScreen() {
  const { t } = useI18n()
  const bootstrap = useLocalBootstrap()
  const data = bootstrap.data
  const facts = Object.values(data?.snapshot.facts ?? {})
  const fluent = facts.filter((fact) => fact.state === 'fluent').length
  const familiar = facts.filter((fact) => fact.state === 'familiar').length
  const growing = facts.filter((fact) => fact.state === 'learning').length

  return (
    <section className="stats-screen">
      <header>
        <p className="eyebrow">{t('stats.progress')}</p>
        <h1>{t('stats.heading')}</h1>
        <p>{t('stats.intro')}</p>
      </header>
      <div className="stat-hero">
        <strong>{fluent}</strong>
        <span>{t('stats.factsFluent')}</span>
      </div>
      <div className="stat-grid">
        <div>
          <strong>{familiar}</strong>
          <span>{t('stats.familiar')}</span>
        </div>
        <div>
          <strong>{growing}</strong>
          <span>{t('stats.growing')}</span>
        </div>
        <div>
          <strong>{data?.completedSessions ?? 0}</strong>
          <span>{t('stats.tinyWins')}</span>
        </div>
        <div>
          <strong>{facts.length}</strong>
          <span>{t('stats.factsMet')}</span>
        </div>
      </div>
      <div className="progress-note">
        <span aria-hidden="true">✿</span>
        <p>{t('stats.note')}</p>
      </div>
    </section>
  )
}
