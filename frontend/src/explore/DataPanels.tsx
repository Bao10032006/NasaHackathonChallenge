import type { Daily, Details, Grid, MapCell, Metadata } from './api'
import { CoverageNotice, ResourceNotice, dateLabel, origins, statusLabels, valueLabel } from './display'
import { SourceList } from './PeriodSummary'
import type { Resource } from './useResource'

export function GridCellDetails({ cellId, resource, mapCell, period, daily, onClose }: {
  cellId: string
  resource: Resource<Details>
  mapCell?: MapCell
  period?: Grid['temporalSelector']
  daily: Resource<Daily>
  onClose: () => void
}) {
  const data = resource.data ?? mapCell
  const temporal = resource.data?.temporalSelector ?? period
  const composition = resource.data?.sourceComposition ?? daily.data?.sourceComposition
  return (
    <section className="panel cell-details" aria-labelledby="cell-details-title">
      <div className="panel-heading">
        <h2 id="cell-details-title">Chi tiết ô {cellId}</h2>
        <button className="quiet" type="button" onClick={onClose}>Đóng chi tiết</button>
      </div>
      {resource.error !== 'ENDPOINT_UNAVAILABLE' && <ResourceNotice resource={resource} />}
      {data && <>
        <dl>
          {temporal && <><dt>Kỳ yêu cầu</dt><dd>{dateLabel(temporal.startDate)} – {dateLabel(temporal.endDate)}</dd></>}
          <dt>Giá trị</dt><dd>{valueLabel(data.value, data.valueStatus)}{data.valueStatus === 'AVAILABLE' && ' phát hiện tương đương S-NPP'}</dd>
          <dt>Trạng thái</dt><dd>{statusLabels[data.valueStatus]}</dd>
          {data.origin && <><dt>Nguồn gốc giá trị</dt><dd>{origins[data.origin]}</dd></>}
        </dl>
        {temporal && <CoverageNotice coverage={temporal.coverage} />}
        <h3>Nguồn vệ tinh đóng góp</h3>
        {composition && (composition.length
          ? <SourceList items={composition} />
          : <p className="muted">Không có nguồn đóng góp trong kỳ.</p>)}
      </>}
      <ResourceNotice resource={daily} />
      {resource.error === 'ENDPOINT_UNAVAILABLE' && !composition && !daily.loading && !daily.error && (
        <p className="muted">API hiện chưa cung cấp cơ cấu nguồn theo ô cho kỳ này.</p>
      )}
    </section>
  )
}

export function DataNotes({ metadata }: { metadata?: Metadata }) {
  return (
    <details className="panel data-notes" id="data-notes">
      <summary>Nguồn và cách đọc dữ liệu</summary>
      <dl>
        <dt>Nguồn</dt>
        <dd><a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a> · MODIS trên Terra/Aqua và VIIRS trên Suomi NPP/NOAA-20.</dd>
        <dt>Chuẩn S-NPP</dt>
        <dd>Chỉ số phát hiện ban ngày đã lọc nguồn nhiệt tĩnh dùng S-NPP làm thang tham chiếu. Giá trị quy đổi hoặc ước lượng có thể là số thập phân.</dd>
        <dt>Ô lưới</dt>
        <dd>Chấm là tâm ô 0,25°. Giá trị gắn với toàn ô. Vùng chẩn đoán phục vụ phân tích.</dd>
        <dt>Giá trị theo ngày</dt>
        <dd>{metadata?.daily.qualification ?? 'Một số giá trị ngày là ước lượng cấp tháng được phân bổ lại.'} Giao diện phân biệt quan sát trực tiếp, quy đổi và ước lượng.</dd>
        <dt>Giới hạn</dt>
        <dd>Chỉ số mô tả lịch sử phát hiện nhiệt. Không dùng để suy ra số vụ cháy, diện tích cháy hay cảnh báo thời gian thực.</dd>
        {metadata && <>
          <dt>Dữ liệu đến</dt><dd>{dateLabel(metadata.meta.dataThrough)}</dd>
          <dt>Phiên bản dữ liệu / mô hình</dt><dd>{metadata.meta.dataVersion} / {metadata.meta.modelVersion}</dd>
        </>}
      </dl>
      {metadata?.limitations.length ? <ul>{metadata.limitations.map((note) => <li key={note}>{note}</li>)}</ul> : null}
    </details>
  )
}
