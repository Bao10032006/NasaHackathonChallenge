import { useEffect, useRef } from 'react'
import { SOURCE_LABEL, formatValue } from '../lib/format'
import { boundsLabel, selectorLabel } from '../lib/labels'
import { ORIGIN_BADGE, readableValue } from '../lib/scale'
import { useApi } from '../lib/useApi'
import { useAppState, useDispatch } from '../state/AppState'
import { cellDetailsRequest } from './requests'
import { CoverageChip, ErrorNote, OriginBadge, ServedByBadge, WarningNotes } from './ui'

const ORIGIN_EXPLANATION = {
  DIRECT_OBSERVATION: 'Đếm trực tiếp số phát hiện ban ngày của VIIRS S‑NPP trong ô (đã lọc nguồn nhiệt cố định).',
  SCALED_OBSERVATION: 'Phát hiện của VIIRS NOAA‑20 được quy đổi về thang S‑NPP (chia hệ số ≈ 1,0106) khi S‑NPP thiếu.',
  MODEL_REDISTRIBUTED: 'Ước lượng: mô hình hài hòa tính tổng tháng từ MODIS rồi phân bổ xuống từng ngày; không phải số đếm của ngày đó.',
  MIXED: 'Kỳ có nhiều loại đóng góp khác nhau; xem từng nguồn bên dưới.',
} as const

/** On-demand provenance of exactly the clicked cell for exactly the current period. */
export function CellDetailsDrawer() {
  const state = useAppState()
  const dispatch = useDispatch()
  const cellId = state.filters.selectedCellId
  const details = useApi(cellDetailsRequest(state))
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (cellId) {
      closeRef.current?.focus()
    }
  }, [cellId])

  if (!cellId) {
    return null
  }
  const close = () => dispatch({ type: 'selectCell', cellId: null })

  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-labelledby="cell-title" onKeyDown={(event) => event.key === 'Escape' && close()}>
      <div className="drawer-head">
        <h2 id="cell-title">Ô lưới {cellId}</h2>
        <button ref={closeRef} type="button" className="button" onClick={close} aria-label="Đóng chi tiết ô">✕</button>
      </div>
      {details.status === 'loading' && <p className="muted" role="status">Đang tải chi tiết nguồn của ô…</p>}
      {details.status === 'error' && <ErrorNote error={details.error} onRetry={details.retry} context="chi tiết ô" />}
      {details.status === 'success' && (() => {
        const data = details.data
        const isDate = data.temporalSelector.type === 'DATE'
        return (
          <div className="drawer-body">
            <ServedByBadge servedBy={details.servedBy} />
            <p className="eyebrow">{selectorLabel(data.temporalSelector)}</p>
            <p className="muted small">
              {data.cell.diagnosticRegion && <>Vùng phân tích {data.cell.diagnosticRegion} · </>}
              Tâm ô {data.cell.center?.lat}°B, {data.cell.center?.lon}°Đ
              {data.cell.bounds && <> · biên {boundsLabel(data.cell.bounds)}</>}
            </p>
            <div className="big-number">
              {data.valueStatus === 'AVAILABLE' && data.value !== null ? (
                <>
                  <span title={`Giá trị chính xác: ${formatValue(data.value)}`}>{readableValue(data.value)}</span>
                  <span className="unit">snpp_eq</span>
                </>
              ) : (
                <span className="big-outside">— Ngoài phạm vi dữ liệu</span>
              )}
            </div>
            <div className="chips">
              <CoverageChip coverage={data.temporalSelector.coverage} />
              <OriginBadge origin={data.origin} long />
            </div>
            {data.value === 0 && <p className="note">0 là giá trị thật: không có phát hiện trong ô ở kỳ này.</p>}
            {data.origin && <p>{ORIGIN_EXPLANATION[data.origin]}</p>}
            {isDate && data.origin === 'MODEL_REDISTRIBUTED' && (
              <p className="note">
                Giá trị ngày này là ước lượng, không phải số phát hiện quan sát trong ngày. Không có khoảng bất định cho giá trị
                theo ngày; độ tin cậy được kiểm định chủ yếu ở cấp tháng và kỳ 5 ngày.
              </p>
            )}

            <h3>Nguồn vệ tinh đóng góp</h3>
            {data.sourceComposition.length === 0 && <p className="muted">Không có nguồn đóng góp (ngoài phạm vi dữ liệu).</p>}
            <ul className="source-list">
              {data.sourceComposition.map((source) => (
                <li key={source.sourceCode}>
                  <div className="source-bar-label">
                    <strong>{SOURCE_LABEL[source.source]}</strong>
                    <span>{readableValue(source.harmonizedValue)} snpp_eq</span>
                  </div>
                  <div className="muted small">
                    {ORIGIN_BADGE[source.origin].label} · {source.contributingCellDayCount} ngày dùng nguồn này ·
                    {' '}{source.inputObservationCount} phát hiện đầu vào của vệ tinh (không phải snpp_eq) ·
                    {' '}{source.sourceInputValidCellCount} ngày có đầu vào hợp lệ
                  </div>
                </li>
              ))}
            </ul>
            <p className="muted small">Hỏa Lịch không cung cấp tọa độ hay thời điểm của từng điểm cháy; mọi giá trị là tổng theo ô.</p>
            <WarningNotes codes={data.meta.warnings} />
            {!(state.filters.spatial.mode === 'named' && state.filters.spatial.areaType === 'cell' && state.filters.spatial.areaId === cellId) && (
              <button
                type="button"
                className="button"
                onClick={() => dispatch({ type: 'setSpatial', spatial: { mode: 'named', areaType: 'cell', areaId: cellId } })}
              >
                Xem riêng ô này (biểu đồ, lịch, lịch sử)
              </button>
            )}
          </div>
        )
      })()}
    </aside>
  )
}
