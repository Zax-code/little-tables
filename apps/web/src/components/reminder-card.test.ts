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

import { ReminderCard } from './reminder-card.js'

describe('reminder card', () => {
  it('renders nothing once notifications are enabled', () => {
    useState
      .mockReturnValueOnce(['enabled', vi.fn()])
      .mockReturnValueOnce(['daily at 6:00 pm · quiet after you practice', vi.fn()])

    const markup = renderToStaticMarkup(createElement(ReminderCard))

    expect(markup).toBe('')
  })
})
