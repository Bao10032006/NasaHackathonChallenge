import { Async, Fields, MetaView, OriginText, Panel, SourceCompositionTable, StatusText, StatusValue, TemporalSelectorView, BoundsText } from '../components/raw'
import { useApi } from '../lib/useApi'
import { useAppState, useDispatch } from '../state/AppState'
import { cellDetailsRequest } from './requests'

/** On-demand provenance of one cell for the current period (/cells/{cellId}/period-details). */
export function CellPeriodDetails() {
  const state = useAppState()
  const dispatch = useDispatch()
  const details = useApi(cellDetailsRequest(state))

  return (
    <Panel id="cell-period-details" title="Chi tiết ô lưới">
      <Async state={details} idle={<p>Bấm một ô trên bản đồ hoặc trong bảng ô để xem chi tiết nguồn.</p>}>
        {(data) => (
          <>
            <Fields
              rows={[
                ['Ô', data.cell.id],
                ['Vùng phân tích', data.cell.diagnosticRegion ?? '—'],
                ['Tâm (vĩ, kinh)', data.cell.center ? `${data.cell.center.lat}, ${data.cell.center.lon}` : '—'],
                ['Biên', <BoundsText key="bounds" bounds={data.cell.bounds} />],
                ['Giá trị (snpp_eq)', <StatusValue key="value" value={data.value} status={data.valueStatus} />],
                ['Trạng thái', <StatusText key="status" status={data.valueStatus} />],
                ['Nguồn gốc giá trị', <OriginText key="origin" origin={data.origin} />],
              ]}
            />
            <TemporalSelectorView selector={data.temporalSelector} />
            <SourceCompositionTable sources={data.sourceComposition} />
            <p>Không có tọa độ hay thời điểm điểm cháy gốc: API chỉ cung cấp giá trị tổng hợp theo ô.</p>
            <MetaView meta={data.meta} />
            <button type="button" onClick={() => dispatch({ type: 'selectCell', cellId: null })}>Đóng chi tiết ô</button>
          </>
        )}
      </Async>
    </Panel>
  )
}
