import { LearningEngine } from '@little-tables/domain'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { m } from 'motion/react'
import { useState } from 'react'

import { authStatusQueryKey, fetchAuthStatus } from '../auth-client.js'
import { Bunny } from '../components/bunny.js'
import { useFlowerTransition } from '../flower-transition.js'
import { InstallCard } from '../components/install-card.js'
import { LanguageToggle } from '../components/language-toggle.js'
import { OwnerAccessLink } from '../components/owner-access-link.js'
import { ReminderCard } from '../components/reminder-card.js'
import { syncStatusQueryKey, type SyncStatus } from '../sync-status.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { localBootstrapQueryKey, practiceStore } from '../store.js'
import { setSoundEnabled, soundEnabled } from '../sound.js'
import { launchPracticeSession, resumePracticeSession } from '../practice-session-launch.js'
import { useI18n } from '../i18n.js'

export function HomeScreen() {
  const { t } = useI18n()
  const auth = useQuery({
    queryKey: authStatusQueryKey,
    queryFn: () => fetchAuthStatus(),
    staleTime: 30_000,
  })
  const bootstrap = useLocalBootstrap()
  const syncStatus = useQuery<SyncStatus>({
    initialData: navigator.onLine ? 'syncing' : 'saved',
    queryKey: syncStatusQueryKey,
    queryFn: () => Promise.resolve(navigator.onLine ? 'synced' : 'saved'),
    staleTime: Infinity,
  })
  const navigate = useNavigate()
  const transition = useFlowerTransition()
  const queryClient = useQueryClient()
  const data = bootstrap.data
  const [showModes, setShowModes] = useState(false)
  const [sound, setSound] = useState(soundEnabled)
  const firstVisit = (data?.snapshot.processedEventIds.length ?? 0) === 0
  const displayName = auth.data?.displayName ?? 'léa'
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
  const petalCount = Math.min(5, data?.completedSessions ?? 0)

  const start = async (policy: Readonly<{ focusTable?: number; questionCount: number }>) => {
    const snapshot = data?.snapshot ?? LearningEngine.emptySnapshot()
    const session = LearningEngine.createSession({
      now: new Date(),
      policy,
      seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now(),
      snapshot,
    })
    await launchPracticeSession({
      invalidate: () => queryClient.invalidateQueries({ queryKey: localBootstrapQueryKey }),
      navigate: () => navigate({ to: '/practice' }),
      persist: () => practiceStore.startSession(session, snapshot),
      transition,
    })
  }
  const primaryAction = async () => {
    if (data?.activeSession !== null && data?.activeSession !== undefined) {
      await resumePracticeSession({
        navigate: () => navigate({ to: '/practice' }),
        transition,
      })
      return
    }
    await start({ questionCount: firstVisit ? 8 : 10 })
  }

  return (
    <section className="home-screen">
      <LanguageToggle />
      <button
        aria-label={sound ? t('home.soundOff') : t('home.soundOn')}
        className="sound-toggle"
        onClick={() => {
          const next = !sound
          setSound(next)
          setSoundEnabled(next)
        }}
        type="button"
      >
        {sound ? '♪' : '♩̸'}
      </button>
      <div className="home-hero">
        <div className="home-intro">
          <header className="welcome-copy">
            <p className="eyebrow">little tables.</p>
            <h1>
              {firstVisit
                ? t('home.firstVisitHeading', { name: displayName })
                : t('home.returningHeading', { name: displayName })}
            </h1>
            <p>{firstVisit ? t('home.firstVisitIntro') : t('home.ready')}</p>
          </header>

          <m.button
            className="primary-button"
            onClick={() => void primaryAction()}
            type="button"
            whileTap={{ scale: 0.97 }}
          >
            {data?.activeSession ? t('home.resume') : firstVisit ? t('home.start') : t('home.play')}
          </m.button>
          <button
            className="mode-link"
            disabled={data?.activeSession !== null && data?.activeSession !== undefined}
            onClick={() => setShowModes((visible) => !visible)}
            type="button"
          >
            {showModes ? t('home.hideModes') : t('home.mode')}
          </button>
          {showModes ? (
            <div className="mode-sheet">
              <button onClick={() => void start({ questionCount: 5 })} type="button">
                <strong>{t('home.fiveQuick')}</strong>
                <span>{t('home.lowEnergy')}</span>
              </button>
              <div className="table-picker">
                <strong>{t('home.focusTable')}</strong>
                <div>
                  {[2, 5, 10, 3, 4, 6, 7, 8, 9].map((table) => (
                    <button
                      key={table}
                      onClick={() => void start({ focusTable: table, questionCount: 10 })}
                      type="button"
                    >
                      {table}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <Bunny className="home-bunny" scene="home" />
      </div>

      <div className="home-dashboard">
        <div className="glow-card">
          <span className="flower-badge" aria-hidden="true">
            ✿
          </span>
          <div>
            <strong>{t(glow === 1 ? 'home.glowDay' : 'home.glowDays', { count: glow })}</strong>
            <div className="glow-track">
              <span style={{ width: `${(glow / 7) * 100}%` }} />
            </div>
          </div>
          <span className="sync-copy">{t(`sync.${syncStatus.data}`)}</span>
        </div>

        <div className="today-card">
          <div className="card-heading">
            <strong>{t('home.today')}</strong>
            <span>
              {t('garden.bloomCount', {
                bloom: t(garden.bloomCount === 1 ? 'common.bloom' : 'common.blooms'),
                count: garden.bloomCount,
              })}
            </span>
          </div>
          <div
            className="petal-row"
            aria-label={t(petalCount === 1 ? 'home.petal' : 'home.petals', { count: petalCount })}
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
        <ReminderCard />
        <InstallCard completedSessions={data?.completedSessions ?? 0} />
        <OwnerAccessLink isAdmin={auth.data?.isAdmin === true} />
      </div>
    </section>
  )
}
