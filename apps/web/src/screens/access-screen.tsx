import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SyntheticEvent } from 'react'

import {
  addAllowedEmail,
  allowedEmailsQueryKey,
  fetchAllowedEmails,
} from '../allowed-email-client.js'
import { Screen } from '../components/screen.js'

export function AccessScreen() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const allowedEmails = useQuery({
    queryKey: allowedEmailsQueryKey,
    queryFn: () => fetchAllowedEmails(),
  })
  const addEmail = useMutation({
    mutationFn: (value: string) => addAllowedEmail(value),
    onSuccess: async (result) => {
      setEmail('')
      setNotice(
        result.created
          ? `${result.email} can now sign in.`
          : `${result.email} was already allowed.`,
      )
      await queryClient.invalidateQueries({ queryKey: allowedEmailsQueryKey })
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
        <a className="access-back-link" href="/">
          ← back to the garden
        </a>
        <header>
          <p className="eyebrow">owner controls</p>
          <h1>who can join</h1>
          <p>Add the Google email address a new learner will use to sign in.</p>
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
          {addEmail.isError
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
                  {allowedEmail === 'boomslang.a@gmail.com' ? <strong>owner</strong> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </section>
    </Screen>
  )
}
