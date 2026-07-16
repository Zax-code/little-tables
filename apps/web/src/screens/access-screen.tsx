import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState, type SyntheticEvent } from 'react'

import {
  addAllowedEmail,
  AllowedEmailClientError,
  removeAllowedEmail,
} from '../allowed-email-client.js'
import {
  allowedEmailsQueryOptions,
  removeAllowedEmailFromCache,
  updateAllowedEmailsCache,
} from '../allowed-email-query.js'
import { Screen } from '../components/screen.js'
import { useI18n, type TranslationKey } from '../i18n.js'

type AccessNotice = Readonly<{
  email: string
  key: TranslationKey
}>

const accessErrorKey = (error: unknown): TranslationKey => {
  if (!(error instanceof AllowedEmailClientError)) return 'access.saveFailed'
  if (error.reason === 'invalid_email') return 'access.invalidEmail'
  if (error.reason === 'load_failed') return 'access.loadFailed'
  if (error.reason === 'remove_failed') return 'access.removeFailed'
  return 'access.saveFailed'
}

export function AccessScreen() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState<AccessNotice | null>(null)
  const allowedEmails = useQuery(allowedEmailsQueryOptions)
  const addEmail = useMutation({
    mutationFn: (value: string) => addAllowedEmail(value),
    onSuccess: (result) => {
      setEmail('')
      setNotice({
        email: result.email,
        key: result.created ? 'access.created' : 'access.existing',
      })
      updateAllowedEmailsCache(queryClient, result)
    },
  })
  const removeEmail = useMutation({
    mutationFn: (value: string) => removeAllowedEmail(value),
    onSuccess: (result) => {
      setNotice({
        email: result.email,
        key: result.removed ? 'access.removed' : 'access.wasRemoved',
      })
      removeAllowedEmailFromCache(queryClient, result)
    },
  })

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    addEmail.mutate(email)
  }

  return (
    <Screen footer={false}>
      <section className="access-screen">
        <Link className="access-back-link" preload="render" to="/">
          {t('access.back')}
        </Link>
        <header>
          <p className="eyebrow">{t('access.ownerControls')}</p>
          <h1>{t('access.title')}</h1>
          <p>{t('access.intro')}</p>
        </header>

        <form className="access-form" onSubmit={submit}>
          <label htmlFor="allowed-email">{t('access.emailLabel')}</label>
          <div>
            <input
              autoCapitalize="none"
              autoComplete="email"
              id="allowed-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              spellCheck={false}
              type="email"
              value={email}
            />
            <button className="primary-button" disabled={addEmail.isPending} type="submit">
              {addEmail.isPending ? t('access.adding') : t('access.allowEmail')}
            </button>
          </div>
        </form>

        <div aria-live="polite" className="access-message">
          {removeEmail.isError
            ? t(accessErrorKey(removeEmail.error))
            : addEmail.isError
              ? t(accessErrorKey(addEmail.error))
              : notice === null
                ? null
                : t(notice.key, { email: notice.email })}
        </div>

        <section aria-labelledby="allowed-email-heading" className="allowed-email-card">
          <div className="card-heading">
            <h2 id="allowed-email-heading">{t('access.allowedCountHeading')}</h2>
            <span>{allowedEmails.data?.length ?? 0}</span>
          </div>
          {allowedEmails.isPending ? <p>{t('access.loading')}</p> : null}
          {allowedEmails.isError ? (
            <p role="alert">{t(accessErrorKey(allowedEmails.error))}</p>
          ) : null}
          {allowedEmails.data ? (
            <ul>
              {allowedEmails.data.map((allowedEmail) => (
                <li key={allowedEmail}>
                  <span>{allowedEmail}</span>
                  {allowedEmail === 'boomslang.a@gmail.com' ? (
                    <strong>{t('access.owner')}</strong>
                  ) : (
                    <button
                      aria-label={t('access.removeAria', { email: allowedEmail })}
                      className="remove-allowed-email-button"
                      disabled={removeEmail.isPending}
                      onClick={() => {
                        setNotice(null)
                        removeEmail.mutate(allowedEmail)
                      }}
                      type="button"
                    >
                      {removeEmail.isPending && removeEmail.variables === allowedEmail
                        ? t('access.removing')
                        : t('access.remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </section>
    </Screen>
  )
}
