import type { PracticePolicy } from '@little-tables/engine/schema'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'

import { profileStateKey, useApp } from '../app/app-context.js'
import { startSession } from '../data/practice.js'

/** Starts a session for the active child and opens it. */
export function useLaunch() {
  const { activeProfile, runtime } = useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)

  const start = useCallback(
    async (policy: PracticePolicy) => {
      if (pending) return false
      setPending(true)
      try {
        const session = await runtime.runPromise(startSession(activeProfile.id, policy))
        if (session === null) return false
        await queryClient.invalidateQueries({ queryKey: profileStateKey(activeProfile.id) })
        await navigate({ to: '/session' })
        return true
      } finally {
        setPending(false)
      }
    },
    [activeProfile.id, navigate, pending, queryClient, runtime],
  )

  const resume = useCallback(() => navigate({ to: '/session' }), [navigate])

  return { pending, resume, start }
}
