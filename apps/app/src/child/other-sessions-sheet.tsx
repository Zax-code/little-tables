/** A5: other sessions — five quick questions, one table, the learning paths and the bonuses. */
import { Chip, IconTile, ListGroup, ListRow, Sheet } from '@little-tables/ui'
import { Lock, Zap } from 'lucide-react'

import { useApp } from '../app/app-context.js'
import { useLearningProgress } from '../app/derived.js'
import type { ProfileState } from '../data/schema.js'
import { policies } from '../data/practice.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { weakerBonusTable } from './bonus-table.js'
import { useLaunch } from './launch.js'

const tables = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const

const pathStyle = {
  additions: { mark: '+ −', tile: 'bg-tint' },
  'big-numbers': { mark: '1 000', tile: 'bg-sky' },
  fractions: { mark: '¾', tile: 'bg-leaf' },
} as const

type OtherSessionsSheetProps = Readonly<{
  onOpenChange: (open: boolean) => void
  open: boolean
  state: ProfileState
}>

export function OtherSessionsSheet({ onOpenChange, open, state }: OtherSessionsSheetProps) {
  const { activeProfile } = useApp()
  const { t } = useI18n()
  const progress = useLearningProgress(state, activeProfile.learningPaths)
  const launch = useLaunch()
  const paths = activeProfile.learningPaths
  const start = (policy: Parameters<typeof launch.start>[0]) => {
    void launch.start(policy).then((started) => {
      if (started) onOpenChange(false)
    })
  }
  const openPaths = progress.paths.filter((path) => path.skills.some((skill) => skill.open))

  return (
    <Sheet
      closeLabel={t('common.close')}
      description={t('otherSessions.description')}
      onOpenChange={onOpenChange}
      open={open}
      title={t('otherSessions.title')}
    >
      <ListGroup>
        <ListRow
          className="bg-sun-soft"
          disabled={launch.pending}
          leading={
            <IconTile className="bg-sun">
              <Zap aria-hidden />
            </IconTile>
          }
          onClick={() => start(policies.quick(paths))}
          subtitle={t('otherSessions.quickCopy')}
          title={t('otherSessions.quick')}
          trailing="chevron"
        />
      </ListGroup>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-footnote font-extrabold tracking-wide text-label-2 uppercase">
          {t('otherSessions.oneTable')}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {tables.map((table) => (
            <Chip
              aria-label={t('otherSessions.tableLabel', { table })}
              disabled={launch.pending}
              key={table}
              onClick={() => start(policies.table(table))}
            >
              × {table}
            </Chip>
          ))}
        </div>
      </section>

      {openPaths.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-footnote font-extrabold tracking-wide text-label-2 uppercase">
            {t('otherSessions.paths')}
          </h3>
          {openPaths.map((path) => (
            <div className="flex items-stretch gap-2" key={path.id}>
              <span
                aria-hidden
                className={`flex w-12 shrink-0 items-center justify-center rounded-control text-footnote font-black text-on-tint ${pathStyle[path.id].tile}`}
              >
                {pathStyle[path.id].mark}
              </span>
              <div className="flex flex-1 flex-wrap gap-2">
                {path.skills.flatMap((skill) =>
                  skill.open
                    ? [
                        <Chip
                          className="min-h-11 text-subhead"
                          disabled={launch.pending}
                          key={skill.id}
                          onClick={() => start(policies.skill(paths, skill.id))}
                        >
                          {t(`skill.${skill.id}` as MessageKey)}
                        </Chip>,
                      ]
                    : [],
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <BonusChip
          label={t('otherSessions.bonus1112')}
          locked={!progress.packs.bonus1112.unlocked}
          lockedHint={t('otherSessions.bonusLocked')}
          onStart={() => start(policies.bonusTable(weakerBonusTable(state.snapshot)))}
          pending={launch.pending}
        />
        <BonusChip
          label={t('otherSessions.division')}
          locked={!progress.packs.inverseDivision.unlocked}
          lockedHint={t('otherSessions.divisionLocked')}
          onStart={() => start(policies.division())}
          pending={launch.pending}
        />
      </div>
    </Sheet>
  )
}

type BonusChipProps = Readonly<{
  label: string
  locked: boolean
  lockedHint: string
  onStart: () => void
  pending: boolean
}>

/** A bonus pack: locked chips stay visible so the child knows it is coming. */
function BonusChip({ label, locked, lockedHint, onStart, pending }: BonusChipProps) {
  return (
    <Chip
      aria-label={locked ? `${label}. ${lockedHint}` : label}
      className="min-h-11 text-subhead"
      disabled={locked || pending}
      icon={locked ? <Lock aria-hidden className="size-4" /> : undefined}
      onClick={onStart}
    >
      {label}
    </Chip>
  )
}
