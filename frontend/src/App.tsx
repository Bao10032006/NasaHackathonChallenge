import CompareScreen from './compare/CompareScreen'
import DataNotesScreen from './datanotes/DataNotesScreen'
import ExploreScreen from './explore/ExploreScreen'
import { mockGeneratedFromCommit } from './api/mock'
import { METRIC_NOTICE } from './lib/format'
import { AppStateProvider, useAppState, useDispatch, type Screen } from './state/AppState'
import { SnapshotProvider } from './state/Metadata'

const SCREENS: Array<[Screen, string]> = [
  ['explore', 'Khám phá'],
  ['compare', 'So sánh'],
  ['notes', 'Nguồn dữ liệu'],
]

function Header() {
  const { screen, dataSource } = useAppState()
  const dispatch = useDispatch()
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">🔥</span>
        <h1>HỎA <span>LỊCH</span></h1>
      </div>
      <p role="note" className="metric-note">{METRIC_NOTICE}</p>
      <nav aria-label="Màn hình" className="app-nav">
        {SCREENS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={screen === id ? 'page' : undefined}
            onClick={() => dispatch({ type: 'setScreen', screen: id })}
          >
            {label}
          </button>
        ))}
      </nav>
      <fieldset className="source-toggle">
        <legend>Nguồn dữ liệu:</legend>
        <label>
          <input
            type="radio"
            name="data-source"
            checked={dataSource === 'mock'}
            onChange={() => dispatch({ type: 'setDataSource', dataSource: 'mock' })}
          />
          <span title={`Fixture từ backend ${mockGeneratedFromCommit}`}>Dữ liệu mẫu</span>
        </label>
        <label>
          <input
            type="radio"
            name="data-source"
            checked={dataSource === 'api'}
            onChange={() => dispatch({ type: 'setDataSource', dataSource: 'api' })}
          />
          <span title="Backend Spring Boot ở cổng 8080 qua proxy /api">API thật</span>
        </label>
      </fieldset>
    </header>
  )
}

function CurrentScreen() {
  const { screen } = useAppState()
  switch (screen) {
    case 'explore':
      return <ExploreScreen />
    case 'compare':
      return <CompareScreen />
    case 'notes':
      return <DataNotesScreen />
  }
}

export default function App() {
  return (
    <AppStateProvider>
      <SnapshotProvider>
        <Header />
        <main>
          <CurrentScreen />
        </main>
      </SnapshotProvider>
    </AppStateProvider>
  )
}
