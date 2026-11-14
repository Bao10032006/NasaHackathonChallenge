export function HistoricalAnalysis() {
  return (
    <section aria-labelledby="historical-analysis-title">
      <h2 id="historical-analysis-title">Phân tích lịch sử</h2>
      <figure>
        <figcaption>Cùng tháng qua các năm</figcaption>
        <div data-slot="historical-trend" />
      </figure>
      <figure>
        <figcaption>Mẫu hình mùa vụ 12 tháng</figcaption>
        <div data-slot="seasonality" />
      </figure>

      <dl>
        <dt>Mức tham chiếu cùng kỳ</dt>
        <dd>—</dd>
        <dt>Chênh lệch so với mức tham chiếu</dt>
        <dd>—</dd>
        <dt>Số năm hợp lệ</dt>
        <dd>—</dd>
      </dl>
      <div role="status" />
    </section>
  )
}
