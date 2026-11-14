import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bounds, MapCellsResponse } from '../api/types'
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
import { GOLDEN_BBOX, NATIONAL_SPATIAL, useAppState, useDispatch } from '../state/AppState'
import { mapRequest } from './requests'

function fitFor(data: MapCellsResponse | undefined): MapFit | null {
  if (!data) {
    return null
  }
  const key = `${data.selection.type}:${data.selection.cellIds.join(',')}`
  const national = data.selection.type === 'NAMED_AREA' && data.selection.area?.type === 'national'
  return { key, bounds: national ? 'vietnam' : data.selection.selectedBounds }
}

const boundsKey = (bounds: Bounds) => `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`

/**
 * Explore map. Drawing flow: draw → preview with "Dùng vùng này" / "Hủy" → only a confirmed box
 * updates the filters and loads data; cancelling keeps the previous selection untouched.
 */
export function ExploreMap({ drawing, onDrawingChange }: { drawing: boolean; onDrawingChange: (drawing: boolean) => void }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const map = useApi(mapRequest(state))
  const { data, stale } = currentOrPrevious(map)
  const [basemap, setBasemap] = useState<BasemapId>('night')
  const [preview, setPreview] = useState<Bounds | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const drawButtonRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  // A box confirmed from a drawing is already in view: keep the user's pan/zoom instead of refitting.
  const keepViewFor = useRef<string | null>(null)
  const requestedBbox = state.filters.spatial.mode === 'bbox' ? state.filters.spatial : null
  if (keepViewFor.current && (!requestedBbox || boundsKey(requestedBbox) !== keepViewFor.current)) {
    keepViewFor.current = null // another selection since the drawing: fit normally again
  }
  const scale = useMemo(() => activityScale(data?.summary.maxCellValue), [data])
  const baseFit = fitFor(data)
  const keepView = requestedBbox !== null && keepViewFor.current === boundsKey(requestedBbox)
  const fit = baseFit && keepView ? { ...baseFit, skip: true } : baseFit
  const error = map.status === 'error' ? map.error : null
  const noCells = error?.code === 'NO_CELLS_IN_BOUNDS'
  const selectCell = (cellId: string) => dispatch({ type: 'selectCell', cellId })

  // Starting a new drawing drops any unconfirmed preview; bring the map into view if it is off-screen.
  useEffect(() => {
    if (!drawing) {
      return
    }
    setPreview(null)
    const rect = sectionRef.current?.getBoundingClientRect()
    if (rect && (rect.bottom < 160 || rect.top > window.innerHeight - 160)) {
      sectionRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [drawing])

  // Preview: focus the confirm button (without scrolling); Escape cancels.
  useEffect(() => {
    if (!preview) {
      return
    }
    confirmRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        cancel()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [preview]) // eslint-disable-line react-hooks/exhaustive-deps

  function cancel() {
    setPreview(null)
    onDrawingChange(false)
    drawButtonRef.current?.focus({ preventScroll: true })
  }

  function confirm() {
    if (!preview) {
      return
    }
    keepViewFor.current = boundsKey(preview)
    dispatch({ type: 'setSpatial', spatial: { mode: 'bbox', ...preview } })
    setPreview(null)
    drawButtonRef.current?.focus({ preventScroll: true })
  }

  function errorActions() {
    if (noCells) {
      return (
        <>
          <button type="button" className="button button-small primary" onClick={() => onDrawingChange(true)}>Vẽ lại</button>
          <button type="button" className="button button-small" onClick={() => dispatch({ type: 'setSpatial', spatial: NATIONAL_SPATIAL })}>Về toàn quốc</button>
        </>
      )
    }
    if (error?.kind === 'mock-missing') {
      return (
        <>
          <button type="button" className="button button-small primary" onClick={() => dispatch({ type: 'setSpatial', spatial: { mode: 'bbox', ...GOLDEN_BBOX } })}>
            Dùng khung ví dụ
          </button>
          <button type="button" className="button button-small" onClick={() => dispatch({ type: 'setSpatial', spatial: NATIONAL_SPATIAL })}>Về toàn quốc</button>
        </>
      )
    }
    return (
      <>
        <button type="button" className="button button-small primary" onClick={map.retry}><Icon name="refresh" size={14} />Thử lại</button>
        <button type="button" className="button button-small" onClick={() => dispatch({ type: 'setSpatial', spatial: NATIONAL_SPATIAL })}>Về toàn quốc</button>
      </>
    )
  }

  let edge = null
  if (drawing) {
    edge = (
      <div className="map-edge-panel map-edge-hint" role="status">
        <Icon name="select" size={16} />
        <span>Kéo để chọn vùng · Esc để hủy</span>
        <button type="button" className="button button-small" onClick={cancel}>Hủy</button>
      </div>
    )
  } else if (preview) {
    edge = (
      <div className="map-edge-panel" role="group" aria-label="Xác nhận vùng vừa vẽ">
        <p className="map-edge-title">Vùng xem trước</p>
        <p className="map-edge-text num">{boundsLabel(preview)}</p>
        <p className="map-edge-text muted">Ô được tính khi tâm ô nằm trong khung.</p>
        <div className="map-edge-actions">
          <button ref={confirmRef} type="button" className="button button-small primary" onClick={confirm}>
            <Icon name="check" size={14} />Dùng vùng này
          </button>
          <button type="button" className="button button-small" onClick={cancel}>Hủy</button>
        </div>
      </div>
    )
  } else if (map.status === 'loading') {
    edge = (
      <div className="map-edge-panel map-edge-status" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        {stale ? 'Đang cập nhật bản đồ…' : 'Đang tải bản đồ…'}
      </div>
    )
  } else if (error) {
    edge = (
      <div className="map-edge-panel map-edge-error" role="alert">
        <p className="map-edge-title"><Icon name="alert" size={16} />{noCells ? 'Khung không chứa ô dữ liệu nào' : 'Không tải được bản đồ'}</p>
        <p className="map-edge-text">
          {noCells
            ? 'Không có tâm ô nào nằm trong khung. Khung vẫn được giữ trên bản đồ.'
            : error.kind === 'mock-missing'
              ? 'Chưa có dữ liệu mẫu cho lựa chọn này (dữ liệu mẫu chỉ có toàn quốc và khung ví dụ Tây Nguyên). Có thể chuyển sang API thật ở đầu trang.'
              : (error.code && PROBLEM_COPY[error.code]) ?? error.message}
        </p>
        <div className="map-edge-actions">{errorActions()}</div>
      </div>
    )
  }

  return (
    <section ref={sectionRef} className="card map-card" aria-labelledby="map-title">
      <div className="card-head">
        <div>
          <h2 id="map-title">Bản đồ hoạt động cháy</h2>
          <p className="muted small">
            {data ? selectorLabel(data.temporalSelector) : map.status === 'error' ? 'Chưa có dữ liệu' : 'Đang tải…'}
            {data && <> · {data.selection.cellCount} ô lưới 0,25°</>}
          </p>
        </div>
        <div className="toolbar">
          <SegmentedControl label="Ảnh nền" size="small" options={BASEMAP_OPTIONS} value={basemap} onChange={setBasemap} />
          <button
            ref={drawButtonRef}
            type="button"
            className={drawing ? 'button primary' : 'button'}
            aria-pressed={drawing}
            onClick={() => (drawing ? cancel() : onDrawingChange(true))}
          >
            <Icon name="select" size={16} />
            {drawing ? 'Hủy vẽ' : 'Khoanh bằng chuột'}
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
        previewBounds={preview}
        fit={fit}
        basemap={basemap}
        drawing={drawing}
        locked={preview !== null}
        onDrawEnd={(bounds) => {
          onDrawingChange(false)
          setPreview(bounds)
        }}
        onDrawCancel={cancel}
      >
        {edge && <div className="map-edge">{edge}</div>}
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
