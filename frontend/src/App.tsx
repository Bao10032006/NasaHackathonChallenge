import { MotionConfig, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { mockGeneratedFromCommit } from './api/mock'
import CompareScreen from './compare/CompareScreen'
import { Icon } from './components/Icon'
import { SegmentedControl } from './components/SegmentedControl'
import DataNotesScreen from './datanotes/DataNotesScreen'
import ExploreScreen from './explore/ExploreScreen'
import { METRIC_NOTICE, formatDate } from './lib/format'
import { AppStateProvider, useAppState, useDispatch, type Screen } from './state/AppState'
import { SnapshotProvider, useMetadata, useSnapshot } from './state/Metadata'

const SCREENS: Array<[Screen, string]> = [
  ['explore', 'Khám phá'],
  ['compare', 'So sánh'],
  ['notes', 'Nguồn dữ liệu'],
]

const SOURCE_OPTIONS = [
  { value: 'mock', label: 'Dữ liệu mẫu' },
  { value: 'api', label: 'API thật' },
] as const

function DataStatus() {
  const { dataSource } = useAppState()
  const dispatch = useDispatch()
  const metadata = useMetadata()
  const { metadata: metadataState } = useSnapshot()
  return (
    <div className="data-status">
      <SegmentedControl
        label="Nguồn dữ liệu"
        size="small"
        options={SOURCE_OPTIONS}
        value={dataSource}
        onChange={(value) => dispatch({ type: 'setDataSource', dataSource: value })}
      />
      <p className="data-status-text" role="status" aria-live="polite">
        {metadataState.status === 'loading' && <><span className="spinner" aria-hidden="true" />Đang kết nối…</>}
        {metadataState.status === 'error' && <span className="text-error">Không tải được metadata ({metadataState.error.code ?? metadataState.error.kind})</span>}
        {metadata && (
          <span title={dataSource === 'mock' ? `Fixture tạo từ backend ${mockGeneratedFromCommit}` : 'Backend Spring Boot qua proxy /api'}>
            Dữ liệu đến <strong className="num">{formatDate(metadata.meta.dataThrough)}</strong>
            <span className="muted"> · {metadata.meta.dataVersion}</span>
          </span>
        )}
      </p>
    </div>
  )
}

function Header() {
  const { screen } = useAppState()
  const dispatch = useDispatch()
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><Icon name="flame" size={18} /></span>
        <span className="brand-name">Hỏa Lịch</span>
      </div>
      <nav aria-label="Màn hình" className="app-nav">
        {SCREENS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={screen === id ? 'page' : undefined}
            onClick={() => dispatch({ type: 'setScreen', screen: id })}
          >
            {screen === id && (
              <motion.span layoutId="nav-indicator" className="nav-indicator" transition={{ duration: 0.18, ease: 'easeOut' }} />
            )}
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
      <DataStatus />
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

/** Moves focus to the main region when the screen changes (not on first load). */
function Main() {
  const { screen } = useAppState()
  const mainRef = useRef<HTMLElement | null>(null)
  const firstRef = useRef(true)
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    mainRef.current?.focus()
  }, [screen])
  return (
    <main id="main" ref={mainRef} tabIndex={-1}>
      <p className="metric-banner" role="note"><Icon name="info" size={16} />{METRIC_NOTICE}</p>
      <CurrentScreen />
    </main>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppStateProvider>
        <SnapshotProvider>
          <a className="skip-link" href="#main">Bỏ qua đến nội dung chính</a>
          <Header />
          <Main />
        </SnapshotProvider>
      </AppStateProvider>
    </MotionConfig>
  )
}
