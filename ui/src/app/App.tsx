import { useEffect, useState } from 'react'
import { checkApiHealth } from '../lib/api'

type ApiStatus = 'checking' | 'online' | 'offline'

const statusLabels: Record<ApiStatus, string> = {
  checking: 'Connecting to API…',
  online: 'API is online',
  offline: 'API is unavailable. Check that the backend is running.',
}

export function App() {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(10_000),
    ])
    checkApiHealth(signal)
      .then(() => {
        if (!controller.signal.aborted) setStatus('online')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('offline')
      })
    return () => controller.abort()
  }, [])

  return (
    <main>
      <header>
        <span className="wordmark">Agentra</span>
        <span>Development workspace</span>
      </header>
      <section aria-labelledby="title">
        <p className="eyebrow">Dealer Management System</p>
        <h1 id="title">Ready to build.</h1>
        <p className="intro">
          Your workspace for dealer operations, inventory, and payments.
        </p>
        <p className={`status status--${status}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {statusLabels[status]}
        </p>
        <a href="/api/docs" target="_blank" rel="noreferrer">
          Explore the API documentation <span aria-hidden="true">↗</span>
        </a>
      </section>
      <footer>React + TypeScript / FastAPI / Supabase Postgres</footer>
    </main>
  )
}
