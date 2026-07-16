import { useI18n } from '../i18n.js'

type ProgressDotsProps = Readonly<{ current: number; total: number }>

export function ProgressDots({ current, total }: ProgressDotsProps) {
  const { t } = useI18n()
  return (
    <div
      aria-label={t('practice.progress', { current, total })}
      className="progress-dots"
      role="progressbar"
      aria-valuemax={total}
      aria-valuemin={0}
      aria-valuenow={current}
    >
      {Array.from({ length: total }, (_, index) => (
        <span className={index < current ? 'dot dot-filled' : 'dot'} key={index} />
      ))}
    </div>
  )
}
