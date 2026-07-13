import { LearningEngine } from '@little-tables/domain'

import { Bunny } from '../components/bunny.js'
import { Screen } from '../components/screen.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'

export function GardenScreen() {
  const bootstrap = useLocalBootstrap()
  const data = bootstrap.data
  const rewards = data === undefined ? [] : LearningEngine.deriveRewards(data)

  return (
    <Screen>
      <section className="garden-screen">
        <header className="garden-heading">
          <p className="eyebrow">your little garden</p>
          <h1>{rewards.length} blooms</h1>
          <p>everything here stays yours.</p>
        </header>
        <div className="garden-scene">
          <Bunny className="garden-bunny" scene="garden" />
        </div>
        <div className="garden-reward-list" aria-label="Unlocked garden collection">
          {rewards.map((reward, index) => (
            <span key={reward.id}>
              {index % 2 === 0 ? '🌷' : '🌼'} {reward.label}
            </span>
          ))}
          {rewards.length === 0 ? <span>one tiny win grows the first tulip</span> : null}
        </div>
        <div className="tomorrow-card">
          <span aria-hidden="true">🌱</span>
          <div>
            <strong>next</strong>
            <p>
              {data?.completedSessions === 0
                ? 'finish your first tiny win'
                : 'another flower is waiting to grow'}
            </p>
          </div>
        </div>
      </section>
    </Screen>
  )
}
