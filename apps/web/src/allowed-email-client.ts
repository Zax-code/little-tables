import { Data, Schema } from 'effect'

const AllowedEmailsSchema = Schema.Struct({ emails: Schema.Array(Schema.String) })
const AddAllowedEmailResultSchema = Schema.Struct({
  created: Schema.Boolean,
  email: Schema.String,
})
const RemoveAllowedEmailResultSchema = Schema.Struct({
  email: Schema.String,
  removed: Schema.Boolean,
})

export const allowedEmailsQueryKey = ['allowed-emails'] as const

export type AddAllowedEmailResult = Readonly<{ created: boolean; email: string }>
export type RemoveAllowedEmailResult = Readonly<{ email: string; removed: boolean }>

export class AllowedEmailClientError extends Data.TaggedError('AllowedEmailClientError')<{
  message: string
  reason: 'invalid_email' | 'load_failed' | 'remove_failed' | 'save_failed'
}> {}

export async function fetchAllowedEmails(
  fetcher: typeof fetch = fetch,
): Promise<ReadonlyArray<string>> {
  const response = await fetcher('/api/v1/admin/allowed-emails')
  if (!response.ok) {
    throw new AllowedEmailClientError({
      message: 'Allowed email addresses could not be loaded.',
      reason: 'load_failed',
    })
  }
  const result = await Schema.decodeUnknownPromise(AllowedEmailsSchema)(await response.json())
  return result.emails
}

export async function addAllowedEmail(
  email: string,
  fetcher: typeof fetch = fetch,
): Promise<AddAllowedEmailResult> {
  const response = await fetcher('/api/v1/admin/allowed-emails', {
    body: JSON.stringify({ email }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) {
    throw new AllowedEmailClientError(
      response.status === 400
        ? { message: 'Enter a valid email address.', reason: 'invalid_email' }
        : { message: 'That email address could not be allowed.', reason: 'save_failed' },
    )
  }
  return Schema.decodeUnknownPromise(AddAllowedEmailResultSchema)(await response.json())
}

export async function removeAllowedEmail(
  email: string,
  fetcher: typeof fetch = fetch,
): Promise<RemoveAllowedEmailResult> {
  const response = await fetcher('/api/v1/admin/allowed-emails', {
    body: JSON.stringify({ email }),
    headers: { 'content-type': 'application/json' },
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new AllowedEmailClientError({
      message: 'That email address could not be removed.',
      reason: 'remove_failed',
    })
  }
  return Schema.decodeUnknownPromise(RemoveAllowedEmailResultSchema)(await response.json())
}
