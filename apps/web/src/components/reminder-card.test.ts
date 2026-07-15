import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { useEffect, useState } = vi.hoisted(() => ({
  useEffect: vi.fn(),
  useState: vi.fn(),
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect,
  useState,
}))

import { ReminderCard, serializePushSubscription } from './reminder-card.js'

describe('reminder card', () => {
  it('normalizes an omitted expirationTime before saving a subscription', () => {
    const subscription = {
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      toJSON: () => ({
        endpoint: 'https://push.example/subscription',
        keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
      }),
    }

    expect(serializePushSubscription(subscription)).toEqual({
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
    })
  })

  it('renders nothing once notifications are enabled', () => {
    useState
      .mockReturnValueOnce(['enabled', vi.fn()])
      .mockReturnValueOnce(['daily at 6:00 pm · quiet after you practice', vi.fn()])

    const markup = renderToStaticMarkup(createElement(ReminderCard))

    expect(markup).toBe('')
  })
})
