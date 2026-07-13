import { LearningEngine } from '@little-tables/domain'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { useState } from 'react'

import { Bunny } from '../components/bunny.js'
import { InstallCard } from '../components/install-card.js'
import { syncStatusQueryKey } from '../components/sync-manager.js'
import { Screen } from '../components/screen.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { localBootstrapQueryKey, practiceStore } from '../store.js'
import { setSoundEnabled, soundEnabled } from '../sound.js'

export function HomeScreen() {
  const bootstrap = useLocalBootstrap()
  const syncStatus = useQuery({
    initialData: navigator.onLine ? 'syncing' : 'saved on this phone',
    queryKey: syncStatusQueryKey,
    queryFn: () => Promise.resolve(navigator.onLine ? 'synced' : 'saved on this phone'),
    staleTime: Infinity,
  })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const data = bootstrap.data
  const [showModes, setShowModes] = useState(false)
  const [sound, setSound] = useState(soundEnabled)
  const firstVisit = (data?.snapshot.processedEventIds.length ?? 0) === 0
  const garden = LearningEngine.deriveGardenProgress({
    completedSessions: data?.completedSessions ?? 0,
    snapshot: data?.snapshot ?? LearningEngine.emptySnapshot(),
  })
  const today = new Date()
  const recentDayKeys = new Set(
    Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(today)
      day.setDate(day.getDate() - offset)
      return day.toISOString().slice(0, 10)
    }),
  )
  const glow = data?.practiceDayKeys.filter((day) => recentDayKeys.has(day)).length ?? 0

  const start = async (policy: Readonly<{ focusTable?: number; questionCount: number }>) => {
    const snapshot = data?.snapshot ?? LearningEngine.emptySnapshot()
    const session = LearningEngine.createSession({
      now: new Date(),
      policy,
      seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now(),
      snapshot,
    })
    await practiceStore.startSession(session, snapshot)
    await queryClient.invalidateQueries({ queryKey: localBootstrapQueryKey })
    await navigate({ to: '/practice' })
  }
  const primaryAction = async () => {
    if (data?.activeSession !== null && data?.activeSession !== undefined) {
      await navigate({ to: '/practice' })
      return
    }
    await start({ questionCount: firstVisit ? 8 : 10 })
  }

  return (
    <Screen>
      <section className="home-screen">
        <button
          aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
          className="sound-toggle"
          onClick={() => {
            const next = !sound
            setSound(next)
            setSoundEnabled(next)
          }}
        >
          {sound ? '♪' : '♩̸'}
        </button>
        <header className="welcome-copy">
          <p className="eyebrow">little tables.</p>
          <h1>{firstVisit ? 'a tiny hello ♡' : 'good morning, lou ♡'}</h1>
          <p>{firstVisit ? 'let’s find your easiest starting place.' : 'ready for a tiny win?'}</p>
        </header>

        <motion.button
          className="primary-button"
          onClick={() => void primaryAction()}
          whileTap={{ scale: 0.97 }}
        >
          {data?.activeSession
            ? 'resume your tiny win'
            : firstVisit
              ? 'start a gentle check-in'
              : 'play 90 sec'}
        </motion.button>
        <button
          className="mode-link"
          disabled={data?.activeSession !== null && data?.activeSession !== undefined}
          onClick={() => setShowModes((visible) => !visible)}
        >
          {showModes ? 'hide practice choices' : 'choose a tiny mode'}
        </button>
        {showModes ? (
          <div className="mode-sheet">
            <button onClick={() => void start({ questionCount: 5 })}>
              <strong>five quick</strong>
              <span>for a low-energy day</span>
            </button>
            <div className="table-picker">
              <strong>focus a table</strong>
              <div>
                {[2, 5, 10, 3, 4, 6, 7, 8, 9].map((table) => (
                  <button
                    key={table}
                    onClick={() => void start({ focusTable: table, questionCount: 10 })}
                  >
                    {table}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="glow-card">
          <span className="flower-badge" aria-hidden="true">
            ✿
          </span>
          <div>
            <strong>{glow} day glow</strong>
            <div className="glow-track">
              <span style={{ width: `${(glow / 7) * 100}%` }} />
            </div>
          </div>
          <span className="sync-copy">{syncStatus.data}</span>
        </div>

        <Bunny className="home-bunny" scene="home" />

        <div className="today-card">
          <div className="card-heading">
            <strong>today</strong>
            <span>
              {garden.bloomCount} {garden.bloomCount === 1 ? 'bloom' : 'blooms'}
            </span>
          </div>
          <div
            className="petal-row"
            aria-label={`${Math.min(5, data?.completedSessions ?? 0)} of 5 petals`}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <span
                className={
                  index < Math.min(5, data?.completedSessions ?? 0) ? 'petal petal-filled' : 'petal'
                }
                key={index}
              >
                ✿
              </span>
            ))}
          </div>
        </div>
        <InstallCard completedSessions={data?.completedSessions ?? 0} />
      </section>
    </Screen>
  )
}
