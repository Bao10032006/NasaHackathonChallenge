import { useEffect, useState } from 'react'
import { useAppState, useDispatch } from '../state/AppState'
import { CellDetailsDrawer } from './CellDetailsDrawer'
import { DataGuideDrawer } from './DataGuideDrawer'
import { DayCalendarGrid } from './DayCalendarGrid'
import { ExploreMap } from './ExploreMap'
import { FilterBar } from './FilterBar'
import { HistoryPanel } from './HistoryPanel'
import { PeriodChart } from './PeriodChart'
import { SummaryCard } from './SummaryCard'

/**
 * Explore: one shared filter state drives every panel.
 * Flow: national → pick or draw an area → yearly map + 12-month chart → month → day calendar →
 * date → cell sources → same-period history.
 * At most one drawer is open: the cell details (driven by the selected cell) or the data guide.
 */
export default function ExploreScreen() {
  const { filters } = useAppState()
  const dispatch = useDispatch()
  const [guideOpen, setGuideOpen] = useState(false)
  // Map drawing mode is shared so the filter bar's "Vẽ lại" can start it.
  const [drawing, setDrawing] = useState(false)

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

  return (
    <div className="explore" data-screen="explore">
      <h1 className="visually-hidden">Khám phá hoạt động cháy</h1>
      <FilterBar onOpenGuide={openGuide} onStartDraw={() => setDrawing(true)} />
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
