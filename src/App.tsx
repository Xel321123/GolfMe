/**
 * App — root shell: composes services and switches between the three views.
 */
import { useState } from 'react'
import { createAppServices } from './app/dependencies'
import { PlayPage } from './pages/PlayPage'
import { DashboardPage } from './pages/DashboardPage'
import { HistoryPage } from './pages/HistoryPage'
import './App.css'

type View = 'play' | 'dashboard' | 'history'

const VIEW_LABELS: Array<{ key: View; label: string }> = [
  { key: 'play', label: '⛳ Play' },
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'history', label: '🗂 History' },
]

export default function App() {
  const [services] = useState(() => createAppServices())
  const [view, setView] = useState<View>('play')

  if (services === null) {
    return (
      <main className="gm-app">
        <h1>GolfMe</h1>
        <p style={{ color: 'var(--danger)' }}>
          Storage is unavailable in this browser (private mode or blocked
          storage). Enable storage to use GolfMe.
        </p>
      </main>
    )
  }

  return (
    <main className="gm-app">
      <header className="gm-app__header">
        <h1>GolfMe</h1>
        <nav className="gm-app__nav" aria-label="Main navigation">
          {VIEW_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={view === key ? 'gm-app__tab gm-app__tab--active' : 'gm-app__tab'}
              onClick={() => setView(key)}
              aria-current={view === key ? 'page' : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {view === 'play' && <PlayPage lifecycle={services.lifecycle} geolocation={services.geolocation} />}
      {view === 'dashboard' && <DashboardPage persistence={services.persistence} />}
      {view === 'history' && <HistoryPage persistence={services.persistence} />}
    </main>
  )
}
