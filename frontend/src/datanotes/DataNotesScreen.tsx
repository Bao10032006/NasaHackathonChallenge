import { api } from '../api/client'
import { DataTable } from '../components/DataTable'
import { Card, ErrorNote, OriginBadge, ServedByBadge } from '../components/ui'
import { ORIGIN_COPY, SOURCE_LABEL, formatDate, formatValue } from '../lib/format'
import { useApi } from '../lib/useApi'
import { useAppState } from '../state/AppState'
import { useSnapshot } from '../state/Metadata'

/** Data Notes (Must): every field of /metadata, plus the optional raw-versus-harmonized evidence. */
export default function DataNotesScreen() {
  const { dataSource } = useAppState()
  const { metadata } = useSnapshot()
  const comparisonAvailable = metadata.status === 'success' && metadata.data.capabilities.harmonizationComparisonAvailable
  const comparison = useApi(comparisonAvailable ? api.harmonizationComparison(dataSource) : null)

  return (
    <div className="notes" data-screen="notes">
      <h1 className="visually-hidden">Nguồn và cách đọc dữ liệu</h1>
      {metadata.status === 'loading' && <p className="muted" role="status"><span className="spinner" aria-hidden="true" />Đang tải metadata…</p>}
      {metadata.status === 'error' && <ErrorNote error={metadata.error} onRetry={metadata.retry} context="metadata" />}
      {metadata.status === 'success' && (() => {
        const data = metadata.data
        return (
          <div className="notes-grid">
            <Card id="notes-metric" title="Chỉ số snpp_eq" aside={<ServedByBadge servedBy={metadata.servedBy} />}>
              <dl className="fields">
                <div className="field"><dt>Nguồn</dt><dd>NASA FIRMS · MODIS (Terra, Aqua) và VIIRS (S‑NPP, NOAA‑20)</dd></div>
                <div className="field"><dt>Metric</dt><dd><code>{data.meta.metric}</code> · {data.meta.unit}</dd></div>
                <div className="field"><dt>Ý nghĩa</dt><dd>Số phát hiện ban ngày quy về thang VIIRS S‑NPP; không phải số vụ cháy, diện tích cháy, dự báo hay cảnh báo.</dd></div>
                <div className="field"><dt>Lưới</dt><dd className="num">{data.gridDegrees}° (~27 km)</dd></div>
                <div className="field"><dt>Khoảng dữ liệu</dt><dd className="num">{formatDate(data.dateRange.start)} – {formatDate(data.dateRange.end)} ({data.meta.timeZone})</dd></div>
                <div className="field"><dt>Năm</dt><dd className="num">{data.yearRange.start} – {data.yearRange.end} (hai năm đầu/cuối chưa đủ năm)</dd></div>
                <div className="field"><dt>Phiên bản</dt><dd><code>{data.meta.dataVersion}</code> · <code>{data.meta.modelVersion}</code></dd></div>
              </dl>
            </Card>

            <Card id="notes-sources" title="Mã nguồn theo ô-ngày">
              <DataTable label="Từ điển mã nguồn">
                <thead><tr><th scope="col">Mã</th><th scope="col">Nguồn</th><th scope="col">Nguồn gốc</th><th scope="col">Cách hiểu</th></tr></thead>
                <tbody>
                  {data.sourceCodes.map((source) => (
                    <tr key={source.code}>
                      <td className="num">{source.code}</td>
                      <td>{SOURCE_LABEL[source.source]}</td>
                      <td><OriginBadge origin={source.origin} /></td>
                      <td>{ORIGIN_COPY[source.origin]}{source.description ? <span className="muted"> ({source.description})</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>

            <Card id="notes-daily" title="Giá trị theo ngày">
              <dl className="fields">
                <div className="field"><dt>Có dữ liệu ngày</dt><dd>{data.daily.available ? 'Có' : 'Không'}</dd></div>
                <div className="field"><dt>Khoảng bất định theo ngày</dt><dd>{data.daily.uncertaintyIntervalAvailable ? 'Có' : 'Không có'}</dd></div>
                <div className="field"><dt>Lưu ý</dt><dd>{data.daily.qualification}</dd></div>
              </dl>
            </Card>

            <Card id="notes-limitations" title="Giới hạn diễn giải">
              <ul className="plain-list">{data.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            </Card>

            <Card id="notes-warnings" title="Danh mục cảnh báo" className="span-2">
              <DataTable label="Danh mục mã cảnh báo">
                <thead><tr><th scope="col">Mã</th><th scope="col">Nội dung</th><th scope="col">Áp dụng cho</th></tr></thead>
                <tbody>
                  {data.warningCatalog.map((warning) => (
                    <tr key={warning.code}>
                      <td><code>{warning.code}</code></td>
                      <td>{warning.message}</td>
                      <td>{warning.appliesTo?.join(', ') ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>

            <Card id="notes-capabilities" title="Khả năng của snapshot" className="span-2">
              <dl className="fields fields-2col">
                <div className="field"><dt>Kiểu chọn không gian</dt><dd>{data.capabilities.spatialSelectors.join(', ')}</dd></div>
                <div className="field"><dt>Kỳ của bản đồ</dt><dd>{data.capabilities.mapGranularities.join(', ')}</dd></div>
                <div className="field"><dt>Lịch ngày</dt><dd>{data.capabilities.calendarDaysAvailable ? 'Có' : 'Không'}</dd></div>
                <div className="field"><dt>Điểm cháy gốc</dt><dd>{data.capabilities.rawDetectionPointsAvailable ? 'Có' : 'Không cung cấp'}</dd></div>
                <div className="field"><dt>So sánh thô/hài hòa</dt><dd>{data.capabilities.harmonizationComparisonAvailable ? 'Có' : 'Không'}</dd></div>
                <div className="field"><dt>Nhãn bất thường</dt><dd>{data.capabilities.anomalyAvailable ? 'Có' : 'Chưa bật'}</dd></div>
                <div className="field"><dt>Calendar · Map</dt><dd>{data.supportedGranularities.calendar.join(', ')} · {data.supportedGranularities.map.join(', ')}</dd></div>
                <div className="field"><dt>Trends · Seasonality</dt><dd>{data.supportedGranularities.trends.join(', ')} · {data.supportedGranularities.seasonality.join(', ')}</dd></div>
              </dl>
            </Card>

            <Card id="notes-harmonization" title="Vì sao cần hài hòa (tùy chọn)" className="span-2" aside={comparison.status === 'success' ? <ServedByBadge servedBy={comparison.servedBy} /> : undefined}>
              <p className="muted">Các chuỗi thô có metric và đơn vị khác nhau, nên không so sánh trực tiếp được với chuỗi đã hài hòa. Mỗi chuỗi giữ nhãn và đơn vị riêng.</p>
              {comparison.status === 'idle' && <p className="muted">Snapshot không có bảng so sánh.</p>}
              {comparison.status === 'loading' && <p className="muted" role="status"><span className="spinner" aria-hidden="true" />Đang tải…</p>}
              {comparison.status === 'error' && <ErrorNote error={comparison.error} onRetry={comparison.retry} context="bảng so sánh" />}
              {comparison.status === 'success' && (
                <DataTable label="Chuỗi thô và chuỗi hài hòa theo năm">
                  <thead>
                    <tr>
                      <th scope="col">Năm</th>
                      {comparison.data.series.map((series) => (
                        <th scope="col" key={series.seriesType} className="num-col">{series.label}<br /><span className="muted small">{series.unit}</span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.data.series[0]?.points.map((point, index) => (
                      <tr key={point.year}>
                        <th scope="row" className="num">{point.year}</th>
                        {comparison.data.series.map((series) => (
                          <td key={series.seriesType} className="num-col">{formatValue(series.points[index]?.value)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </div>
        )
      })()}
    </div>
  )
}
