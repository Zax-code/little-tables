import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState, type SyntheticEvent } from 'react'

import { addAllowedEmail, removeAllowedEmail } from '../allowed-email-client.js'
import {
  allowedEmailsQueryOptions,
  removeAllowedEmailFromCache,
  updateAllowedEmailsCache,
} from '../allowed-email-query.js'
import { Screen } from '../components/screen.js'

export function AccessScreen() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const allowedEmails = useQuery(allowedEmailsQueryOptions)
  const addEmail = useMutation({
    mutationFn: (value: string) => addAllowedEmail(value),
    onSuccess: (result) => {
      setEmail('')
      setNotice(
        result.created
          ? `${result.email} can now sign in.`
          : `${result.email} was already allowed.`,
      )
      updateAllowedEmailsCache(queryClient, result)
    },
  })
  const removeEmail = useMutation({
    mutationFn: (value: string) => removeAllowedEmail(value),
    onSuccess: (result) => {
      setNotice(
        result.removed
          ? `${result.email} can no longer sign in.`
          : `${result.email} was already removed.`,
      )
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
          ← back to the garden
        </Link>
        <header>
          <p className="eyebrow">owner controls</p>
          <h1>who can join</h1>
          <p>
            Add the Google email address a new learner will use to sign in. Removing an address
            signs that learner out on their next connection.
          </p>
        </header>

        <form className="access-form" onSubmit={submit}>
          <label htmlFor="allowed-email">Google email address</label>
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
              {addEmail.isPending ? 'adding…' : 'allow email'}
            </button>
          </div>
        </form>

        <div aria-live="polite" className="access-message">
          {removeEmail.isError
            ? removeEmail.error instanceof Error
              ? removeEmail.error.message
              : 'That email address could not be removed.'
            : addEmail.isError
              ? addEmail.error instanceof Error
                ? addEmail.error.message
                : 'That email address could not be allowed.'
              : notice}
        </div>

        <section aria-labelledby="allowed-email-heading" className="allowed-email-card">
          <div className="card-heading">
            <h2 id="allowed-email-heading">allowed now</h2>
            <span>{allowedEmails.data?.length ?? 0}</span>
          </div>
          {allowedEmails.isPending ? <p>loading addresses…</p> : null}
          {allowedEmails.isError ? (
            <p role="alert">Allowed email addresses could not be loaded.</p>
          ) : null}
          {allowedEmails.data ? (
            <ul>
              {allowedEmails.data.map((allowedEmail) => (
                <li key={allowedEmail}>
                  <span>{allowedEmail}</span>
                  {allowedEmail === 'boomslang.a@gmail.com' ? (
                    <strong>owner</strong>
                  ) : (
                    <button
                      aria-label={`Remove ${allowedEmail} from the allowlist`}
                      className="remove-allowed-email-button"
                      disabled={removeEmail.isPending}
                      onClick={() => {
                        setNotice(null)
                        removeEmail.mutate(allowedEmail)
                      }}
                      type="button"
                    >
                      {removeEmail.isPending && removeEmail.variables === allowedEmail
                        ? 'removing…'
                        : 'remove'}
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
