import { Effect, Layer, Result, Schema } from 'effect'
import { HttpClient, HttpClientError, HttpClientResponse } from 'effect/http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { ApiClient, ApiError, ContractError, NetworkError } from './client.js'
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
    const decoded = Schema.decodeUnknownResult(schema, {
      onExcessProperty: 'error',
    })(recorded[name])
    if (Result.isFailure(decoded)) throw new Error(String(decoded.failure))
  })
})

/** A client whose server answers every request with `status` and `body`. */
const clientAnswering = (status: number, body: unknown, seen: Request[] = []) =>
  ApiClient.layer('https://math.example').pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request, url) =>
          Effect.sync(() => {
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

  it('tells a lost connection from a refusal', async () => {
    const failure = (http: HttpClient.HttpClient) =>
      Effect.runPromise(
        Effect.flatMap(ApiClient, (client) => client.authStatus()).pipe(
          Effect.flip,
          Effect.provide(
            ApiClient.layer('https://math.example').pipe(
              Layer.provide(Layer.succeed(HttpClient.HttpClient, http)),
            ),
          ),
        ),
      )
    const replying = (body: string, status: number) =>
      HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response(body, { status }))),
      )

    const unreachable = await failure(
      HttpClient.make((request) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request }),
          }),
        ),
      ),
    )
    expect(unreachable).toBeInstanceOf(NetworkError)
    expect(await failure(replying('<html>', 200))).toBeInstanceOf(NetworkError)
    expect(await failure(replying('<html>', 502))).toEqual(
      new ApiError({ code: 'unknown', message: '', status: 502 }),
    )
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

  it('keeps what a refused parent code tells', async () => {
    const wrong = await Effect.runPromise(
      Effect.flatMap(ApiClient, (client) => client.verifyParentLock('0000')).pipe(
        Effect.flip,
        Effect.provide(clientAnswering(403, recorded.wrongPin)),
      ),
    )
    expect(wrong).toMatchObject({ code: 'wrong_pin', remainingAttempts: 1, status: 403 })
    const locked = await Effect.runPromise(
      Effect.flatMap(ApiClient, (client) => client.verifyParentLock('0000')).pipe(
        Effect.flip,
        Effect.provide(clientAnswering(423, recorded.lockedPin)),
      ),
    )
    expect(locked).toMatchObject({ code: 'parent_lock_locked', status: 423 })
    expect(locked).toHaveProperty('lockedUntil', expect.any(Number))
  })

  it('asks for insights over a range ending on the app’s today', async () => {
    const seen: Request[] = []
    const insights = await Effect.runPromise(
      Effect.flatMap(ApiClient, (client) => client.insights('lou', '30d', '2026-07-27')).pipe(
        Effect.provide(clientAnswering(200, recorded.insights, seen)),
      ),
    )
    expect(insights.struggles[0]?.factKey).toBe('7:8')
    const url = new URL(seen[0]?.url ?? '')
    expect(url.pathname).toBe('/api/v2/profiles/lou/insights')
    expect(Object.fromEntries(url.searchParams)).toEqual({ range: '30d', today: '2026-07-27' })
  })
})
