import { useMemo, useState } from 'react'
import type { MapCellsResponse } from '../api/types'
import { Icon } from '../components/Icon'
import { SegmentedControl } from '../components/SegmentedControl'
import { ServedByBadge } from '../components/ui'
import { PROBLEM_COPY } from '../lib/format'
import { boundsLabel, selectorLabel } from '../lib/labels'
import { activityScale } from '../lib/scale'
import { currentOrPrevious, useApi } from '../lib/useApi'
import { BASEMAP_OPTIONS, type BasemapId } from '../map/basemaps'
import { CellTable } from '../map/CellTable'
import { GridMap, type MapFit } from '../map/GridMap'
import { MapLegend } from '../map/MapLegend'
import { useAppState, useDispatch } from '../state/AppState'
import { mapRequest } from './requests'

function fitFor(data: MapCellsResponse | undefined): MapFit | null {
  if (!data) {
    return null
  }
  const key = `${data.selection.type}:${data.selection.cellIds.join(',')}`
  const national = data.selection.type === 'NAMED_AREA' && data.selection.area?.type === 'national'
  return { key, bounds: national ? 'vietnam' : data.selection.selectedBounds }
}

export function ExploreMap() {
  const state = useAppState()
  const dispatch = useDispatch()
  const map = useApi(mapRequest(state))
  const { data, stale } = currentOrPrevious(map)
  const [drawing, setDrawing] = useState(false)
  const [basemap, setBasemap] = useState<BasemapId>('night')
  const requestedBbox = state.filters.spatial.mode === 'bbox' ? state.filters.spatial : null
  const scale = useMemo(() => activityScale(data?.summary.maxCellValue), [data])
  // Previous data keeps the previous selection key while loading, so the view only refits once the
  // new selection arrives; period changes keep the user's pan/zoom.
  const fit = fitFor(data)
  const error = map.status === 'error' ? map.error : null
  const noCells = error?.code === 'NO_CELLS_IN_BOUNDS'
  const selectCell = (cellId: string) => dispatch({ type: 'selectCell', cellId })

  return (
    <section className="card map-card" aria-labelledby="map-title">
      <div className="card-head">
        <div>
          <h2 id="map-title">Bản đồ hoạt động cháy</h2>
          <p className="muted small">
            {data ? selectorLabel(data.temporalSelector) : 'Đang tải…'}
            {data && <> · {data.selection.cellCount} ô lưới 0,25°</>}
          </p>
        </div>
        <div className="toolbar">
          <SegmentedControl label="Ảnh nền" size="small" options={BASEMAP_OPTIONS} value={basemap} onChange={setBasemap} />
          <button
            type="button"
            className={drawing ? 'button primary' : 'button'}
            aria-pressed={drawing}
            onClick={() => setDrawing((value) => !value)}
          >
            <Icon name="select" size={16} />
            {drawing ? 'Kéo trên bản đồ… (Esc hủy)' : 'Khoanh bằng chuột'}
          </button>
          {map.status === 'success' && <ServedByBadge servedBy={map.servedBy} />}
        </div>
      </div>

      <GridMap
        ariaLabel="Bản đồ ô lưới 0,25° của Việt Nam. Dùng bảng số liệu bên dưới để chọn ô bằng bàn phím."
        cells={data?.cells}
        scale={scale}
        stale={stale}
        selectedCellId={state.filters.selectedCellId}
        onSelectCell={selectCell}
        requestedBounds={requestedBbox}
        selectedBounds={data?.selection.type === 'BOUNDING_BOX' ? data.selection.selectedBounds : null}
        fit={fit}
        basemap={basemap}
        drawing={drawing}
        onDrawEnd={(bounds) => {
          setDrawing(false)
          dispatch({ type: 'setSpatial', spatial: { mode: 'bbox', ...bounds } })
        }}
        onDrawCancel={() => setDrawing(false)}
      >
        {map.status === 'loading' && (
          <div className="map-overlay" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            {stale ? 'Đang cập nhật bản đồ cho lựa chọn mới…' : 'Đang tải bản đồ…'}
          </div>
        )}
        {error && (
          <div className="map-overlay map-overlay-error" role="alert">
            <strong>{noCells ? 'Khung không chứa ô dữ liệu nào' : 'Không tải được bản đồ'}</strong>
            <span>
              {noCells
                ? 'Không có tâm ô nào nằm trong khung. Khung vẫn được giữ: hãy sửa tọa độ hoặc khoanh lại rộng hơn.'
                : error.kind === 'mock-missing'
                  ? 'Chưa có dữ liệu mẫu cho lựa chọn này. Dùng toàn quốc, khung ví dụ Tây Nguyên hoặc chuyển sang API thật.'
                  : (error.code && PROBLEM_COPY[error.code]) ?? error.message}
            </span>
            {!noCells && error.kind !== 'mock-missing' && (
              <button type="button" className="button" onClick={map.retry}>Thử lại</button>
            )}
          </div>
        )}
        {data && <MapLegend max={data.summary.maxCellValue} middle={scale.breaks[2]} />}
      </GridMap>

      {data && (
        <p className="map-reading muted small">
          Mỗi ô là một ô lưới 0,25° (~27 km). Màu từ đỏ sẫm đến vàng sáng thể hiện <strong>snpp_eq</strong> — số phát hiện cháy
          ban ngày tương đương cảm biến VIIRS S‑NPP — cộng trong kỳ; không phải số vụ cháy hay vị trí điểm cháy.
          {data.selection.type === 'BOUNDING_BOX' && (
            <> Viền nét đứt: khung yêu cầu; viền liền: phạm vi thực tế {boundsLabel(data.selection.selectedBounds)}.</>
          )}
        </p>
      )}
      {data && (
        <CellTable
          cells={data.cells}
          exactDate={data.temporalSelector.type === 'DATE'}
          selectedCellId={state.filters.selectedCellId}
          onSelectCell={selectCell}
        />
      )}
    </section>
  )
}
