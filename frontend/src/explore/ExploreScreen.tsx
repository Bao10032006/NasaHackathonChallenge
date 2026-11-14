import { useState } from 'react'
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
 */
export default function ExploreScreen() {
  const [guideOpen, setGuideOpen] = useState(false)
  return (
    <div className="explore" data-screen="explore">
      <FilterBar onOpenGuide={() => setGuideOpen(true)} />
      <div className="explore-grid">
        <div className="area-map"><ExploreMap /></div>
        <div className="area-summary"><SummaryCard /></div>
        <div className="area-chart"><PeriodChart /></div>
        <div className="area-calendar"><DayCalendarGrid /></div>
        <div className="area-history"><HistoryPanel /></div>
      </div>
      <CellDetailsDrawer />
      <DataGuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
