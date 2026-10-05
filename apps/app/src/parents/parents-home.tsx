/** E2, E8 and E9: the parent space's home, the device settings and who can come in. */
import {
  Alert,
  Button,
  IconTile,
  ListGroup,
  ListRow,
  NavigationBar,
  Screen,
  SegmentedControl,
  Switch,
  TextField,
  toast,
} from '@little-tables/ui'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Effect } from 'effect'
import { Download, Languages, LogOut, Palette, Plus, RefreshCw, Users, Volume2 } from 'lucide-react'
import { useId, useState, type SyntheticEvent } from 'react'

import { useApp } from '../app/app-context.js'
import { profileStateKey } from '../app/profile-state.js'
import { todayKey } from '../app/derived.js'
import { useSync } from '../app/sync-manager.js'
import { avatarImage, characterOf } from '../characters/characters.js'
import { LocalStore } from '../data/local-store.js'
import type { Language, Preferences, ProfileState } from '../data/schema.js'
import { useI18n } from '../i18n/i18n.js'
import type { Translator } from '../i18n/translator.js'
import { InstallSteps } from '../install.js'
import { useInstall } from '../install-prompt.js'
import { failureCode, useApi } from './api.js'

const languageNames: Readonly<Record<Language, string>> = {
  en: 'English',
  fr: 'Français',
  'zh-Hans': '简体中文',
}

/** When a child last practised, in the parent's words. */
const childStatus = (state: ProfileState | undefined, translator: Translator) => {
  const last = (state?.practiceDayKeys ?? []).toSorted().at(-1)
  if (last === undefined) return translator.t('parents.statusNew')
  const today = todayKey()
  if (last === today && state?.rewardedDayKeys.includes(today) === true)
    return translator.t('parents.statusToday')
  const days = Math.round((Date.parse(today) - Date.parse(last)) / 86_400_000)
  return translator.t('parents.statusWhen', { when: translator.daysAgo(days) })
}

export function ParentsHomeScreen() {
  const { device, family, preferences, reopen, runtime, setPreferences } = useApp()
  const translator = useI18n()
  const { count, t } = translator
  const navigate = useNavigate()
  const sync = useSync()
  const api = useApi()
  const [signingOut, setSigningOut] = useState(false)
  const installation = useInstall()
  const states = useQueries({
    queries: family.profiles.map((profile) => ({
      queryFn: () =>
        runtime.runPromise(Effect.flatMap(LocalStore, (store) => store.load(profile.id))),
      queryKey: profileStateKey(profile.id),
      staleTime: Number.POSITIVE_INFINITY,
    })),
  })

  const signOut = async () => {
    await sync.synchronize()
    await api((client) => client.logout()).catch(() => undefined)
    device.forgetFamily()
    reopen()
  }

  const syncDetail =
    sync.state.kind === 'error'
      ? t('parents.syncError')
      : sync.state.pending > 0
        ? count('parents.syncPending', sync.state.pending)
        : t('parents.syncUpToDate')

  return (
    <Screen
      tone="grouped"
      top={
        <NavigationBar
          action={
            <Button onClick={() => void navigate({ to: '/' })} size="sm" variant="plain">
              {t('parents.done')}
            </Button>
          }
          title={t('parents.title')}
        />
      }
    >
      <ListGroup title={t('parents.children')}>
        {family.profiles.map((profile, index) => (
          <ListRow
            key={profile.id}
            leading={
              <img
                alt=""
                className="size-10 object-contain"
                height={40}
                src={avatarImage(characterOf(profile.avatarId))}
                width={40}
              />
            }
            onClick={() =>
              void navigate({
                params: { profileId: profile.id },
                to: '/parents/children/$profileId',
              })
            }
            subtitle={childStatus(states[index]?.data, translator)}
            title={profile.name}
            trailing="chevron"
          />
        ))}
        <ListRow
          leading={
            <IconTile>
              <Plus aria-hidden />
            </IconTile>
          }
          onClick={() => void navigate({ to: '/parents/new-child' })}
          title={<span className="text-tint">{t('parents.addChild')}</span>}
        />
      </ListGroup>

      <ListGroup title={t('parents.settings')}>
        <ListRow
          detail={t(`settings.appearance.${preferences.appearance}`)}
          leading={
            <IconTile className="bg-sky">
              <Palette aria-hidden />
            </IconTile>
          }
          onClick={() => void navigate({ to: '/parents/settings' })}
          title={t('parents.appearance')}
          trailing="chevron"
        />
        <ListRow
          detail={languageNames[preferences.language]}
          leading={
            <IconTile className="bg-leaf">
              <Languages aria-hidden />
            </IconTile>
          }
          onClick={() => void navigate({ to: '/parents/settings' })}
          title={t('parents.language')}
          trailing="chevron"
        />
        <ListRow
          accessory={
            <Switch
              aria-label={t('parents.sound')}
              checked={preferences.sound}
              onCheckedChange={(sound) => setPreferences({ ...preferences, sound })}
            />
          }
          leading={
            <IconTile className="bg-sun">
              <Volume2 aria-hidden />
            </IconTile>
          }
          title={t('parents.sound')}
        />
      </ListGroup>

      <ListGroup title={t('parents.account')}>
        {family.isAdmin ? (
          <ListRow
            leading={
              <IconTile className="bg-label-2">
                <Users aria-hidden />
              </IconTile>
            }
            onClick={() => void navigate({ to: '/parents/access' })}
            title={t('parents.whoCanComeIn')}
            trailing="chevron"
          />
        ) : null}
        <ListRow
          detail={syncDetail}
          leading={
            <IconTile className="bg-leaf">
              <RefreshCw aria-hidden />
            </IconTile>
          }
          onClick={() => void sync.synchronize()}
          title={t('parents.sync')}
        />
        {installation.supported ? (
          <ListRow
            leading={
              <IconTile className="bg-sky">
                <Download aria-hidden />
              </IconTile>
            }
            onClick={installation.install}
            title={t('install.row')}
          />
        ) : null}
        <ListRow
          destructive
          leading={
            <IconTile className="bg-danger">
              <LogOut aria-hidden />
            </IconTile>
          }
          onClick={() => setSigningOut(true)}
          title={t('parents.signOut')}
        />
      </ListGroup>

      <InstallSteps onOpenChange={installation.setExplaining} open={installation.explaining} />
      <Alert
        cancelLabel={t('common.cancel')}
        confirmLabel={t('parents.signOutConfirm')}
        description={t('parents.signOutCopy')}
        destructive
        onConfirm={() => void signOut()}
        onOpenChange={setSigningOut}
        open={signingOut}
        title={t('parents.signOutTitle')}
      />
    </Screen>
  )
}

/** E8: appearance, language, text size and sound, for this device. */
export function SettingsScreen() {
  const { preferences, setPreferences } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  const update = (change: Partial<Preferences>) => setPreferences({ ...preferences, ...change })
  return (
    <Screen
      tone="grouped"
      top={
        <NavigationBar
          back={{ label: t('parents.title'), onBack: () => void navigate({ to: '/parents' }) }}
          title={t('parents.settings')}
        />
      }
    >
      <ListGroup title={t('parents.appearance')}>
        <div className="p-2">
          <SegmentedControl
            label={t('parents.appearance')}
            onChange={(appearance) => update({ appearance })}
            options={(['system', 'light', 'dark'] as const).map((value) => ({
              label: t(`settings.appearance.${value}`),
              value,
            }))}
            value={preferences.appearance}
          />
        </div>
      </ListGroup>
      <ListGroup title={t('parents.language')}>
        {(['fr', 'en', 'zh-Hans'] as const).map((language) => (
          <ListRow
            key={language}
            lang={language}
            onClick={() => update({ language })}
            title={languageNames[language]}
            {...(preferences.language === language ? { trailing: 'check' as const } : {})}
          />
        ))}
      </ListGroup>
      <ListGroup title={t('parents.textSize')}>
        <div className="p-2">
          <SegmentedControl
            label={t('parents.textSize')}
            onChange={(textSize) => update({ textSize })}
            options={(['default', 'large', 'larger'] as const).map((value) => ({
              label: t(`settings.size.${value}`),
              value,
            }))}
            value={preferences.textSize}
          />
        </div>
      </ListGroup>
      <ListGroup>
        <ListRow
          accessory={
            <Switch
              aria-label={t('settings.soundCopy')}
              checked={preferences.sound}
              onCheckedChange={(sound) => update({ sound })}
            />
          }
          leading={
            <IconTile className="bg-sun">
              <Volume2 aria-hidden />
            </IconTile>
          }
          title={t('settings.soundCopy')}
        />
      </ListGroup>
    </Screen>
  )
}

const accessKey = ['allowed-emails'] as const

/** E9: the addresses allowed to sign in; administrators only. */
export function AccessScreen() {
  const { count, t } = useI18n()
  const navigate = useNavigate()
  const api = useApi()
  const queryClient = useQueryClient()
  const field = useId()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const list = useQuery({
    queryFn: () => api((client) => client.allowedEmails()),
    queryKey: accessKey,
  })

  const add = (event: SyntheticEvent) => {
    event.preventDefault()
    if (pending || email.trim() === '') return
    setPending(true)
    void api((client) => client.addEmail(email.trim()))
      .then((added) => {
        setEmail('')
        toast.success(t('access.added', { email: added.email }))
        return queryClient.invalidateQueries({ queryKey: accessKey })
      })
      .catch((failure: unknown) =>
        toast.error(
          t(failureCode(failure) === 'invalid_email' ? 'access.invalid' : 'access.addFailed'),
        ),
      )
      .finally(() => setPending(false))
  }

  const remove = (address: string) =>
    void api((client) => client.removeEmail(address))
      .then(() => {
        toast.success(t('access.removed', { email: address }))
        return queryClient.invalidateQueries({ queryKey: accessKey })
      })
      .catch(() => toast.error(t('access.addFailed')))

  const emails = list.data?.emails ?? []
  return (
    <Screen
      tone="grouped"
      top={
        <NavigationBar
          back={{ label: t('parents.title'), onBack: () => void navigate({ to: '/parents' }) }}
          title={t('access.title')}
        />
      }
    >
      <form className="flex items-center gap-2" onSubmit={add}>
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          className="flex-1"
          id={field}
          inputMode="email"
          label={t('access.placeholder')}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('access.placeholder')}
          type="email"
          value={email}
        />
        <Button
          aria-label={t('access.add')}
          className="size-14 px-0"
          disabled={pending || email.trim() === ''}
          type="submit"
        >
          <Plus aria-hidden className="size-6" />
        </Button>
      </form>
      <ListGroup footer={t('access.footer')} title={count('access.allowed', emails.length)}>
        {emails.map((entry) => (
          <ListRow
            key={entry.email}
            title={entry.email}
            accessory={
              entry.admin ? (
                <span className="text-footnote font-bold text-tint">{t('access.owner')}</span>
              ) : (
                <Button
                  aria-label={t('access.removeLabel', { email: entry.email })}
                  className="text-danger"
                  onClick={() => remove(entry.email)}
                  size="sm"
                  variant="plain"
                >
                  {t('access.remove')}
                </Button>
              )
            }
          />
        ))}
      </ListGroup>
    </Screen>
  )
}
