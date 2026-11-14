export function ActivityCalendars() {
  return (
    <>
      <section aria-labelledby="monthly-activity-title">
        <h2 id="monthly-activity-title">Hoạt động đốt theo 12 tháng</h2>
        <figure>
          <figcaption>Chỉ số hoạt động đốt từ tháng 1 đến tháng 12</figcaption>
          <div data-slot="monthly-chart" />
        </figure>
        <div role="status" />
      </section>

      <section aria-labelledby="day-calendar-title">
        <h2 id="day-calendar-title">Lịch chi tiết tháng</h2>
        <p>Mỗi ô tương ứng với một ngày trong tháng.</p>
        <div data-slot="day-calendar" />
        <h3>Chú giải trạng thái</h3>
        <ul>
          <li>Có dữ liệu, kể cả giá trị 0.</li>
          <li>Thiếu dữ liệu.</li>
          <li>Ngoài phạm vi dữ liệu.</li>
          <li>Kỳ có dữ liệu một phần.</li>
        </ul>
        <div role="status" />
      </section>
    </>
  )
}
