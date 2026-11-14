import { api } from '../api/client'
import { Async, Fields, MetaView, Panel } from '../components/raw'
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
    <div data-screen="notes">
      <Panel id="data-notes" title="Nguồn và cách đọc dữ liệu">
        <Async state={metadata}>
          {(data) => (
            <>
              <h3>Chỉ số</h3>
              <Fields
                rows={[
                  ['Nguồn', 'NASA FIRMS · MODIS (Terra, Aqua) và VIIRS (S-NPP, NOAA-20)'],
                  ['Metric', `${data.meta.metric} · ${data.meta.unit}`],
                  ['Ý nghĩa', 'Số phát hiện ban ngày quy về thang đo VIIRS S-NPP; không phải số vụ cháy, diện tích cháy, dự báo hay cảnh báo.'],
                  ['Lưới', `${data.gridDegrees}°`],
                  ['Múi giờ', data.meta.timeZone],
                  ['Khoảng dữ liệu', `${formatDate(data.dateRange.start)} – ${formatDate(data.dateRange.end)}`],
                  ['Năm', `${data.yearRange.start} – ${data.yearRange.end} (hai năm đầu/cuối chưa đầy đủ)`],
                  ['dataVersion', data.meta.dataVersion],
                  ['modelVersion', data.meta.modelVersion],
                  ['Dữ liệu đến hết', formatDate(data.meta.dataThrough)],
                ]}
              />

              <h3>Mã nguồn theo ô-ngày</h3>
              <table>
                <thead>
                  <tr><th>Mã</th><th>Nguồn</th><th>Origin</th><th>Cách hiểu</th><th>Mô tả từ dataset</th></tr>
                </thead>
                <tbody>
                  {data.sourceCodes.map((source) => (
                    <tr key={source.code}>
                      <td>{source.code}</td>
                      <td>{source.source} · {SOURCE_LABEL[source.source]}</td>
                      <td>{source.origin}</td>
                      <td>{ORIGIN_COPY[source.origin]}</td>
                      <td>{source.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Dữ liệu theo ngày</h3>
              <Fields
                rows={[
                  ['Có dữ liệu ngày', data.daily.available ? 'Có' : 'Không'],
                  ['Khoảng bất định theo ngày', data.daily.uncertaintyIntervalAvailable ? 'Có' : 'Không'],
                  ['Lưu ý', data.daily.qualification],
                ]}
              />

              <h3>Giới hạn diễn giải</h3>
              <ul>
                {data.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>

              <h3>Danh mục cảnh báo</h3>
              <table>
                <thead><tr><th>Mã</th><th>Nội dung</th><th>Áp dụng cho</th></tr></thead>
                <tbody>
                  {data.warningCatalog.map((warning) => (
                    <tr key={warning.code}>
                      <td><code>{warning.code}</code></td>
                      <td>{warning.message}</td>
                      <td>{warning.appliesTo?.join(', ') ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Khả năng của snapshot</h3>
              <Fields
                rows={[
                  ['Kiểu chọn không gian', data.capabilities.spatialSelectors.join(', ')],
                  ['Kỳ của bản đồ', data.capabilities.mapGranularities.join(', ')],
                  ['Lịch ngày', data.capabilities.calendarDaysAvailable ? 'Có' : 'Không'],
                  ['Điểm cháy gốc', data.capabilities.rawDetectionPointsAvailable ? 'Có' : 'Không cung cấp'],
                  ['Bảng so sánh thô/hài hòa', data.capabilities.harmonizationComparisonAvailable ? 'Có' : 'Không'],
                  ['Nhãn bất thường (anomaly)', data.capabilities.anomalyAvailable ? 'Có' : 'Chưa bật'],
                  ['Calendar', data.supportedGranularities.calendar.join(', ')],
                  ['Map', data.supportedGranularities.map.join(', ')],
                  ['Trends', data.supportedGranularities.trends.join(', ')],
                  ['Seasonality', data.supportedGranularities.seasonality.join(', ')],
                ]}
              />
              <MetaView meta={data.meta} />
            </>
          )}
        </Async>
      </Panel>

      <Panel id="harmonization-comparison" title="Vì sao cần hài hòa (tùy chọn)">
        <p>
          Các chuỗi thô có metric và đơn vị khác nhau nên không so sánh trực tiếp được với chuỗi đã hài hòa.
          Mỗi chuỗi giữ nhãn và đơn vị riêng.
        </p>
        <Async state={comparison} idle={<p>Snapshot không có bảng so sánh.</p>}>
          {(data) => (
            <>
              {data.series.map((series) => (
                <details key={series.seriesType}>
                  <summary>{series.label} · {series.seriesType} · {series.metric} ({series.unit})</summary>
                  <table>
                    <thead><tr><th>Năm</th><th>Giá trị</th></tr></thead>
                    <tbody>
                      {series.points.map((point) => (
                        <tr key={point.year}><td>{point.year}</td><td>{formatValue(point.value)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))}
              <p>Khóa giải thích: {data.explanationKeys.join(', ')}</p>
              <MetaView meta={data.meta} />
            </>
          )}
        </Async>
      </Panel>
    </div>
  )
}
