import type { TableLearningProgress } from '@little-tables/domain'

import { useI18n } from '../i18n.js'

type TableProgressCardProps = Readonly<{
  onChoose: (table: number) => void
  progress: TableLearningProgress
}>

export function TableProgressCard({ onChoose, progress }: TableProgressCardProps) {
  const { t } = useI18n()
  const { facts, table } = progress
  const growing = facts.growing + facts.familiar
  const complete = facts.fluent === facts.total

  return (
    <article className="table-progress-card">
      <header>
        <strong>{t('tables.label', { number: table })}</strong>
        <span>{complete ? t('tables.complete') : `${facts.fluent}/${facts.total}`}</span>
      </header>
      <div
        aria-label={
          complete
            ? t('tables.complete')
            : t('tables.summary', {
                growing,
                newCount: facts.unseen,
                rooted: facts.fluent,
              })
        }
        className="table-progress-track"
        role="img"
      >
        <i
          className="table-progress-rooted"
          style={{ flexGrow: facts.fluent }}
          title={t('tables.tooltipFluent', { count: facts.fluent })}
        />
        <i
          className="table-progress-growing"
          style={{ flexGrow: growing }}
          title={t('tables.tooltipGrowing', { count: growing })}
        />
        <i
          className="table-progress-new"
          style={{ flexGrow: facts.unseen }}
          title={t('tables.tooltipNew', { count: facts.unseen })}
        />
      </div>
      <p>
        {complete
          ? t('tables.complete')
          : t('tables.summary', {
              growing,
              newCount: facts.unseen,
              rooted: facts.fluent,
            })}
      </p>
      <button onClick={() => onChoose(table)} type="button">
        {t('tables.choose')}
      </button>
    </article>
  )
}
