---
subtitle: User Flow, Information Architecture & Wireframe Specification
title: HỎA LỊCH
version: v0.4-proposed
updated: 2026-11-14
language: vi
status: frontend-aligned proposal; backend approval pending
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 05 · v0.4 PROPOSED**

# 1. Trải nghiệm MVP

Explore là một luồng liên tục từ phạm vi không gian → tổng quan năm → tháng → ngày → so sánh lịch sử. Tất cả panel dùng cùng spatial selection và metric harmonized.

# 2. Information Architecture

- **Explore · Must:** map, bbox selection, 12-month chart, summary, day calendar và trends.
- **Compare · Must:** hai map cùng bbox/cùng tháng ở hai năm.
- **Cell Details · Must:** source composition on-demand.
- **Data Notes · Must:** source, origin, metric, version và limitations.
- **Harmonization Comparison · Optional:** raw-versus-harmonized methodology.
- **Anomaly/Export/Season Aggregate · Deferred.**

# 3. Core User Flow

1. Mở Explore và đọc metric notice.
2. Chọn named area hoặc kéo bounding box ở bất kỳ vị trí nào trên bản đồ Việt Nam; khung có thể đi qua nhiều vùng chẩn đoán.
3. Backend trả selected cell outline; UI tô đúng các cell đó.
4. Chọn year: xem annual map, 12-month line và year summary.
5. Chọn month: xem monthly map, month summary và 28–31 day calendar.
6. Chọn một available date: map date và daily source summary cập nhật.
7. Click cell: mở cell-period provenance.
8. Mở Compare: giữ bbox/month, chọn hai year và xem hai map.
9. Mở Historical Analysis: same-month trend và 12-month baseline pattern.

# 4. Desktop Wireframe

```text
┌───────────────────────────────────────────────────────────────────────┐
│ HỎA LỊCH                  Explore | Compare | Data Notes              │
├───────────────────────────────────────────────────────────────────────┤
│ Số phát hiện tương đương S-NPP · lịch sử, không phải cảnh báo         │
├───────────────────────────────────────────────────────────────────────┤
│ [Named area | Draw box] [Year] [Month/Pentad/Date] [Reset]           │
│ Selected: 13 cells · requested/effective bounds · coverage            │
├──────────────────────────────────┬────────────────────────────────────┤
│ GRID MAP                         │ SUMMARY                            │
│ cell markers + selected outlines │ total · coverage · peak            │
│ year/month/day · API min/max     │ origin/source when date            │
├──────────────────────────────────┴────────────────────────────────────┤
│ 12-MONTH ACTIVITY + HISTORICAL BASELINE                              │
├──────────────────────────────────┬────────────────────────────────────┤
│ DAY CALENDAR (selected month)    │ SAME-PERIOD HISTORICAL TREND       │
│ 28–31 days                       │ month/pentad across years           │
├──────────────────────────────────┴────────────────────────────────────┤
│ Cell details drawer · Data Notes · versions · limitations             │
└───────────────────────────────────────────────────────────────────────┘
```

# 5. Compare Wireframe

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Same bbox · Month 3 · [Year A] [Year B] · compatibility status        │
├───────────────────────────────────────────────────────────────────────┤
│ Period total A | Period total B | area delta (only when compatible)   │
├──────────────────────────────────┬────────────────────────────────────┤
│ MAP A                            │ MAP B                              │
│ shared pan/zoom/color scale      │ shared pan/zoom/color scale        │
├──────────────────────────────────┴────────────────────────────────────┤
│ Selected cell: A value | B value | delta (only when compatible)       │
└───────────────────────────────────────────────────────────────────────┘
```

# 6. Mobile Order

Metric notice → spatial filter → time filter → selection/coverage → summary → map → 12-month chart → day calendar → historical trend → cell details → Data Notes.

Compare có thể chuyển A/B bằng tabs nhưng phải giữ shared scale và compatibility label.
Shared color domain lấy từ `minCellValue`/`maxCellValue` của hai map summary; frontend không cộng lại cell để suy total.
Tổng kỳ A/B đọc trực tiếp từ `summary.totalValue` của từng map. Hai tổng vẫn hiển thị kèm coverage khi partial; chênh lệch toàn vùng chỉ hiển thị khi compatibility pass và cả hai total khác null.

# 7. Component Specification

Core:

- `SpatialSelector`, `BoundingBoxDrawControl`, `SelectedCellOverlay`.
- `YearSelector`, `MonthSelector`, `PentadSelector`, `DayPicker`.
- `FireGridMap`, `MapLegend`, `CoverageBadge`.
- `PeriodSummaryCard`, `MonthlyActivityChart`, `DayCalendar`.
- `HistoricalTrendChart`, `SeasonalityBaseline`.
- `DualMapComparison`, `ComparisonCompatibilityNotice`.
- `CellPeriodDetailsDrawer`, `SourceCompositionList`.
- `MetricNotice`, `DataNotes`, loading/empty/error states.

Optional/deferred:

- `HarmonizationComparisonPanel`, `AnomalyInsight`, `ExportAction`, `SeasonAggregate`.

# 8. Interaction Rules

- Named area và draw box là hai mode loại trừ nhau.
- Bbox chỉ commit sau khi drag kết thúc; UI giữ requested outline đến khi backend trả selected cells.
- Không có cell: giữ khung, hiện hướng dẫn khoanh lại; không reset im lặng.
- Click 12-month point chọn month và tải day calendar.
- Click available day chọn date và cập nhật map/daily; outside-range day disabled.
- Day zero vẫn clickable và hiển thị `0`.
- Click map cell tải details on-demand.
- Compare chỉ hiện delta khi compatibility pass; partial vẫn xem được nhưng delta ẩn.

# 9. Summary Rules in UI

- Year: total covered year + peak full month.
- Month: total covered month + peak available full day.
- Date: total date + source composition.
- Tie: earliest period/date.
- All-zero: hide peak row.
- Parent period partial: show actual covered range and uncovered count; nếu có peak từ child item đầy đủ thì ghi “trong khoảng đã có dữ liệu”.
- `sourceInputValid=false` không dùng copy “thiếu ngày”.
- Calendar summary đọc `peakPeriod`; day-calendar summary đọc `peakDate`; không suy luận object `peak` đa hình.

# 10. State and Copy

- `AVAILABLE`: hiển thị số, kể cả zero.
- `MISSING`: “Không có dữ liệu cho kỳ này.”
- `OUTSIDE_DATASET_RANGE`: “Ngoài phạm vi dữ liệu hiện có.”
- Partial: “Kỳ chưa đầy đủ: có dữ liệu {coveredFrom}–{coveredTo}.”
- No cells: “Khung đã chọn không chứa ô dữ liệu; hãy khoanh lại.”
- Model redistributed: “Ước lượng hài hòa theo ngày.”
- Scaled observation: “Quan sát NOAA-20 đã quy đổi về S-NPP.”
- Direct observation: “Quan sát S-NPP trực tiếp trong snapshot đã lọc.”

Warning copy lấy từ `/metadata.warningCatalog`; UI dùng stable warning code làm khóa và không hardcode/parse `detail`. Area selector hiển thị `name` tiếng Việt nhưng gửi stable `id`.

# 11. Demo Scenario

1. Ví dụ demo: khoanh `west=107,south=12,east=108,north=13` — 13 cell Tây Nguyên. Đây chỉ là dữ liệu mẫu; control phải hoạt động trên toàn bộ lưới Việt Nam.
2. Chọn 2024: annual map + 12-month chart; peak month là tháng 2.
3. Chọn tháng 3: monthly map + 31-day calendar.
4. Chọn 18/03/2024: daily total và direct S-NPP source.
5. Click một cell để xem source detail.
6. Compare tháng 3/2005 và tháng 3/2024.
7. Kiểm partial bằng tháng 11/2026 và outside-range bằng ngày 14–30/11/2026.

# 12. UX Acceptance Checklist

- Bbox resolve cùng cell set ở mọi panel.
- Day calendar, daily summary và date map khớp.
- Zero/outside/missing/partial khác nhau bằng cả màu và text.
- Selected cells có outline, không gọi marker là raw hotspot.
- Compare không tính delta khi coverage/version/cell set lệch.
- Compare hiển thị tổng kỳ A/B từ map summary và chỉ hiển thị chênh lệch toàn vùng khi hai kỳ tương thích.
- Nguồn/metric/limitations tiếp cận trong tối đa một thao tác.
