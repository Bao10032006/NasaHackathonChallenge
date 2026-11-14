export function GridCellDetails() {
  return (
    <section aria-labelledby="grid-cell-details-title">
      <h2 id="grid-cell-details-title">Chi tiết ô lưới</h2>
      <dl>
        <dt>Ô lưới</dt>
        <dd>—</dd>
        <dt>Kỳ</dt>
        <dd>—</dd>
        <dt>Giá trị</dt>
        <dd>—</dd>
        <dt>Trạng thái</dt>
        <dd>—</dd>
        <dt>Nguồn vệ tinh</dt>
        <dd>—</dd>
      </dl>
      <div role="status" />
    </section>
  )
}

export function DataNotes() {
  return (
    <section aria-labelledby="data-notes-title">
      <h2 id="data-notes-title">Nguồn và cách đọc dữ liệu</h2>
      <dl>
        <dt>Nguồn dữ liệu</dt>
        <dd>NASA FIRMS · MODIS và VIIRS</dd>
        <dt>Phương pháp hài hòa</dt>
        <dd>—</dd>
        <dt>Phiên bản dữ liệu và mô hình</dt>
        <dd>—</dd>
        <dt>Giới hạn diễn giải</dt>
        <dd>—</dd>
      </dl>
    </section>
  )
}
