import {
  learningPathIds,
  learningSkills,
  type ChildProfile,
  type LearningPathSettings,
  type SkillId,
  type SubtractionMethod,
} from '@little-tables/domain'
import { useId, useState, type SyntheticEvent } from 'react'

import { useI18n } from '../i18n.js'
import { learningPathsFor, saveLearningPaths } from '../learning-path-settings.js'
import { pathSymbols } from '../learning-path-symbols.js'

type LearningPathSettingsFormProps = Readonly<{
  onSaved: (profile: ChildProfile) => void
  profile: ChildProfile
}>

/** A grown-up's choices about which school topics join practice, and how subtraction is written. */
export function LearningPathSettingsForm({ onSaved, profile }: LearningPathSettingsFormProps) {
  const { t } = useI18n()
  const id = useId()
  const initial = learningPathsFor(profile)
  const [settings, setSettings] = useState<LearningPathSettings>(initial)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string>()
  const enabled = new Set(settings.enabledSkills)

  const toggleSkill = (skill: SkillId) =>
    setSettings((current) => ({
      ...current,
      enabledSkills: current.enabledSkills.includes(skill)
        ? current.enabledSkills.filter((candidate) => candidate !== skill)
        : [...current.enabledSkills, skill],
    }))

  const save = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setMessage(undefined)
    void saveLearningPaths(profile.id, settings)
      .then((saved) => {
        onSaved(saved)
        setMessage(t('settings.saved'))
      })
      .catch(() => setMessage(t('settings.saveFailed')))
      .finally(() => setPending(false))
  }

  return (
    <details className="paths-settings">
      <summary>{t('settings.heading', { name: profile.name })}</summary>
      <form onSubmit={save}>
        <p className="paths-settings-intro">{t('settings.intro')}</p>

        <fieldset className="settings-choices">
          <legend>{t('settings.modeLegend')}</legend>
          {(['automatic', 'manual'] as const).map((mode) => (
            <label key={mode}>
              <input
                checked={settings.mode === mode}
                name={`${id}-mode`}
                onChange={() => setSettings((current) => ({ ...current, mode }))}
                type="radio"
                value={mode}
              />
              <span>
                <b>{t(mode === 'automatic' ? 'settings.modeAutomatic' : 'settings.modeManual')}</b>
                <small>
                  {t(
                    mode === 'automatic' ? 'settings.modeAutomaticHint' : 'settings.modeManualHint',
                  )}
                </small>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="settings-skills">
          <legend>{t('settings.skillsLegend')}</legend>
          {learningPathIds.map((path) => (
            <div className="settings-path" key={path}>
              <strong>
                <span aria-hidden="true" className="path-symbol">
                  {pathSymbols[path]}
                </span>
                {t(`path.${path}`)}
              </strong>
              {learningSkills.flatMap((skill) =>
                skill.path === path
                  ? [
                      <label className="settings-check" key={skill.id}>
                        <input
                          checked={enabled.has(skill.id)}
                          onChange={() => toggleSkill(skill.id)}
                          type="checkbox"
                        />
                        <span>{t(`skill.${skill.id}`)}</span>
                      </label>,
                    ]
                  : [],
              )}
            </div>
          ))}
        </fieldset>

        <div className="settings-focus">
          <label htmlFor={`${id}-focus`}>{t('settings.focusLabel')}</label>
          <select
            id={`${id}-focus`}
            onChange={(event) => {
              const value = event.target.value
              const skill = learningSkills.find((candidate) => candidate.id === value)?.id ?? null
              setSettings((current) => ({ ...current, focusSkill: skill }))
            }}
            value={settings.focusSkill ?? ''}
          >
            <option value="">{t('settings.focusNone')}</option>
            {learningPathIds.map((path) => (
              <optgroup key={path} label={t(`path.${path}`)}>
                {learningSkills.flatMap((skill) =>
                  skill.path === path
                    ? [
                        <option key={skill.id} value={skill.id}>
                          {t(`skill.${skill.id}`)}
                        </option>,
                      ]
                    : [],
                )}
              </optgroup>
            ))}
          </select>
          <small>{t('settings.focusHelp')}</small>
        </div>

        <fieldset className="settings-choices">
          <legend>{t('settings.methodLegend')}</legend>
          {(
            ['compensation', 'decomposition'] as const satisfies ReadonlyArray<SubtractionMethod>
          ).map((method) => (
            <label key={method}>
              <input
                checked={settings.subtractionMethod === method}
                name={`${id}-method`}
                onChange={() =>
                  setSettings((current) => ({ ...current, subtractionMethod: method }))
                }
                type="radio"
                value={method}
              />
              <span>
                <b>
                  {t(
                    method === 'compensation'
                      ? 'settings.methodCompensation'
                      : 'settings.methodDecomposition',
                  )}
                </b>
                <small>
                  {t(
                    method === 'compensation'
                      ? 'settings.methodCompensationHint'
                      : 'settings.methodDecompositionHint',
                  )}
                </small>
              </span>
            </label>
          ))}
        </fieldset>

        <button className="family-save-button" disabled={pending} type="submit">
          {pending ? t('settings.saving') : t('settings.save')}
        </button>
        {message ? (
          <p className="family-card-message" role="status">
            {message}
          </p>
        ) : null}
      </form>
    </details>
  )
}
