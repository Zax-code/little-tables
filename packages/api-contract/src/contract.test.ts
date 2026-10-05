import { HttpClient, HttpClientResponse } from '@effect/platform'
import { Effect, Either, Layer, Schema } from 'effect'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { ApiClient, ApiError, ContractError } from './client.js'
import { responses } from './schema.js'

/** Responses recorded from the Rust server by `crates/lt-server/tests/v2.rs`. */
const recorded = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../crates/lt-server/tests/fixtures/v2-responses.json', import.meta.url),
    ),
    'utf8',
  ),
) as Record<string, unknown>

describe('the /api/v2 contract', () => {
  it('records exactly the responses the schemas describe', () => {
    expect(Object.keys(recorded).sort()).toEqual(Object.keys(responses).sort())
  })

  it.each(Object.entries(responses))('decodes %s strictly', (name, schema) => {
    const decoded = Schema.decodeUnknownEither(schema as Schema.Schema<unknown, unknown>, {
      onExcessProperty: 'error',
    })(recorded[name])
    if (Either.isLeft(decoded)) throw new Error(String(decoded.left))
  })
})

/** A client whose server answers every request with `status` and `body`. */
const clientAnswering = (status: number, body: unknown, seen: Request[] = []) =>
  ApiClient.layer('https://math.example').pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.sync(() => {
            const url = new URL(request.url)
            for (const [key, value] of request.urlParams) url.searchParams.append(key, value)
            const web = new Request(url, {
              headers: request.headers,
              method: request.method,
            })
            seen.push(web)
            return HttpClientResponse.fromWeb(
              request,
              new Response(JSON.stringify(body), { status }),
            )
          }),
        ),
      ),
    ),
  )

describe('ApiClient', () => {
  it('marks requests, names profiles in the path and decodes the answer', async () => {
    const seen: Request[] = []
    const result = await Effect.runPromise(
      Effect.flatMap(ApiClient, (client) => client.bootstrap('lé a')).pipe(
        Effect.provide(clientAnswering(200, recorded.bootstrap, seen)),
      ),
    )
    expect(result.profile.name).toBe('Léa')
    expect(seen[0]?.url).toBe('https://math.example/api/v2/profiles/l%C3%A9%20a/bootstrap')
    expect(seen[0]?.headers.get('x-little-tables')).toBe('1')
  })

  it('tells refusals from unreadable answers', async () => {
    const refused = await Effect.runPromise(
      Effect.flatMap(ApiClient, (client) => client.removeProfile('lou')).pipe(
        Effect.flip,
        Effect.provide(clientAnswering(409, { error: 'last_profile_required' })),
      ),
    )
    expect(refused).toEqual(
      new ApiError({ code: 'last_profile_required', message: '', status: 409 }),
    )
    const drifted = await Effect.runPromise(
      Effect.flatMap(ApiClient, (client) => client.authStatus()).pipe(
        Effect.flip,
        Effect.provide(clientAnswering(200, { authenticated: 'yes' })),
      ),
    )
    expect(drifted).toBeInstanceOf(ContractError)
  })

  it('puts the subscription endpoint in the query', async () => {
    const seen: Request[] = []
    await Effect.runPromise(
      Effect.flatMap(ApiClient, (client) =>
        client.unsubscribe('lou', 'https://push.example/a?b'),
      ).pipe(Effect.provide(clientAnswering(200, { status: 'unsubscribed' }, seen))),
    )
    expect(seen[0]?.method).toBe('DELETE')
    expect(new URL(seen[0]?.url ?? '').searchParams.get('endpoint')).toBe(
      'https://push.example/a?b',
    )
  })
})
