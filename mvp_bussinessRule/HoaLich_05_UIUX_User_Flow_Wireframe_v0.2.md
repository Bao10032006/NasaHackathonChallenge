---
subtitle: User Flow, Information Architecture & Wireframe Specification
title: HỎA LỊCH
version: v0.2
updated: 2026-11-14
language: vi
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 05 · v0.2**

# 1. Trải nghiệm MVP

Hỏa Lịch là một trang khám phá lịch sử hoạt động cháy, không yêu cầu đăng nhập. Người dùng chọn khu vực và kỳ thời gian, sau đó đọc calendar, bản đồ, xu hướng, seasonality và so sánh lịch sử trong cùng một filter context.

Giao diện phải kể được hai phần của challenge:

1. Tại sao MODIS và VIIRS không thể so sánh trực tiếp và harmonization giải quyết điều gì.
2. Chuỗi đã harmonized giúp người dùng khám phá calendar, xu hướng, mùa vụ và kỳ lịch sử đáng chú ý như thế nào.

# 2. Information Architecture

| Màn / thành phần | Vai trò | Ưu tiên |
|---|---|---|
| Explore | Filter, calendar, map, seasonality, comparison và trends. | Must |
| How Harmonization Works | Raw versus harmonized, nguồn, phương pháp và giới hạn. | Must |
| Data Notes | Metric, coverage, missing/zero/partial, data/model version. | Must |
| Cell Details | Chi tiết ô lưới/khu vực và kỳ. | Should |
| Anomaly Insight | Classification theo method đã chốt. | Should, feature-gated |
| Export | Tải CSV theo filter. | Could |
| Day View | Trải nghiệm ngày cụ thể. | Discovery, không hiển thị trong MVP v0.2 |

# 3. Core User Flow

Mở trang → đọc định nghĩa ngắn của `snpp_eq` → chọn area → chọn year và month/pentad → xem calendar → chọn period → map cập nhật → xem baseline mùa vụ và comparison → xem trend cùng kỳ qua nhiều năm → mở “How Harmonization Works” → đọc nguồn và giới hạn.

Nhánh Should: chọn cell để mở details; nếu anomaly feature đã sẵn sàng thì mở insight có method/sample size.

Nhánh lỗi:

- Filter không hợp lệ → hướng dẫn sửa filter.
- Không có dữ liệu → empty state, không hiển thị `0` giả.
- API/dataset lỗi → error state và Retry.
- Năm/kỳ partial → badge ngay tại control và visual liên quan.
- Baseline không đủ → “Không đủ dữ liệu lịch sử để so sánh”, không gắn nhãn bất thường.

# 4. Low-fidelity Wireframe — Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ HỎA LỊCH        Explore | Harmonization | Data Notes                │
├──────────────────────────────────────────────────────────────────────┤
│ Lịch sử hoạt động cháy tại Việt Nam                                │
│ Số phát hiện tương đương S-NPP · dữ liệu lịch sử, không cảnh báo    │
├──────────────────────────────────────────────────────────────────────┤
│ [Area type] [Area] [Year] [Month | Pentad] [Period] [Reset]        │
├───────────────────────────────┬──────────────────────────────────────┤
│ BURNING ACTIVITY CALENDAR     │ FIRE ACTIVITY GRID MAP               │
│ Heatmap + legend + tooltip    │ 0,25° cells + legend + click         │
│ Partial / missing badges      │ Selected period                      │
├───────────────────────────────┴──────────────────────────────────────┤
│ SEASONAL CONTEXT & HISTORICAL COMPARISON                            │
│ Selected value | baseline | delta | reference years | sample size   │
├──────────────────────────────────────────────────────────────────────┤
│ HISTORICAL TREND — same area and comparable period                  │
├──────────────────────────────────────────────────────────────────────┤
│ WHY HARMONIZATION? Raw MODIS/VIIRS context → harmonized series      │
├──────────────────────────────────────────────────────────────────────┤
│ NASA FIRMS · data/model version · methodology · limitations         │
└──────────────────────────────────────────────────────────────────────┘
```

# 5. Mobile Layout

Thứ tự cuộn dọc:

Header → metric notice → filters → calendar → seasonal context/comparison → map → trend → harmonization explanation → data notes.

- Filters có thể xuống nhiều hàng nhưng không ẩn area/year/granularity hiện tại.
- Tooltip phải có hành vi tap/click tương đương hover.
- Map không được chiếm chiều cao làm chặn luồng đọc; có nút mở rộng khi cần.
- Baseline, sample size và partial warning phải đọc được mà không phụ thuộc màu.

# 6. Component and State Specification

## 6.1. Core components

- `AppShell`, `Header`, `MetricNotice`.
- `AreaSelector`, `YearSelector`, `GranularityToggle`, `PeriodSelector`, `ResetFilters`.
- `ActivityCalendar`, `CalendarLegend`, `PeriodTooltip`.
- `FireGridMap`, `MapLegend`.
- `SeasonalContextPanel`, `HistoricalComparisonCard`.
- `HistoricalTrendChart`.
- `HarmonizationComparisonPanel`, `DataMethodologyPanel`.
- `LoadingState`, `EmptyState`, `ErrorState`, `PartialBadge`, `InsufficientBaselineState`.

## 6.2. Should/Could components

- `CellDetailsDrawer`.
- `AnomalyInsight` — chỉ render khi metadata xác nhận feature/version.
- `ExportAction`.

Không tạo `DayPicker` hoặc `DailyChart` trong v0.2.

# 7. UI Copywriting

| Trường hợp | Copy đề xuất |
|---|---|
| Metric | “Số phát hiện tương đương S-NPP; không phải số vụ cháy.” |
| Historical baseline | “Mức lịch sử cùng kỳ, tính từ {n} năm hợp lệ ({start}–{end}).” |
| Comparison | “Kỳ đã chọn cao/thấp hơn baseline lịch sử cùng kỳ.” |
| Insufficient baseline | “Không đủ dữ liệu lịch sử để so sánh kỳ này.” |
| Partial | “Dữ liệu kỳ/năm này chưa đầy đủ; chỉ so sánh các khoảng tương ứng.” |
| Diagnostic region | “Vùng phân tích phục vụ nghiên cứu, không phải ranh giới hành chính.” |
| Anomaly | “Cao hơn ngưỡng lịch sử cùng kỳ” kèm method/sample size; không dùng “cảnh báo cháy”. |
| Harmonization | “MODIS và VIIRS có khả năng quan sát khác nhau; chuỗi đã harmonized cải thiện khả năng so sánh qua thời gian.” |

# 8. Interaction Rules

- Chọn calendar period cập nhật map, comparison và highlighted points trên trend.
- Đổi area/year/granularity reset period nếu period cũ không còn hợp lệ.
- URL/state có thể biểu diễn filter để reload/share trong phạm vi không nhạy cảm.
- Không hiển thị anomaly chỉ vì delta dương; classification phải đến từ contract feature-gated.
- Raw và harmonized phải có label/unit/legend riêng; không đặt cạnh nhau theo cách ngụ ý chúng tương đương trực tiếp.

# 9. Demo Scenario

1. Chọn `TayNguyen`, năm 2024 và granularity `pentad`.
2. Quan sát calendar và chọn một pentad có hoạt động đáng chú ý.
3. Map hiển thị phân bố theo cell trong pentad đó.
4. Seasonal Context cho biết baseline cùng pentad, reference years và sample size.
5. Trend hiển thị pentad tương ứng qua nhiều năm và cảnh báo các điểm partial/missing.
6. Mở Harmonization để xem một ví dụ raw versus harmonized đã kiểm định và hiểu vì sao chuỗi thô không thể so trực tiếp.
7. Mở Data Notes để đọc nguồn, metric, data/model version và giới hạn.

Demo dùng dữ liệu thật. Nếu anomaly feature chưa qua gate, demo chỉ nói “cao/thấp hơn baseline”, không dùng nhãn anomaly.

# 10. UX Acceptance Checklist

- Luồng demo hoàn thành không cần Day View hoặc anomaly feature.
- Calendar, map, comparison và trend luôn thể hiện cùng filter.
- Seasonality có dữ liệu định lượng, không chỉ là màu một năm.
- Missing/zero/partial/error có trạng thái khác nhau.
- Tất cả visual có text alternative hoặc số/nhãn hỗ trợ.
- Người dùng luôn tiếp cận được nguồn, metric và giới hạn trong tối đa một thao tác từ Explore.

