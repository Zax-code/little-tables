/**
 * The whole app in a browser-like environment: the real engine (WebAssembly), IndexedDB (fake)
 * and an in-memory server. A family names its first child, waters the garden, answers every
 * question and sees its garden; the answers reach the server.
 */
import {
  ApiClient,
  ApiError,
  type ApiClientService,
  type Bootstrap,
  type ChildProfile,
} from '@little-tables/api-contract'
import { deviceTimeZone, learningDayKey } from '@little-tables/engine'
import type { AttemptEvent } from '@little-tables/engine/schema'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Effect, Layer } from 'effect'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { createDevice } from './data/device.js'
import { emptyState, LocalStore } from './data/local-store.js'
import { App } from './root.js'
import { createRuntime } from './runtime.js'
import { testEngine } from './test/engine.js'

const defaultPaths = {
  enabledSkills: [],
  focusSkill: null,
  mode: 'automatic',
  subtractionMethod: 'compensation',
} as const

/** A server keeping one family in memory. */
const memoryServer = (
  childId: string,
  learningPaths: ChildProfile['learningPaths'] = defaultPaths,
  facts: Bootstrap['snapshot']['facts'] = {},
  completedSessions = 0,
) => {
  let onboarded = false
  let child: ChildProfile = {
    avatarId: 'sprout',
    id: childId,
    learningPaths,
    name: 'google',
    reminderMinute: 1080,
  }
  const received: AttemptEvent[] = []
  let pin: string | null = null
  let failures = 0
  const device = () => ({
    pinHashParams: { hash: 'SHA-256' as const, iterations: 1000 },
    pinSalt: `salt-${pin}`,
  })
  const bootstrap = (profileId: string): Bootstrap => ({
    completedSessions,
    gardenBloomCount: 0,
    gardenCollection: emptyState().gardenCollection,
    practiceDayKeys: [],
    profile: { ...child, id: profileId },
    rewardedDayKeys: [],
    rewards: [],
    snapshot: { algorithmVersion: '1', facts, processedEventIds: [] },
  })
  const service = {
    allowedEmails: () => Effect.succeed({ emails: [] }),
    authStatus: () =>
      Effect.succeed({
        authenticated: true,
        authenticationRequired: true,
        email: 'parent@example.com',
        googleClientId: 'client',
        isAdmin: false,
        onboardingRequired: !onboarded,
        sessionExpiresAt: Date.now() + 86_400_000,
      }),
    bootstrap: (profileId: string) => Effect.succeed(bootstrap(profileId)),
    introductionSeen: () => Effect.succeed({ introductionSeen: true as const }),
    logout: () => Effect.succeed({ status: 'signed-out' as const }),
    parentLock: () =>
      Effect.sync(() => ({
        configured: pin !== null,
        lockedUntil: null,
        pinSalt: pin === null ? null : `salt-${pin}`,
      })),
    setParentLock: (next: string) =>
      Effect.sync(() => {
        pin = next
        return device()
      }),
    verifyParentLock: (given: string) =>
      given === pin
        ? Effect.sync(() => {
            failures = 0
            return device()
          })
        : Effect.fail(
            new ApiError({
              code: 'wrong_pin',
              message: '',
              remainingAttempts: 5 - (failures += 1),
              status: 403,
            }),
          ),
    onboarding: (input: { name: string }) =>
      Effect.sync(() => {
        onboarded = true
        child = { ...child, name: input.name }
        return { profile: child }
      }),
    profiles: () => Effect.sync(() => ({ profiles: [child] })),
    refresh: () =>
      Effect.succeed({ sessionExpiresAt: Date.now() + 86_400_000, status: 'renewed' as const }),
    sync: (_profileId: string, attempts: ReadonlyArray<AttemptEvent>) =>
      Effect.sync(() => {
        received.push(...attempts)
        return { accepted: attempts.map(({ eventId }) => eventId), duplicates: [], rejected: [] }
      }),
  } as unknown as ApiClientService
  return { layer: Layer.succeed(ApiClient, service), received }
}

const memoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

beforeAll(() => {
  // happy-dom has no media queries for motion preferences.
  window.matchMedia = ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    matches: query.includes('reduce'),
    media: query,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  })) as unknown as typeof window.matchMedia
})

afterEach(cleanup)

/** Opens the app on a fresh device and names the first child. */
const openApp = async (
  childId: string,
  learningPaths?: ChildProfile['learningPaths'],
  facts?: Bootstrap['snapshot']['facts'],
  completedSessions?: number,
) => {
  window.history.replaceState(null, '', '/')
  const server = memoryServer(childId, learningPaths, facts, completedSessions)
  const runtime = createRuntime(Layer.mergeAll(server.layer, testEngine, LocalStore.layer))
  const user = userEvent.setup()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <App device={createDevice(memoryStorage())} runtime={runtime} />
    </QueryClientProvider>,
  )
  await user.type(await screen.findByRole('textbox', { name: 'Prénom' }), 'Léa')
  await user.click(screen.getByRole('button', { name: 'Ouvrir mon jardin' }))
  expect(await screen.findByRole('heading', { name: 'Coucou Léa ♡' })).toBeInTheDocument()
  return { runtime, server, user }
}

describe('the new app', () => {
  it('opens, names the first child, waters the garden and syncs the answers', async () => {
    const { runtime, server, user } = await openApp('waterer')

    await user.click(screen.getByRole('button', { name: 'Arroser mon jardin' }))
    for (let index = 0; index < 20; index += 1) {
      const next = screen.queryByRole('button', { name: 'Suivant' })
      if (next !== null) {
        await user.click(next)
        continue
      }
      // Screens other than Today load on first visit: the next question or the celebration.
      const spoken = await waitFor(
        () =>
          screen.queryByRole('button', { name: 'Voir mon jardin' }) ??
          screen.getByText(/^\d+ (fois|divisé par) \d+$/),
        { timeout: 5000 },
      )
      if (spoken.textContent === 'Voir mon jardin') break
      const [left, word, right] = spoken.textContent.split(' ')
      const answer = word === 'fois' ? Number(left) * Number(right) : Number(left) / Number(right)
      const tile = screen.queryByRole('button', { name: String(answer) })
      if (tile !== null) {
        await user.click(tile)
      } else {
        for (const digit of String(answer))
          await user.click(screen.getByRole('button', { name: digit }))
        await user.click(screen.getByRole('button', { name: 'Valider' }))
      }
      await screen.findByRole('button', { name: 'Suivant' })
    }

    expect(
      await screen.findByRole('heading', { name: /^Oui ! \d+ ♡$/ }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('+1 arrosage')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Voir mon jardin' }))
    // The first visit explains how the garden grows before showing it.
    const rules = await screen.findByRole(
      'dialog',
      { name: 'Comment ça pousse' },
      { timeout: 5000 },
    )
    await user.click(screen.getByRole('button', { name: 'J’ai compris' }))
    // happy-dom never ends the sheet's closing animation; its state is enough here.
    await waitFor(() => expect(rules).toHaveAttribute('data-state', 'closed'))
    expect(screen.getByRole('heading', { hidden: true, name: 'Mon jardin' })).toBeInTheDocument()
    // Without a ticked verb, the garden has no meadow.
    expect(screen.queryByRole('button', { hidden: true, name: /Le pré des verbes/ })).toBeNull()

    await act(() => new Promise((resolve) => setTimeout(resolve, 1700)))
    await waitFor(() => expect(server.received.length).toBeGreaterThanOrEqual(5))
    await runtime.dispose()
  }, 30_000)

  it('practises a verb the parent ticked, with word tiles', async () => {
    const finir: Readonly<Record<string, string>> = {
      elle: 'finit',
      elles: 'finissent',
      il: 'finit',
      ils: 'finissent',
      je: 'finis',
      nous: 'finissons',
      tu: 'finis',
      vous: 'finissez',
    }
    const { runtime, server, user } = await openApp('conjugation', {
      ...defaultPaths,
      conjugation: { focus: null, tenses: ['present'], verbs: ['finir'] },
    })
    await user.click(screen.getByRole('button', { name: 'Autres séances' }))
    await user.click(await screen.findByRole('button', { name: 'finir' }))
    let verbQuestions = 0
    for (let index = 0; index < 20; index += 1) {
      const next = screen.queryByRole('button', { name: 'Suivant' })
      if (next !== null) {
        await user.click(next)
        continue
      }
      const spoken = await waitFor(
        () =>
          screen.queryByRole('button', { name: 'Voir le pré des verbes' }) ??
          screen.getByText(/^(\S+)… finir, au présent$|^\d+ (fois|divisé par) \d+$/),
        { timeout: 5000 },
      )
      if (spoken.textContent === 'Voir le pré des verbes') break
      const verb = /^(\S+)… finir/.exec(spoken.textContent)
      let answer: string
      if (verb !== null) {
        verbQuestions += 1
        answer = finir[verb[1] ?? ''] ?? ''
        expect(screen.getByText('finir · au présent')).toBeInTheDocument()
      } else {
        const [left, word, right] = spoken.textContent.split(' ')
        answer = String(
          word === 'fois' ? Number(left) * Number(right) : Number(left) / Number(right),
        )
      }
      const tile = screen.queryByRole('button', { name: answer })
      if (tile !== null) {
        await user.click(tile)
      } else {
        for (const digit of answer) await user.click(screen.getByRole('button', { name: digit }))
        await user.click(screen.getByRole('button', { name: 'Valider' }))
      }
      expect(await screen.findByRole('button', { name: 'Suivant' })).toBeInTheDocument()
    }
    expect(verbQuestions).toBeGreaterThanOrEqual(4)
    // Three right answers on the verb bring a butterfly to it in the meadow.
    expect(screen.getByText('+1 papillon')).toBeInTheDocument()
    expect(
      screen.getByText('Il se pose sur « finir », dans le pré des verbes.'),
    ).toBeInTheDocument()
    await act(() => new Promise((resolve) => setTimeout(resolve, 1700)))
    await waitFor(() =>
      expect(server.received.some(({ factKey }) => factKey === 'conj:finir:present')).toBe(true),
    )
    expect(
      server.received
        .filter(({ factKey }) => factKey === 'conj:finir:present')
        .every(({ correct }) => correct),
    ).toBe(true)
    await runtime.dispose()
  }, 30_000)

  it('writes a familiar verb with the letter tiles and the keyboard', async () => {
    const finir: Readonly<Record<string, string>> = {
      elle: 'finit',
      elles: 'finissent',
      il: 'finit',
      ils: 'finissent',
      je: 'finis',
      nous: 'finissons',
      tu: 'finis',
      vous: 'finissez',
    }
    const day = 86_400_000
    // Three right answers on three days, as the server would send after them.
    const familiar = {
      correctCount: 3,
      correctStreak: 3,
      difficulty: 0.44,
      dueAt: Date.now() - day,
      lapseCount: 0,
      lastReviewedAt: Date.now() - 2 * day,
      lastReviewedDayKey: '2026-10-04',
      latencyMs: 3000,
      recallDayKeys: [],
      stabilityDays: 2.25,
      state: 'familiar' as const,
      successfulDayKeys: ['2026-10-02', '2026-10-03', '2026-10-04'],
    }
    const { runtime, server, user } = await openApp(
      'writer',
      { ...defaultPaths, conjugation: { focus: null, tenses: ['present'], verbs: ['finir'] } },
      { 'conj:finir:present': familiar },
    )
    // The bootstrap brings the familiar verb after the first sync.
    await act(() => new Promise((resolve) => setTimeout(resolve, 1700)))
    await user.click(screen.getByRole('button', { name: 'Autres séances' }))
    await user.click(await screen.findByRole('button', { name: 'finir' }))
    let written = 0
    for (let index = 0; index < 20; index += 1) {
      const next = screen.queryByRole('button', { name: 'Suivant' })
      if (next !== null) {
        await user.click(next)
        continue
      }
      const spoken = await waitFor(
        () =>
          screen.queryByRole('button', { name: 'Voir le pré des verbes' }) ??
          screen.getByText(/^(\S+)… finir, au présent$|^\d+ (fois|divisé par) \d+$/),
        { timeout: 5000 },
      )
      if (spoken.textContent === 'Voir le pré des verbes') break
      const verb = /^(\S+)… finir/.exec(spoken.textContent)
      if (verb === null) {
        const [left, word, right] = spoken.textContent.split(' ')
        const answer = String(
          word === 'fois' ? Number(left) * Number(right) : Number(left) / Number(right),
        )
        const tile = screen.queryByRole('button', { name: answer })
        if (tile !== null) await user.click(tile)
        else {
          for (const digit of answer) await user.click(screen.getByRole('button', { name: digit }))
          await user.click(screen.getByRole('button', { name: 'Valider' }))
        }
      } else {
        const form = finir[verb[1] ?? ''] ?? ''
        // Written, not chosen: no word tile, a group of letter tiles.
        expect(screen.queryByRole('button', { name: form })).toBeNull()
        expect(screen.getByRole('group', { name: 'Lettres' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled()
        if (written % 2 === 0) {
          // One wrong tile, erased, then the form tile by tile.
          const letters = screen.getByRole('group', { name: 'Lettres' })
          const spare = [...letters.querySelectorAll('button')].find(
            (button) =>
              !button.disabled &&
              button.getAttribute('aria-label')?.length === 1 &&
              !form.startsWith(button.getAttribute('aria-label') ?? ''),
          )
          if (spare !== undefined) {
            await user.click(spare)
            await user.click(screen.getByRole('button', { name: 'Effacer' }))
          }
          for (const letter of form) {
            const tile = screen
              .getAllByRole('button', { name: letter })
              .find((button) => !(button as HTMLButtonElement).disabled)
            if (tile === undefined) throw new Error(`no tile left for ${letter}`)
            await user.click(tile)
          }
          expect(screen.getByText(form, { selector: 'span' })).toBeInTheDocument()
          await user.click(screen.getByRole('button', { name: 'Valider' }))
        } else {
          // An iPad keyboard: letters, the last one erased and typed again, then Enter.
          await user.keyboard(`${form}{Backspace}${form.slice(-1)}{Enter}`)
        }
        written += 1
        expect(await screen.findByText(`Oui ! ${form} ♡`)).toBeInTheDocument()
      }
      expect(await screen.findByRole('button', { name: 'Suivant' })).toBeInTheDocument()
    }
    expect(written).toBeGreaterThanOrEqual(2)
    await act(() => new Promise((resolve) => setTimeout(resolve, 1700)))
    await waitFor(() => {
      const verbs = server.received.filter(({ factKey }) => factKey === 'conj:finir:present')
      expect(verbs.length).toBe(written)
      expect(verbs.every(({ answerMode, correct }) => correct && answerMode === 'keypad')).toBe(
        true,
      )
    })
    await runtime.dispose()
  }, 40_000)

  it('invites to water a thirsty verb, but not on the first visit', async () => {
    const day = 86_400_000
    const verbs = {
      ...defaultPaths,
      conjugation: { focus: null, tenses: ['present' as const], verbs: ['aller', 'finir'] },
    }
    const first = await openApp('first-visit', verbs)
    await act(() => new Promise((resolve) => setTimeout(resolve, 1700)))
    expect(screen.queryByText('Tes verbes ont soif')).toBeNull()
    await first.runtime.dispose()
    cleanup()

    const lastSeen = learningDayKey(Date.now() - 4 * day, deviceTimeZone())
    const seen = {
      correctCount: 2,
      correctStreak: 1,
      difficulty: 0.5,
      dueAt: null,
      lapseCount: 0,
      lastReviewedAt: Date.now() - 4 * day,
      lastReviewedDayKey: lastSeen,
      latencyMs: 3000,
      recallDayKeys: [],
      stabilityDays: 1,
      state: 'learning' as const,
      successfulDayKeys: [lastSeen],
    }
    const { runtime } = await openApp('thirsty', verbs, { 'conj:finir:present': seen }, 3)
    expect(
      await screen.findByText('Tes verbes ont soif', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '« finir » attend depuis 4 jours' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Arroser « finir »' })).toBeEnabled()
    expect(screen.getByText('8 questions')).toBeInTheDocument()
    await runtime.dispose()
  }, 30_000)

  it('sorts the verb meadow by group, with a butterfly on the verbs worked this week', async () => {
    const today = learningDayKey(Date.now(), deviceTimeZone())
    const rooted = {
      correctCount: 6,
      correctStreak: 3,
      difficulty: 0.3,
      dueAt: null,
      lapseCount: 0,
      lastReviewedAt: Date.now(),
      lastReviewedDayKey: today,
      latencyMs: 2000,
      recallDayKeys: [],
      stabilityDays: 8,
      state: 'fluent' as const,
      successfulDayKeys: [today],
    }
    const { runtime, user } = await openApp(
      'meadow',
      {
        ...defaultPaths,
        conjugation: {
          focus: null,
          tenses: ['present'],
          verbs: ['venir', 'finir', 'chanter', 'être', 'danser', 'avoir'],
        },
      },
      { 'conj:finir:present': rooted },
    )
    await act(() => new Promise((resolve) => setTimeout(resolve, 1700)))
    await user.click(screen.getByRole('link', { name: 'Jardin' }))
    const rules = await screen.findByRole(
      'dialog',
      { name: 'Comment ça pousse' },
      { timeout: 5000 },
    )
    await user.click(screen.getByRole('button', { name: 'J’ai compris' }))
    await waitFor(() => expect(rules).toHaveAttribute('data-state', 'closed'))
    expect(screen.getByText('Un papillon t’attend dans le pré des verbes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { hidden: true, name: /Le pré des verbes/ }))

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Le pré des verbes' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('1 papillon est venu cette semaine')).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map(({ textContent }) => textContent),
    ).toEqual(['Être et avoir', '1er groupe', '2e groupe', '3e groupe'])
    const cards = screen.getAllByRole('button', { name: /^\S+ : Présent/ })
    expect(cards.map((card) => card.getAttribute('aria-label')?.split(' : ')[0])).toEqual([
      'être',
      'avoir',
      'chanter',
      'danser',
      'finir',
      'venir',
    ])
    const finir = cards[4]
    expect(finir?.getAttribute('aria-label')).toMatch(/un papillon est venu$/)
    expect(finir?.getAttribute('data-stage')).toBe('mature')
    expect(cards[0]?.getAttribute('data-stage')).toBe('seed')
    await runtime.dispose()
  }, 30_000)

  it('keeps the parent space behind a code chosen on the first visit', async () => {
    const { runtime, user } = await openApp('parent-code')
    const typeCode = async (code: string) => {
      for (const digit of code) await user.click(screen.getByRole('button', { name: digit }))
    }

    await user.click(screen.getByRole('button', { name: 'Espace parents' }))
    expect(
      await screen.findByRole('heading', { name: 'Choisis un code parent' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    await typeCode('2468')
    expect(
      await screen.findByRole('heading', { name: 'Tape-le encore une fois' }),
    ).toBeInTheDocument()
    await typeCode('2468')
    expect(
      await screen.findByRole('heading', { name: 'Parents' }, { timeout: 5000 }),
    ).toBeInTheDocument()

    // Back in the child space, the code is asked again.
    await user.click(screen.getByRole('button', { name: 'OK' }))
    await screen.findByRole('heading', { name: 'Coucou Léa ♡' })
    await user.click(screen.getByRole('button', { name: 'Espace parents' }))
    expect(await screen.findByRole('heading', { name: 'Code parent' })).toBeInTheDocument()
    await typeCode('1111')
    expect(await screen.findByText('Code incorrect. Encore 4 essais.')).toBeInTheDocument()
    await typeCode('2468')
    expect(
      await screen.findByRole('heading', { name: 'Parents' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    await runtime.dispose()
  }, 30_000)
})
