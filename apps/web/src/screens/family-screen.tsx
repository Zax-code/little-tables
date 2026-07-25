import {
  FamilyProfiles,
  type ChildAvatarId,
  type ChildProfile,
  type SelectableChildAvatarId,
} from '@little-tables/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { SyntheticEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

import { ProfileAvatar } from '../components/profile-avatar.js'
import { Screen } from '../components/screen.js'
import {
  createChildProfile,
  familyProfilesQueryKey,
  FamilyProfileClientError,
  removeChildProfile,
  updateChildProfile,
} from '../family-profile-client.js'
import { useI18n } from '../i18n.js'
import { useFamilyProfile } from '../use-family-profile.js'

export function AvatarPicker({
  defaultValue,
  name,
  onChange,
  value,
}: Readonly<{
  defaultValue?: ChildAvatarId
  name: string
  onChange?: (avatarId: SelectableChildAvatarId) => void
  value?: ChildAvatarId
}>) {
  const { t } = useI18n()
  const selectedAvatarId = value ?? defaultValue
  const checkedAvatarId =
    selectedAvatarId === 'sunbeam' ||
    selectedAvatarId === 'bluebell' ||
    selectedAvatarId === 'berry'
      ? 'sprout'
      : selectedAvatarId
  return (
    <fieldset className="avatar-picker">
      <legend>{t('family.avatarLabel')}</legend>
      <div>
        {FamilyProfiles.selectableAvatarIds.map((avatarId) => (
          <label key={avatarId}>
            <input
              {...(value === undefined
                ? { defaultChecked: avatarId === checkedAvatarId }
                : { checked: avatarId === checkedAvatarId })}
              name={name}
              onChange={() => onChange?.(avatarId)}
              type="radio"
              value={avatarId}
            />
            <ProfileAvatar avatarId={avatarId} />
            <span className="avatar-picker__name">{t(`family.avatar.${avatarId}`)}</span>
            <span aria-hidden="true" className="avatar-picker__check">
              ✓
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function RemoveMemberDialog({
  memberName,
  onCancel,
  onConfirm,
  pending,
}: Readonly<{
  memberName: string
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}>) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const id = useId()
  const headingId = `${id}-heading`
  const warningId = `${id}-warning`

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    if (!dialog.open) dialog.showModal()
  }, [])

  const close = () => {
    if (!pending) dialogRef.current?.close()
  }

  return (
    <dialog
      aria-describedby={warningId}
      aria-labelledby={headingId}
      aria-modal="true"
      className="family-remove-dialog"
      onCancel={(event) => {
        if (pending) event.preventDefault()
      }}
      onClose={onCancel}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        close()
      }}
      ref={dialogRef}
      role="alertdialog"
    >
      <div aria-hidden="true" className="family-remove-dialog__warning">
        !
      </div>
      <h2 id={headingId}>{t('family.removeDialogHeading', { name: memberName })}</h2>
      <p id={warningId}>{t('family.removeDialogWarning', { name: memberName })}</p>
      <div className="family-remove-dialog__actions">
        <button autoFocus className="family-remove-dialog__cancel" onClick={close} type="button">
          {t('family.cancelRemove')}
        </button>
        <button
          className="family-remove-dialog__confirm"
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          {pending ? t('family.removing') : t('family.confirmRemove', { name: memberName })}
        </button>
      </div>
    </dialog>
  )
}

function ChildProfileEditor({
  canRemove,
  onRemove,
  onSave,
  profile,
}: Readonly<{
  canRemove: boolean
  onRemove: () => Promise<void>
  onSave: (input: Readonly<{ avatarId: SelectableChildAvatarId; name: string }>) => Promise<void>
  profile: ChildProfile
}>) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string>()
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const save = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const childName = values.get('childName')
    if (typeof childName !== 'string') return
    const name = childName
    const selectedAvatar = values.get('avatarId')
    const avatarId = FamilyProfiles.selectableAvatarIds.find(
      (candidate) => candidate === selectedAvatar,
    )
    if (avatarId === undefined) return
    if (pending || name.trim() === '') return
    setPending(true)
    setMessage(undefined)
    void onSave({ avatarId, name })
      .then(() => setMessage(t('family.saved')))
      .catch(() => setMessage(t('family.saveFailed')))
      .finally(() => setPending(false))
  }

  return (
    <form className="child-profile-card" onSubmit={save}>
      <label htmlFor={`child-name-${profile.id}`}>{t('family.nameLabel')}</label>
      <input
        autoComplete="off"
        defaultValue={profile.name}
        id={`child-name-${profile.id}`}
        maxLength={40}
        name="childName"
        required
      />
      <AvatarPicker defaultValue={profile.avatarId} name="avatarId" />
      <div className="child-profile-actions">
        <button className="family-save-button" disabled={pending} type="submit">
          {pending ? t('family.saving') : t('family.save')}
        </button>
        <button
          className="family-remove-button"
          disabled={!canRemove || pending}
          onClick={() => setConfirmingRemove(true)}
          type="button"
        >
          {t('family.remove')}
        </button>
      </div>
      {confirmingRemove ? (
        <RemoveMemberDialog
          memberName={profile.name}
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={() => {
            setPending(true)
            setMessage(undefined)
            void onRemove()
              .catch((error: unknown) =>
                setMessage(
                  error instanceof FamilyProfileClientError && error.reason === 'last-profile'
                    ? t('family.lastRequired')
                    : t('family.removeFailed'),
                ),
              )
              .finally(() => {
                setPending(false)
                setConfirmingRemove(false)
              })
          }}
          pending={pending}
        />
      ) : null}
      {message ? (
        <p className="family-card-message" role="status">
          {message}
        </p>
      ) : null}
    </form>
  )
}

export function FamilyScreen() {
  const { activeProfile, profiles, switchProfile } = useFamilyProfile()
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAvatarId, setNewAvatarId] = useState<SelectableChildAvatarId>(
    FamilyProfiles.defaultAvatarId,
  )
  const [message, setMessage] = useState<string>()

  const setProfiles = (nextProfiles: ReadonlyArray<ChildProfile>) =>
    queryClient.setQueryData(familyProfilesQueryKey, nextProfiles)

  const add = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (adding || newName.trim() === '') return
    setAdding(true)
    setMessage(undefined)
    void createChildProfile({ avatarId: newAvatarId, name: newName })
      .then((profile) => {
        setProfiles([...profiles, profile])
        switchProfile(profile.id)
        setNewName('')
        setNewAvatarId(FamilyProfiles.defaultAvatarId)
        setMessage(t('family.added', { name: profile.name }))
      })
      .catch(() => setMessage(t('family.addFailed')))
      .finally(() => setAdding(false))
  }

  return (
    <Screen footer={false}>
      <section className="family-screen">
        <button
          className="family-back-button"
          onClick={() => void navigate({ to: '/' })}
          type="button"
        >
          {t('family.back')}
        </button>
        <header>
          <p className="eyebrow">{t('family.eyebrow')}</p>
          <h1>{t('family.heading')}</h1>
          <p>{t('family.intro')}</p>
        </header>

        <form className="add-child-card" onSubmit={add}>
          <h2>{t('family.addHeading')}</h2>
          <label htmlFor="new-child-name">{t('family.nameLabel')}</label>
          <input
            autoComplete="off"
            id="new-child-name"
            maxLength={40}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t('family.namePlaceholder')}
            required
            value={newName}
          />
          <AvatarPicker name="new-avatar" onChange={setNewAvatarId} value={newAvatarId} />
          <button className="primary-button" disabled={adding} type="submit">
            {adding ? t('family.adding') : t('family.add')}
          </button>
        </form>

        {message ? (
          <p className="family-message" role="status">
            {message}
          </p>
        ) : null}

        <div className="family-profile-list">
          <h2>{t('family.membersHeading')}</h2>
          {profiles.map((profile) => (
            <ChildProfileEditor
              canRemove={profiles.length > 1}
              key={`${profile.id}:${profile.name}:${profile.avatarId}`}
              onRemove={async () => {
                await removeChildProfile(profile.id)
                const remaining = profiles.filter(({ id }) => id !== profile.id)
                setProfiles(remaining)
                if (activeProfile.id === profile.id && remaining[0] !== undefined) {
                  switchProfile(remaining[0].id)
                }
              }}
              onSave={async (input) => {
                const updated = await updateChildProfile(profile.id, input)
                setProfiles(
                  profiles.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
                )
              }}
              profile={profile}
            />
          ))}
        </div>
      </section>
    </Screen>
  )
}
