/** A child's learning-path settings, saved as soon as a parent changes them. */
import type { ChildProfile } from '@little-tables/api-contract'
import type { ConjugationSettings, LearningPathSettings } from '@little-tables/engine/schema'
import { toast } from '@little-tables/ui'
import { useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { useApp } from '../app/app-context.js'
import { useI18n } from '../i18n/i18n.js'
import { useApi } from './api.js'

export const noConjugation: ConjugationSettings = { focus: null, tenses: [], verbs: [] }

/** The family's child named in the path, or `null` once removed. */
export function useChild(): ChildProfile | null {
  const { profileId } = useParams({ strict: false })
  const { family } = useApp()
  return family.profiles.find(({ id }) => id === profileId) ?? null
}

/** The settings shown, and a save that shows the change at once and undoes it on failure. */
export function usePathSettings(child: ChildProfile) {
  const { family, setProfiles } = useApp()
  const { t } = useI18n()
  const api = useApi()
  const [settings, setSettings] = useState<LearningPathSettings>(child.learningPaths)
  const persist = (next: LearningPathSettings) => {
    const previous = settings
    setSettings(next)
    void api((client) => client.updateLearningPaths(child.id, next))
      .then(({ profile }) =>
        setProfiles(
          family.profiles.map((current) => (current.id === profile.id ? profile : current)),
        ),
      )
      .catch(() => {
        setSettings(previous)
        toast.error(t('child.saveFailed'))
      })
  }
  return [settings, persist] as const
}
