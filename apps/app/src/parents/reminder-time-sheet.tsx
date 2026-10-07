/** The time of a child's daily reminder (`docs/rewrite/TECHNICAL_SPEC.md` §5.5): 7 h – 21 h, every 15 min. */
import type { ChildProfile } from '@little-tables/api-contract'
import { Button, Sheet, TimePicker } from '@little-tables/ui'
import { useState } from 'react'

import { useI18n } from '../i18n/i18n.js'

export const DEFAULT_REMINDER_MINUTE = 18 * 60

export function ReminderTimeSheet({
  child,
  onOpenChange,
  onSave,
  open,
}: Readonly<{
  child: ChildProfile
  onOpenChange: (open: boolean) => void
  onSave: (minute: number) => Promise<void>
  open: boolean
}>) {
  const { hour, t } = useI18n()
  const [minute, setMinute] = useState(() => child.reminderMinute ?? DEFAULT_REMINDER_MINUTE)
  const [saving, setSaving] = useState(false)
  return (
    <Sheet onOpenChange={onOpenChange} open={open} title={t('child.reminderTime')}>
      <div className="flex flex-col gap-4">
        <p className="text-subhead font-semibold text-label-2">
          {t('child.reminderTimeCopy', { name: child.name })}
        </p>
        <TimePicker
          formatHour={hour}
          hourLabel={t('child.reminderHour')}
          max={21 * 60}
          min={7 * 60}
          minuteLabel={t('child.reminderMinutes')}
          onChange={setMinute}
          step={15}
          value={minute}
        />
        <Button
          disabled={saving}
          onClick={() => {
            setSaving(true)
            void onSave(minute).finally(() => setSaving(false))
          }}
          width="full"
        >
          {t('common.save')}
        </Button>
      </div>
    </Sheet>
  )
}
