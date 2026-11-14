import { ActivityCalendars } from './ActivityCalendars'
import { DataNotes, GridCellDetails } from './DataPanels'
import { ExploreFilters } from './ExploreFilters'
import { FireGridMap } from './FireGridMap'
import { HistoricalAnalysis } from './HistoricalAnalysis'
import { PeriodSummary } from './PeriodSummary'

export default function ExploreScreen() {
  return (
    <main>
      <header>
        <h1>Khám phá</h1>
        <p>
          <strong>Số phát hiện tương đương S-NPP</strong> là chỉ số hoạt động đốt
          ban ngày được quy về thang đo của cảm biến VIIRS trên Suomi NPP.
          Chỉ số này không phải số vụ cháy.
        </p>
      </header>

      <ExploreFilters />
      <div role="status" />
      <PeriodSummary />
      <FireGridMap />
      <ActivityCalendars />
      <HistoricalAnalysis />
      <GridCellDetails />
      <DataNotes />
    </main>
  )
}
