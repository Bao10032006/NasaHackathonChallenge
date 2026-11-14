import type { SourceComposition } from '../api/types'
import { SOURCE_LABEL, formatDate, formatValue } from '../lib/format'
import { MONTH_NAMES, boundsLabel, periodLabel, selectionLabel } from '../lib/labels'
import { ORIGIN_BADGE, readableValue } from '../lib/scale'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { useAppState } from '../state/AppState'
import { useSnapshot } from '../state/Metadata'
import { calendarRequest, dailyRequest, dayCalendarRequest, mapRequest } from './requests'
import { Card, CoverageChip, ErrorNote, OriginBadge, ServedByBadge, UpdatingNote, WarningNotes } from './ui'

function SourceBars({ sources, total }: { sources: SourceComposition[]; total: number }) {
  return (
    <ul className="source-bars">
      {sources.map((source) => {
        const share = total > 0 ? source.harmonizedValue / total : 0
        return (
          <li key={source.sourceCode}>
            <div className="source-bar-label">
              <span>{SOURCE_LABEL[source.source]} · {ORIGIN_BADGE[source.origin].label}</span>
              <span>{readableValue(source.harmonizedValue)} snpp_eq</span>
            </div>
            <div className="bar" aria-hidden="true"><span style={{ width: `${Math.round(share * 100)}%` }} /></div>
            <div className="muted small">
              {source.cellCount} ô · {source.contributingCellDayCount} ô-ngày · {source.inputObservationCount} phát hiện đầu vào
              của vệ tinh (không phải snpp_eq) · {source.sourceInputValidCellCount} ô-ngày có đầu vào hợp lệ
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Selection + period summary. Totals and peaks always come from the API summary objects
 * (map summary, calendar summary.peakPeriod, day-calendar summary.peakDate, /daily composition).
 */
export function SummaryCard() {
  const state = useAppState()
  const { filters } = state
  const { areas } = useSnapshot()
  const map = useApi(mapRequest(state))
  const calendar = useApi(filters.timeMode === 'year' ? calendarRequest(state) : null)
  const days = useApi(filters.timeMode === 'month' ? dayCalendarRequest(state) : null)
  const daily = useApi(dailyRequest(state))
  const { data, stale } = currentOrPrevious(map)
  const areaList = areas.status === 'success' ? areas.data : null

  return (
    <Card
      id="summary"
      title="Tóm tắt"
      className="summary-card"
      aside={<>
        <UpdatingNote show={stale} what="tóm tắt" />
        {map.status === 'success' && <ServedByBadge servedBy={map.servedBy} />}
      </>}
    >
      {map.status === 'error' && <ErrorNote error={map.error} onRetry={map.retry} context="tóm tắt" />}
      {data && (
        <div className={stale ? 'is-stale' : ''}>
          <p className="eyebrow">{selectionLabel(data.selection, areaList)} · {data.selection.cellCount} ô</p>
          {data.selection.type === 'BOUNDING_BOX' && (
            <p className="muted small">Phạm vi thực tế: {boundsLabel(data.selection.selectedBounds)}</p>
          )}
          <p className="eyebrow">{periodLabel(filters)}</p>

          <div className="big-number">
            {data.summary.valueStatus === 'AVAILABLE' && data.summary.totalValue !== null ? (
              <>
                <span title={`Giá trị chính xác: ${formatValue(data.summary.totalValue)}`}>{readableValue(data.summary.totalValue)}</span>
                <span className="unit">snpp_eq</span>
              </>
            ) : (
              <span className="big-outside">— Ngoài phạm vi dữ liệu</span>
            )}
          </div>
          <p className="muted small">Số phát hiện tương đương S‑NPP, cộng trên các ô và các ngày của kỳ.</p>
          <div className="chips">
            <CoverageChip coverage={data.summary.coverage} />
            <OriginBadge origin={data.summary.origin} long />
          </div>
          {data.summary.totalValue === 0 && (
            <p className="note">Giá trị 0 là dữ liệu thật: không có phát hiện trong kỳ, không phải thiếu dữ liệu.</p>
          )}

          {filters.timeMode === 'year' && calendar.status === 'success' && calendar.data.summary.peakPeriod && (
            <p className="peak">
              ★ Tháng nổi bật: <strong>{MONTH_NAMES[calendar.data.summary.peakPeriod.period - 1]}</strong>
              {' '}({readableValue(calendar.data.summary.peakPeriod.value)} snpp_eq)
              {calendar.data.summary.coverage.partial && ' — trong khoảng đã có dữ liệu'}
            </p>
          )}
          {filters.timeMode === 'month' && days.status === 'success' && days.data.summary.peakDate && (
            <p className="peak">
              ★ Ngày nổi bật: <strong>{formatDate(days.data.summary.peakDate.date)}</strong>
              {' '}({readableValue(days.data.summary.peakDate.value)} snpp_eq)
              {days.data.summary.coverage.partial && ' — trong khoảng đã có dữ liệu'}
            </p>
          )}

          {filters.timeMode === 'date' && (
            <div className="daily-sources">
              <h3>Nguồn đóng góp của ngày</h3>
              {daily.status === 'loading' && <p className="muted" role="status">Đang tải nguồn của ngày…</p>}
              {daily.status === 'error' && <ErrorNote error={daily.error} onRetry={daily.retry} context="nguồn của ngày" />}
              {daily.status === 'success' && (
                <>
                  <SourceBars sources={daily.data.sourceComposition} total={daily.data.value} />
                  {daily.data.sourceComposition.some((source) => source.origin === 'MODEL_REDISTRIBUTED') && (
                    <p className="note">
                      Ngày này có giá trị ước lượng: tổng tháng của mô hình được phân bổ xuống từng ngày, nên giá trị có thể
                      dương dù vệ tinh không ghi nhận phát hiện nào trong ngày. Không có khoảng bất định cho giá trị theo ngày.
                    </p>
                  )}
                  <WarningNotes codes={daily.data.meta.warnings} title="Lưu ý về giá trị của ngày" />
                </>
              )}
            </div>
          )}
          <WarningNotes codes={data.meta.warnings} title="Lưu ý về kỳ và vùng" />
        </div>
      )}
      {!data && map.status === 'loading' && <p className="muted" role="status">Đang tải…</p>}
    </Card>
  )
}
