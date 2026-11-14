export function ExploreFilters() {
  return (
    <section aria-labelledby="explore-filters-title">
      <h2 id="explore-filters-title">Bộ lọc vùng và thời gian</h2>

      <fieldset disabled>
        <legend>Không gian</legend>
        <label htmlFor="area-type">Phạm vi</label>
        <select id="area-type" defaultValue="">
          <option value="">Chọn phạm vi</option>
          <option value="national">Toàn quốc</option>
          <option value="diagnostic_region">Vùng có sẵn</option>
          <option value="cell">Ô lưới</option>
        </select>

        <label htmlFor="area">Vùng hoặc ô lưới</label>
        <select id="area">
          <option>Chọn vùng hoặc ô lưới</option>
        </select>

        <button type="button">Khoanh vùng</button>
      </fieldset>

      <fieldset disabled>
        <legend>Thời gian</legend>
        <label htmlFor="year">Năm</label>
        <select id="year">
          <option>Chọn năm</option>
        </select>

        <label htmlFor="month">Tháng</label>
        <select id="month">
          <option>Chọn tháng</option>
        </select>

        <label htmlFor="pentad">Kỳ 5 ngày (pentad)</label>
        <select id="pentad">
          <option>Chọn kỳ</option>
        </select>

        <label htmlFor="date">Ngày</label>
        <input id="date" type="date" />
      </fieldset>

      <button type="button" disabled>Đặt lại</button>

      <dl>
        <dt>Vùng đang chọn</dt>
        <dd>—</dd>
        <dt>Số ô được tính</dt>
        <dd>—</dd>
      </dl>
      <div role="status" />
    </section>
  )
}
