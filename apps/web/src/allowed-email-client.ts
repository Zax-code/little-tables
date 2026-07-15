import { Schema } from 'effect'

const AllowedEmailsSchema = Schema.Struct({ emails: Schema.Array(Schema.String) })
const AddAllowedEmailResultSchema = Schema.Struct({
  created: Schema.Boolean,
  email: Schema.String,
})

export const allowedEmailsQueryKey = ['allowed-emails'] as const

export async function fetchAllowedEmails(
  fetcher: typeof fetch = fetch,
): Promise<ReadonlyArray<string>> {
  const response = await fetcher('/api/v1/admin/allowed-emails')
  if (!response.ok) throw new Error('Allowed email addresses could not be loaded.')
  const result = await Schema.decodeUnknownPromise(AllowedEmailsSchema)(await response.json())
  return result.emails
}

export async function addAllowedEmail(
  email: string,
  fetcher: typeof fetch = fetch,
): Promise<Readonly<{ created: boolean; email: string }>> {
  const response = await fetcher('/api/v1/admin/allowed-emails', {
    body: JSON.stringify({ email }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(
      response.status === 400
        ? 'Enter a valid email address.'
        : 'That email address could not be allowed.',
    )
  }
  return Schema.decodeUnknownPromise(AddAllowedEmailResultSchema)(await response.json())
}
