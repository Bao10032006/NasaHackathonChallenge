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
    <header>
      <h1>HỎA LỊCH</h1>
      <p role="note">{METRIC_NOTICE}</p>
      <nav aria-label="Màn hình">
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
      <fieldset>
        <legend>Nguồn dữ liệu cho giao diện</legend>
        <label>
          <input
            type="radio"
            name="data-source"
            checked={dataSource === 'mock'}
            onChange={() => dispatch({ type: 'setDataSource', dataSource: 'mock' })}
          />
          Dữ liệu mẫu (fixture từ backend {mockGeneratedFromCommit}, kịch bản demo Tây Nguyên)
        </label>
        <label>
          <input
            type="radio"
            name="data-source"
            checked={dataSource === 'api'}
            onChange={() => dispatch({ type: 'setDataSource', dataSource: 'api' })}
          />
          API thật (backend chạy ở cổng 8080)
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
