import { useEffect, useRef, useState } from 'react'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { useAppState, useDispatch, type SpatialFilter } from '../state/AppState'
import { CellDetailsDrawer } from './CellDetailsDrawer'
import { DataGuideDrawer } from './DataGuideDrawer'
import { DayCalendarGrid } from './DayCalendarGrid'
import { ExploreMap } from './ExploreMap'
import { FilterBar } from './FilterBar'
import { HistoryPanel } from './HistoryPanel'
import { PeriodChart } from './PeriodChart'
import { mapRequest } from './requests'
import { SummaryCard } from './SummaryCard'

const sameSpatial = (a: SpatialFilter, b: SpatialFilter) => JSON.stringify(a) === JSON.stringify(b)
const MAX_AREA_HISTORY = 10

/**
 * Explore: one shared filter state drives every panel.
 * Flow: national → pick or draw an area → yearly map + 12-month chart → month → day calendar →
 * date → cell sources → same-period history.
 * At most one drawer is open: the cell details (driven by the selected cell) or the data guide.
 */
export default function ExploreScreen() {
  const state = useAppState()
  const { filters } = state
  const dispatch = useDispatch()
  const [guideOpen, setGuideOpen] = useState(false)
  // Map drawing mode is shared: the filter row starts/cancels it, the map runs it.
  const [drawing, setDrawing] = useState(false)
  // Same request as the map (cached), so the selection line shows the cells actually counted.
  const map = currentOrPrevious(useApi(mapRequest(state)))
  // "Vùng trước": the areas visited before the current one.
  const [areaHistory, setAreaHistory] = useState<SpatialFilter[]>([])
  const previousSpatial = useRef(filters.spatial)
  const goingBack = useRef(false)

  useEffect(() => {
    const previous = previousSpatial.current
    previousSpatial.current = filters.spatial
    if (goingBack.current) {
      goingBack.current = false
      return
    }
    if (!sameSpatial(previous, filters.spatial)) {
      setAreaHistory((history) => [...history, previous].slice(-MAX_AREA_HISTORY))
    }
  }, [filters.spatial])

  useEffect(() => {
    if (filters.selectedCellId !== null) {
      setGuideOpen(false)
    }
  }, [filters.selectedCellId])

  function openGuide() {
    if (filters.selectedCellId !== null) {
      dispatch({ type: 'selectCell', cellId: null })
    }
    setGuideOpen(true)
  }

  function back() {
    const previous = areaHistory.at(-1)
    if (!previous) {
      return
    }
    goingBack.current = true
    setAreaHistory((history) => history.slice(0, -1))
    setDrawing(false)
    dispatch({ type: 'setSpatial', spatial: previous })
  }

  return (
    <div className="explore" data-screen="explore">
      <h1 className="visually-hidden">Khám phá hoạt động cháy</h1>
      <FilterBar
        onOpenGuide={openGuide}
        drawing={drawing}
        onDrawingChange={setDrawing}
        selection={map.data?.selection}
        onBack={areaHistory.length > 0 ? back : undefined}
      />
      <div className="explore-grid">
        <div className="area-map"><ExploreMap drawing={drawing} onDrawingChange={setDrawing} /></div>
        <div className="area-summary"><SummaryCard /></div>
        <div className="area-calendar"><DayCalendarGrid /></div>
        <div className="area-chart"><PeriodChart /></div>
        <div className="area-history"><HistoryPanel /></div>
      </div>
      <CellDetailsDrawer />
      <DataGuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
