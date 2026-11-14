export function FireGridMap() {
  return (
    <section aria-labelledby="fire-grid-map-title">
      <h2 id="fire-grid-map-title">Bản đồ hoạt động đốt</h2>
      <figure>
        <figcaption>Bản đồ Việt Nam</figcaption>
        <div data-layer="cell-markers">
          <p>Vị trí hiển thị chấm đại diện và thao tác chọn ô lưới.</p>
        </div>
        <div data-layer="selected-cell-outlines" />
      </figure>

      <h3>Chú giải bản đồ</h3>
      <ul>
        <li>Chấm biểu thị tâm ô lưới 0,25°.</li>
        <li>Đường viền đánh dấu các ô được chọn.</li>
      </ul>
      <div role="status" />
    </section>
  )
}
