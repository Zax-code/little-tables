import { Ce2Engine, LearningEngine } from '@little-tables/domain'
import { useQuery } from '@tanstack/react-query'
import { m } from 'motion/react'
import { useState } from 'react'

import { authStatusQueryKey, fetchAuthStatus } from '../auth-client.js'
import { CharacterIllustration } from '../components/character-illustration.js'
import { GardenIntroductionCard } from '../components/garden-introduction-card.js'
import { InstallCard } from '../components/install-card.js'
import { LanguageToggle } from '../components/language-toggle.js'
import { OwnerAccessLink } from '../components/owner-access-link.js'
import { ReminderCard } from '../components/reminder-card.js'
import { syncStatusQueryKey, type SyncStatus } from '../sync-status.js'
import { practiceStoreFor } from '../store.js'
import { deriveDailyPracticeView } from '../daily-practice-view-model.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { usePracticeLauncher } from '../hooks/use-practice-launcher.js'
import { setSoundEnabled, soundEnabled } from '../sound.js'
import { useI18n } from '../i18n.js'
import { deriveWeekProgressSegments } from '../week-progress.js'
import { useFamilyProfile } from '../use-family-profile.js'
import { ActivityPicker } from '../components/activity-picker.js'
import { nextDailyFamily } from '../daily-activity.js'

export function HomeScreen() {
  const { t } = useI18n()
  const { activeProfile } = useFamilyProfile()
  const practiceStore = practiceStoreFor(activeProfile.id)
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
  const data = bootstrap.data
  const activeSession = data?.activeSession ?? data?.ce2ActiveSession ?? null
  const launcher = usePracticeLauncher(data)
  const [showModes, setShowModes] = useState(false)
  const [sound, setSound] = useState(soundEnabled)
  const [gardenIntroductionDismissed, setGardenIntroductionDismissed] = useState(false)
  const firstVisit = (data?.snapshot.processedEventIds.length ?? 0) === 0
  const displayName = activeProfile.name
  const garden = LearningEngine.deriveGardenProgress({
    awardedFlowerIds: data?.gardenCollection.awardedFlowerIds,
    completedSessions: data?.gardenBloomCount ?? 0,
    flowerOrder: data?.gardenCollection.flowerOrder,
    snapshot: data?.snapshot ?? LearningEngine.emptySnapshot(),
  })
  const today = new Date()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const todayKey = LearningEngine.learningDayKey({ at: today, timeZone })
  const dailyView = deriveDailyPracticeView({
    activeSession:
      activeSession === null
        ? null
        : {
            currentIndex: activeSession.currentIndex,
            kind: activeSession.kind === 'daily-watering' ? 'daily-watering' : 'extra-practice',
            questionCount: activeSession.questions.length,
          },
    practiceDayKeys: data?.practiceDayKeys ?? [],
    rewardedDayKeys: data?.rewardedDayKeys ?? [],
    todayKey,
  })
  const dailyFamily = data === undefined ? 'tables' : nextDailyFamily(data.ce2Preferences)
  const ce2Daily = dailyFamily !== 'tables' && data?.ce2ContentVersion != null
  const dailyQuestionCount =
    activeSession?.kind === 'daily-watering'
      ? activeSession.questions.length
      : ce2Daily
        ? Ce2Engine.createSession({
            kind: 'daily-watering',
            module: dailyFamily,
            now: today,
            seed: 0,
            snapshot: { ...data.ce2Snapshot, enabledModules: data.ce2Preferences.enabledModules },
            timeZone,
          }).questions.length
        : LearningEngine.createSession({
            now: today,
            policy: { kind: 'daily-watering' },
            seed: 0,
            snapshot: data?.snapshot ?? LearningEngine.emptySnapshot(),
            timeZone,
          }).questions.length
  const wateringMinutes = ce2Daily ? 3 : Math.max(1, Math.ceil(dailyQuestionCount / 5))
  const primaryAction = async () => {
    if (activeSession !== null) {
      await launcher.resume()
      return
    }
    if (dailyView.dailyWateringDone) {
      await launcher.startQuick()
      return
    }
    await launcher.startDaily()
  }
  const primaryCopy =
    activeSession !== null
      ? activeSession.kind === 'daily-watering'
        ? t('watering.resume')
        : t('home.resume')
      : dailyView.dailyWateringDone
        ? t('watering.extra')
        : t('watering.start')
  const welcomeHeading =
    dailyView.comeback === 'none'
      ? firstVisit
        ? t('home.firstVisitHeading', { name: displayName })
        : t('home.returningHeading', { name: displayName })
      : t('comeback.heading', { name: displayName })
  const welcomeCopy =
    dailyView.comeback === 'long'
      ? t('comeback.long')
      : dailyView.comeback === 'short'
        ? t('comeback.short')
        : firstVisit
          ? t('home.firstVisitIntro')
          : dailyView.dailyWateringDone
            ? t('watering.doneCopy')
            : t('home.ready')
  const showGardenIntroduction =
    data !== undefined &&
    firstVisit &&
    !data.gardenCollection.introductionSeen &&
    !gardenIntroductionDismissed
  const dismissGardenIntroduction = () => {
    setGardenIntroductionDismissed(true)
    void practiceStore
      .markGardenIntroductionSeen()
      .then(async () => {
        if (!navigator.onLine) return
        const response = await fetch('/api/v1/garden/introduction-seen', {
          headers: { 'x-little-tables-profile-id': activeProfile.id },
          method: 'POST',
        })
        if (!response.ok) throw new Error('Garden introduction state was not saved')
      })
      .catch(() => undefined)
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
            <h1>{welcomeHeading}</h1>
            <p>{welcomeCopy}</p>
          </header>
          {showGardenIntroduction ? (
            <GardenIntroductionCard onDismiss={dismissGardenIntroduction} />
          ) : null}

          <m.button
            className="primary-button"
            onClick={() => void primaryAction()}
            type="button"
            whileTap={{ scale: 0.97 }}
          >
            {primaryCopy}
          </m.button>
          <button
            className="mode-link"
            disabled={activeSession !== null}
            onClick={() => setShowModes((visible) => !visible)}
            type="button"
          >
            {showModes ? t('home.hideModes') : t('ce2.activities')}
          </button>
          {showModes ? (
            <div className="mode-sheet">
              <button onClick={() => void launcher.startQuick()} type="button">
                <strong>{t('home.fiveQuick')}</strong>
                <span>{t('home.lowEnergy')}</span>
              </button>
              <div className="table-picker">
                <strong>{t('home.focusTable')}</strong>
                <div>
                  {[2, 5, 10, 3, 4, 6, 7, 8, 9].map((table) => (
                    <button
                      key={table}
                      onClick={() => void launcher.startTable(table)}
                      type="button"
                    >
                      {table}
                    </button>
                  ))}
                </div>
              </div>
              <ActivityPicker
                available={data?.ce2ContentVersion != null}
                busy={activeSession !== null}
                onStart={(module, skill) => void launcher.startCe2(module, skill)}
              />
            </div>
          ) : null}
        </div>
        <CharacterIllustration className="home-bunny" scene="home" />
      </div>

      <div className="home-dashboard">
        <div className="glow-card weekly-card">
          <span className="flower-badge" aria-hidden="true">
            ✿
          </span>
          <div>
            <strong>{t('week.heading')}</strong>
            <span className="weekly-count">
              {t(dailyView.weeklyPracticeDays === 1 ? 'week.countOne' : 'week.countMany', {
                count: dailyView.weeklyPracticeDays,
              })}
            </span>
            <div aria-hidden="true" className="week-day-row">
              {deriveWeekProgressSegments(dailyView.weeklyPracticeDays).map((practiced, index) => (
                <i className={practiced ? 'week-day week-day-practiced' : 'week-day'} key={index} />
              ))}
            </div>
            <small>
              {dailyView.visitsUntilBloomingWeek === 0
                ? t('week.complete')
                : t(dailyView.visitsUntilBloomingWeek === 1 ? 'week.oneToGo' : 'week.manyToGo', {
                    count: dailyView.visitsUntilBloomingWeek,
                  })}
            </small>
            <small className="week-explainer">{t('week.explainer')}</small>
          </div>
          <span className="sync-copy">{t(`sync.${syncStatus.data}`)}</span>
        </div>

        <div className="today-card watering-card">
          <div className="card-heading">
            <strong>{t('watering.heading')}</strong>
            <span>
              {t('garden.bloomCount', {
                bloom: t(garden.bloomCount === 1 ? 'common.bloom' : 'common.blooms'),
                count: garden.bloomCount,
              })}
            </span>
          </div>
          <div
            className="petal-row"
            aria-label={t(dailyView.petalCount === 1 ? 'home.petal' : 'home.petals', {
              count: dailyView.petalCount,
            })}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <span
                className={index < dailyView.petalCount ? 'petal petal-filled' : 'petal'}
                key={index}
              >
                ✿
              </span>
            ))}
          </div>
          <p>
            {dailyView.dailyWateringDone
              ? t('watering.done')
              : t(
                  ce2Daily
                    ? 'ce2.dailyEstimate'
                    : dailyQuestionCount === 1
                      ? 'watering.dueOne'
                      : 'watering.dueMany',
                  {
                    count: dailyQuestionCount,
                    minutes: wateringMinutes,
                  },
                )}
          </p>
          <small>
            {t(dailyView.dailyWateringDone ? 'watering.rewardEarned' : 'watering.rewardReady')}
          </small>
        </div>
        <ReminderCard />
        <InstallCard completedSessions={data?.completedSessions ?? 0} />
        <OwnerAccessLink isAdmin={auth.data?.isAdmin === true} />
      </div>
    </section>
  )
}
