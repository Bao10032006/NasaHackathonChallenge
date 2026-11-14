import { DayCalendar, PeriodCalendar } from './ActivityCalendars'
import { CellPeriodDetails } from './CellPeriodDetails'
import { ExploreFilters } from './ExploreFilters'
import { FireGridMap } from './FireGridMap'
import { HistoricalAnalysis } from './HistoricalAnalysis'
import { PeriodSummary, SelectionStatus } from './PeriodSummary'

/**
 * Explore in the wireframe v0.4 mobile order: filters → selection/coverage → summary → map →
 * 12-month/73-pentad calendar → day calendar → historical analysis → cell details.
 * Data Notes is its own screen (one click away in the header).
 */
export default function ExploreScreen() {
  return (
    <div className="explore" data-screen="explore">
      <ExploreFilters />
      <SelectionStatus />
      <PeriodSummary />
      <FireGridMap />
      <PeriodCalendar />
      <DayCalendar />
      <HistoricalAnalysis />
      <CellPeriodDetails />
    </div>
  )
}
