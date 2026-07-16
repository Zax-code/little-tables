import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'

export function StatsScreen() {
  const bootstrap = useLocalBootstrap()
  const data = bootstrap.data
  const facts = Object.values(data?.snapshot.facts ?? {})
  const fluent = facts.filter((fact) => fact.state === 'fluent').length
  const familiar = facts.filter((fact) => fact.state === 'familiar').length
  const growing = facts.filter((fact) => fact.state === 'learning').length

  return (
    <section className="stats-screen">
      <header>
        <p className="eyebrow">your progress</p>
        <h1>look what’s growing</h1>
        <p>There’s no score to beat—only your own little garden.</p>
      </header>
      <div className="stat-hero">
        <strong>{fluent}</strong>
        <span>facts fluent</span>
      </div>
      <div className="stat-grid">
        <div>
          <strong>{familiar}</strong>
          <span>familiar</span>
        </div>
        <div>
          <strong>{growing}</strong>
          <span>growing</span>
        </div>
        <div>
          <strong>{data?.completedSessions ?? 0}</strong>
          <span>tiny wins</span>
        </div>
        <div>
          <strong>{facts.length}</strong>
          <span>facts met</span>
        </div>
      </div>
      <div className="progress-note">
        <span aria-hidden="true">✿</span>
        <p>
          Correct but slower answers still count as learning. Fluency grows across separate days.
        </p>
      </div>
    </section>
  )
}
