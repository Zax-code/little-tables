import { LearningEngine } from '@little-tables/domain'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { Bunny } from '../components/bunny.js'
import { Screen } from '../components/screen.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'

export function CelebrationScreen() {
  const bootstrap = useLocalBootstrap()
  const navigate = useNavigate()
  const data = bootstrap.data
  const rewards = data === undefined ? [] : LearningEngine.deriveRewards(data)
  const latest = rewards.at(-1)

  return (
    <Screen footer={false}>
      <section className="celebration-screen">
        <div className="confetti" aria-hidden="true">
          <i>✿</i>
          <i>♡</i>
          <i>✿</i>
          <i>♡</i>
        </div>
        <div>
          <p className="eyebrow">tiny win complete</p>
          <h1>you did it ♡</h1>
          <p>your garden grew a little today.</p>
        </div>
        <Bunny className="celebration-bunny" scene="celebration" />
        <motion.div className="reward-chip" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
          <span aria-hidden="true">🌷</span> +1 {latest?.label ?? 'tulip'}
        </motion.div>
        <div className="celebration-actions">
          <button className="primary-button" onClick={() => void navigate({ to: '/garden' })}>
            visit garden
          </button>
          <button className="text-button" onClick={() => void navigate({ to: '/' })}>
            back home
          </button>
        </div>
      </section>
    </Screen>
  )
}
