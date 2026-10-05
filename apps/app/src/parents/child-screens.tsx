/** E3, E4, E6 and E9: one child's profile, their school, a new child, removing a child. */
import type { ChildProfile, SelectableAvatarId } from '@little-tables/api-contract'
import type { LearningPathSettings, SkillId } from '@little-tables/engine/schema'
import {
  Alert,
  Button,
  cn,
  IconTile,
  ListGroup,
  ListRow,
  NavigationBar,
  Screen,
  SegmentedControl,
  Sheet,
  Switch,
  TextField,
  toast,
} from '@little-tables/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Bell, School, Sprout } from 'lucide-react'
import { Effect } from 'effect'
import { useId, useState, type SyntheticEvent } from 'react'

import { profileStateKey, useApp, useProfileState } from '../app/app-context.js'
import { useLearningProgress } from '../app/derived.js'
import {
  avatarImage,
  avatarOf,
  characterIds,
  characterNames,
  characterOf,
  type CharacterId,
} from '../characters/characters.js'
import { LocalStore } from '../data/local-store.js'
import { emptyState } from '../data/local-store.js'
import { useI18n, type MessageKey } from '../i18n/i18n.js'
import { failureCode, useApi } from './api.js'
import {
  disableReminders,
  enableReminders,
  remindedProfile,
  remindersSupported,
} from './reminders.js'

/** The family's child named in the path, or `null` once removed. */
function useChild(): ChildProfile | null {
  const { profileId } = useParams({ strict: false })
  const { family } = useApp()
  return family.profiles.find(({ id }) => id === profileId) ?? null
}

/** Replaces one child in the family after the server answered. */
function useReplaceChild() {
  const { family, setProfiles } = useApp()
  return (profile: ChildProfile) =>
    setProfiles(family.profiles.map((current) => (current.id === profile.id ? profile : current)))
}

type CharacterGridProps = Readonly<{
  onPick: (character: CharacterId) => void
  selected: CharacterId
}>

export function CharacterGrid({ onPick, selected }: CharacterGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup">
      {characterIds.map((character) => (
        <button
          aria-checked={character === selected}
          className={cn(
            'flex flex-col items-center gap-1 rounded-card border-2 bg-surface px-2 py-3',
            character === selected ? 'border-tint bg-tint-soft' : 'border-transparent',
          )}
          key={character}
          onClick={() => onPick(character)}
          role="radio"
          type="button"
        >
          <img
            alt=""
            className="size-16 object-contain"
            height={64}
            src={avatarImage(character)}
            width={64}
          />
          <span
            className={cn('text-subhead font-extrabold', character === selected && 'text-tint')}
          >
            {characterNames[character]}
          </span>
        </button>
      ))}
    </div>
  )
}

export function ChildScreen() {
  const child = useChild()
  const navigate = useNavigate()
  if (child === null) {
    void navigate({ replace: true, to: '/parents' })
    return null
  }
  return <Child child={child} key={child.id} />
}

function Child({ child }: Readonly<{ child: ChildProfile }>) {
  const { family, preferences, runtime, setProfiles } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  const api = useApi()
  const queryClient = useQueryClient()
  const replace = useReplaceChild()
  const nameField = useId()
  const [choosing, setChoosing] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(child.name)
  const [removing, setRemoving] = useState(false)
  const [reminded, setReminded] = useState(() => remindedProfile())
  const [reminderBusy, setReminderBusy] = useState(false)
  const character = characterOf(child.avatarId)

  const save = (changes: Readonly<{ avatarId?: SelectableAvatarId; name?: string }>) =>
    api((client) => client.updateProfile(child.id, changes))
      .then(({ profile }) => replace(profile))
      .catch(() => toast.error(t('child.saveFailed')))

  const rename = (event: SyntheticEvent) => {
    event.preventDefault()
    if (name.trim() === '') return
    void save({ name: name.trim() }).then(() => setRenaming(false))
  }

  const toggleReminder = (on: boolean) => {
    setReminderBusy(true)
    void runtime
      .runPromise(on ? enableReminders(child.id, preferences.language) : disableReminders(child.id))
      .then(() => setReminded(on ? child.id : null))
      .catch((failure: unknown) => {
        const reason = (failure as { reason?: string }).reason
        toast.error(
          t(
            reason === 'blocked'
              ? 'child.reminderBlocked'
              : reason === 'unsupported'
                ? 'child.reminderUnsupported'
                : 'child.saveFailed',
          ),
        )
      })
      .finally(() => setReminderBusy(false))
  }

  const remove = () =>
    void api((client) => client.removeProfile(child.id))
      .then(async () => {
        await runtime.runPromise(Effect.flatMap(LocalStore, (store) => store.remove(child.id)))
        queryClient.removeQueries({ queryKey: profileStateKey(child.id) })
        setProfiles(family.profiles.filter(({ id }) => id !== child.id))
        await navigate({ replace: true, to: '/parents' })
      })
      .catch((failure: unknown) =>
        toast.error(
          t(
            failureCode(failure) === 'last_profile_required'
              ? 'child.removeLast'
              : 'child.saveFailed',
          ),
        ),
      )

  const otherReminded = family.profiles.find(({ id }) => id === reminded && id !== child.id)
  return (
    <Screen
      tone="grouped"
      top={
        <NavigationBar
          back={{ label: t('parents.title'), onBack: () => void navigate({ to: '/parents' }) }}
          title={child.name}
        />
      }
    >
      <button
        className="flex flex-col items-center gap-2 self-center"
        onClick={() => setChoosing(true)}
        type="button"
      >
        <img
          alt={characterNames[character]}
          className="size-24 rounded-full border-3 border-tint bg-surface object-contain p-1"
          height={96}
          src={avatarImage(character)}
          width={96}
        />
        <span className="text-subhead font-extrabold text-tint">{t('child.changeCharacter')}</span>
      </button>

      <ListGroup>
        <ListRow
          detail={child.name}
          onClick={() => setRenaming(true)}
          title={t('child.firstName')}
          trailing="chevron"
        />
      </ListGroup>

      <ListGroup title={t('child.learning')}>
        <ListRow
          detail={t(
            child.learningPaths.mode === 'automatic'
              ? 'child.schoolAutomatic'
              : 'child.schoolManual',
          )}
          leading={
            <IconTile className="bg-sky">
              <School aria-hidden />
            </IconTile>
          }
          onClick={() =>
            void navigate({
              params: { profileId: child.id },
              to: '/parents/children/$profileId/school',
            })
          }
          title={t('child.school')}
          trailing="chevron"
        />
      </ListGroup>

      <ListGroup
        footer={
          otherReminded === undefined
            ? t('child.reminderFooter', { name: child.name })
            : t('child.reminderOther', { name: otherReminded.name })
        }
        title={t('child.reminder')}
      >
        <ListRow
          accessory={
            <Switch
              aria-label={t('child.reminderDaily')}
              checked={reminded === child.id}
              disabled={reminderBusy || !remindersSupported()}
              onCheckedChange={toggleReminder}
            />
          }
          leading={
            <IconTile className="bg-danger">
              <Bell aria-hidden />
            </IconTile>
          }
          title={t('child.reminderDaily')}
        />
        <ListRow detail="18:00" title={t('child.reminderTime')} />
      </ListGroup>

      <ListGroup>
        <ListRow
          destructive
          onClick={() => setRemoving(true)}
          title={t('child.remove', { name: child.name })}
        />
      </ListGroup>

      <Sheet
        closeLabel={t('common.close')}
        onOpenChange={setChoosing}
        open={choosing}
        title={t('child.characterTitle')}
      >
        <CharacterGrid
          onPick={(picked) => {
            void save({ avatarId: avatarOf[picked] })
            setChoosing(false)
          }}
          selected={character}
        />
      </Sheet>

      <Sheet
        closeLabel={t('common.close')}
        onOpenChange={setRenaming}
        open={renaming}
        title={t('child.rename')}
      >
        <form className="flex flex-col gap-3" onSubmit={rename}>
          <TextField
            counter={`${Array.from(name).length}/40`}
            id={nameField}
            label={t('child.firstName')}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <Button disabled={name.trim() === ''} type="submit" width="full">
            {t('common.save')}
          </Button>
        </form>
      </Sheet>

      <Alert
        cancelLabel={t('common.cancel')}
        confirmLabel={t('child.removeConfirm', { name: child.name })}
        description={t('child.removeCopy')}
        destructive
        onConfirm={remove}
        onOpenChange={setRemoving}
        open={removing}
        title={t('child.removeTitle', { name: child.name })}
      />
    </Screen>
  )
}

/** E4: what the child learns at school, which paths open, how subtraction is written. */
export function SchoolScreen() {
  const child = useChild()
  if (child === null) return null
  return <SchoolSettings child={child} key={child.id} />
}

function SchoolSettings({ child }: Readonly<{ child: ChildProfile }>) {
  const { activeProfile } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  const api = useApi()
  const replace = useReplaceChild()
  const state = useProfileState()
  const [settings, setSettings] = useState<LearningPathSettings>(child.learningPaths)
  // The skills come from the engine, grouped by path; the active child's snapshot is enough.
  const progress = useLearningProgress(
    child.id === activeProfile.id ? (state.data ?? emptyState()) : emptyState(),
    settings,
  )

  const persist = (next: LearningPathSettings) => {
    const previous = settings
    setSettings(next)
    void api((client) => client.updateLearningPaths(child.id, next))
      .then(({ profile }) => replace(profile))
      .catch(() => {
        setSettings(previous)
        toast.error(t('child.saveFailed'))
      })
  }
  const toggle = (skill: SkillId) =>
    persist({
      ...settings,
      enabledSkills: settings.enabledSkills.includes(skill)
        ? settings.enabledSkills.filter((current) => current !== skill)
        : [...settings.enabledSkills, skill],
    })
  const skills = progress.paths.flatMap((path) =>
    path.skills.map((skill) => ({ path: path.id, skill: skill.id })),
  )

  return (
    <Screen
      tone="grouped"
      top={
        <NavigationBar
          back={{
            label: child.name,
            onBack: () =>
              void navigate({
                params: { profileId: child.id },
                to: '/parents/children/$profileId',
              }),
          }}
          title={t('school.title')}
        />
      }
    >
      <div className="flex flex-col gap-1.5">
        <SegmentedControl
          label={t('school.title')}
          onChange={(mode) => persist({ ...settings, mode })}
          options={[
            { label: t('school.automatic'), value: 'automatic' },
            { label: t('school.manual'), value: 'manual' },
          ]}
          value={settings.mode}
        />
        <p className="px-4 text-footnote font-semibold text-label-2">
          {t(settings.mode === 'automatic' ? 'school.automaticCopy' : 'school.manualCopy')}
        </p>
      </div>

      <ListGroup title={t('school.open')}>
        {skills.map(({ path, skill }) => (
          <ListRow
            accessory={
              <Switch
                aria-label={t(`skill.${skill}`)}
                checked={settings.enabledSkills.includes(skill)}
                onCheckedChange={() => toggle(skill)}
              />
            }
            key={skill}
            subtitle={t(`path.${path}` as MessageKey)}
            title={t(`skill.${skill}`)}
          />
        ))}
      </ListGroup>

      <ListGroup footer={t('school.focusCopy')} title={t('school.focus')}>
        <ListRow
          onClick={() => persist({ ...settings, focusSkill: null })}
          title={t('school.focusNone')}
          {...(settings.focusSkill === null ? { trailing: 'check' as const } : {})}
        />
        {skills.map(({ skill }) => (
          <ListRow
            key={skill}
            onClick={() => persist({ ...settings, focusSkill: skill })}
            title={t(`skill.${skill}`)}
            {...(settings.focusSkill === skill ? { trailing: 'check' as const } : {})}
          />
        ))}
      </ListGroup>

      <ListGroup title={t('school.method')}>
        {(['compensation', 'decomposition'] as const).map((method) => (
          <ListRow
            key={method}
            onClick={() => persist({ ...settings, subtractionMethod: method })}
            subtitle={t(
              method === 'compensation'
                ? 'settings.methodCompensationHint'
                : 'settings.methodDecompositionHint',
            )}
            title={t(
              method === 'compensation'
                ? 'settings.methodCompensation'
                : 'settings.methodDecomposition',
            )}
            {...(settings.subtractionMethod === method ? { trailing: 'check' as const } : {})}
          />
        ))}
      </ListGroup>
    </Screen>
  )
}

/** E6: a new child, with a name and a character. */
export function NewChildScreen() {
  const { family, selectProfile, setProfiles } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  const api = useApi()
  const field = useId()
  const [name, setName] = useState('')
  const [character, setCharacter] = useState<CharacterId>('miffy')
  const [pending, setPending] = useState(false)

  const create = (event: SyntheticEvent) => {
    event.preventDefault()
    if (pending || name.trim() === '') return
    setPending(true)
    void api((client) => client.createProfile({ avatarId: avatarOf[character], name: name.trim() }))
      .then(async ({ profile }) => {
        setProfiles([...family.profiles, profile])
        selectProfile(profile.id)
        await navigate({ replace: true, to: '/parents' })
      })
      .catch(() => toast.error(t('newChild.failed')))
      .finally(() => setPending(false))
  }

  return (
    <form className="contents" onSubmit={create}>
      <Screen
        bottom={
          <Button
            disabled={pending || name.trim() === ''}
            icon={<Sprout aria-hidden className="size-5" />}
            size="lg"
            type="submit"
            width="full"
          >
            {t('newChild.create')}
          </Button>
        }
        tone="grouped"
        top={
          <NavigationBar
            back={{ label: t('common.cancel'), onBack: () => void navigate({ to: '/parents' }) }}
            title={t('newChild.title')}
          />
        }
      >
        <TextField
          autoComplete="off"
          counter={`${Array.from(name).length}/40`}
          id={field}
          label={t('newChild.name')}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('newChild.name')}
          value={name}
        />
        <section className="flex flex-col gap-2">
          <h2 className="px-4 text-footnote font-extrabold tracking-wide text-label-2 uppercase">
            {t('newChild.character')}
          </h2>
          <CharacterGrid onPick={setCharacter} selected={character} />
        </section>
      </Screen>
    </form>
  )
}
