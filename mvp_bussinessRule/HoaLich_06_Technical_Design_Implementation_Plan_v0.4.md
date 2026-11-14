---
subtitle: Architecture, Implementation Plan & Readiness Checklist
title: HỎA LỊCH
version: v0.4-proposed
updated: 2026-11-14
language: vi
status: frontend-aligned proposal; backend approval pending
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 06 · v0.4 PROPOSED**

# 1. Baseline kiến trúc

Giữ n-layer v0.3:

`controller → service interface → service.impl → repository interface → repository.file`

DTO/domain/mapper/config/exception giữ trách nhiệm riêng. Binary artifact TASK 03A đã hoàn thành và không đổi; repository hiện có được mở rộng tối thiểu theo §11.1 trước khi service bbox dùng production.

# 2. Package additions cho v0.4

```text
controller
├── ActivityController
└── CellController
dto.request
├── SpatialSelectionQuery
├── BoundingBoxQuery
├── CalendarDaysQuery
├── MapCellsQuery
└── CellPeriodDetailsQuery
dto.response
├── SpatialSelectionResponse
├── CoverageResponse
├── CalendarSummaryResponse
├── DailyCalendarSummaryResponse
├── MapSummaryResponse
├── DailyCalendarResponse
└── CellPeriodDetailsResponse
domain
├── area/SpatialSelection
├── area/BoundingBox
├── time/TemporalSelector
├── time/Coverage
└── activity/SourceComposition
service
├── SpatialSelectionService
├── CalendarService
├── MapActivityService
├── DailyActivityService
└── CellPeriodDetailService
service.impl
└── corresponding implementations
repository
├── AreaRepository
└── DailyActivityRepository (existing range query reused)
```

Không tạo repository chỉ để bọc lại service. `AreaRepository` hiểu cell geometry/order; `DailyActivityRepository` hiểu binary daily artifact.

# 3. Spatial resolution

`SpatialSelectionService`:

1. Validate exactly one spatial selector.
2. Resolve named area hoặc bbox.
3. Bbox dùng center-inclusive trên toàn bộ 587 cell centers đã load từ `cells_025.csv`; không lọc diagnostic region ngầm.
4. Giữ canonical order.
5. Tính requested bounds và selected bounds từ envelope hình học đầy đủ của cell (`min west/south`, `max east/north`).
6. Empty → domain exception `NoCellsInBoundsException`.

Không lưu custom area trong DB/session. Query sau gửi lại bbox; deterministic theo dataVersion.

# 4. Temporal resolution và coverage

`TemporalSelector` là sealed/domain type hoặc record hierarchy:

- ExactDate
- WholeYear
- Month
- Pentad

Cross-field validation nằm ở service/resolver, không ở repository. Coverage tính từ giao requested range với manifest date range.

Calendar days tạo civil dates bằng Java Time, sau đó:

- covered date → query repository;
- outside range → placeholder null, không gọi repository;
- leap day tự nhiên theo `YearMonth.lengthOfMonth()`.

# 5. Service responsibilities

- `CalendarService`: 12/73 period series, baseline, summary và daily-month calendar.
- `MapActivityService`: dispatch temporal selector, aggregate range × selected cells, trả stable cell order.
- `DailyActivityService`: exact-date aggregate + source composition.
- `CellPeriodDetailService`: aggregate daily source codes cho một cell/period.
- `TrendService`/`SeasonalityService`: nhận resolved cell set thay vì chỉ AreaRef.
- `SummaryCalculator`: pure domain helper tạo typed calendar/day/map summary; không cần interface nếu không có alternate implementation.

Peak algorithm: filter AVAILABLE + non-partial; max value; tie earliest; max=0 → null.

Baseline algorithm: lấy các năm reference có kỳ đầy đủ, loại target year nếu nằm trong reference range, giữ zero, loại missing/partial; dưới 5 mẫu trả `INSUFFICIENT_BASELINE`.

# 6. Aggregation

- Cộng float32 bằng `double`.
- Year/month/pentad dùng daily range để giữ cùng semantics/provenance cho bbox tùy chỉnh.
- Named areas có thể dùng index/pre-aggregation nếu regression chứng minh bằng daily aggregate.
- Origin period theo Contract §3.5 v0.3: positive contributions; total zero dùng majority cell-day origin.
- Source composition chỉ tính khi endpoint yêu cầu; map list không trả composition mặc định.
- Map summary cộng đúng tập cell của selection; min/max chỉ xét cell available.
- Source composition kỳ phải có cả distinct `cellCount` theo source và `contributingCellDayCount`.

# 7. API mapping

- `/metadata` → `MetadataService`
- `/areas` → `AreaService`
- `/calendar`, `/calendar/days` → `CalendarService`
- `/map/cells` → `MapActivityService`
- `/daily` → `DailyActivityService`
- `/trends` → `TrendService`
- `/seasonality` → `SeasonalityService`
- `/cells/{cellId}/period-details` → `CellPeriodDetailService`
- `/harmonization/comparison` → optional service; không chặn core

# 8. Error mapping

- Bean validation: numeric/date format và primitive bounds.
- Resolver: incomplete/mixed spatial selector; invalid temporal combination.
- Error mapper theo matrix Document 04 §5.1; một HTTP status có thể có nhiều stable `code` nhưng frontend không parse message.
- `NoCellsInBoundsException` → 422 `NO_CELLS_IN_BOUNDS`.
- Outside exact date → 422 `DATE_OUTSIDE_DATASET_RANGE`.
- Dataset exception không lộ filesystem path.

# 9. Performance

Snapshot chỉ có 587 cell × 9.509 ngày. Bbox query dùng immutable arrays hiện có.

- Pre-index cell centers và ID→index.
- Convert selected IDs thành sorted primitive indexes một lần/request.
- Range aggregation đi theo contiguous day-major layout.
- Cache optional theo full normalized query + data/model version; không cache selection thiếu version.
- `ETag` ưu tiên hơn cache immutable dài hạn vì URL không chứa dataVersion.
- Đo annual full-national map và calendar days trước khi công bố p95.

Dev frontend dùng Vite proxy `/api` đến `localhost:8080`. CORS chỉ bật bằng allow-list cấu hình ngoài khi deployment thực sự khác origin.

# 10. Tests

## Repository/Artifact

Giữ toàn bộ suite TASK 03A hiện tại (37 tests sau area repositories) và regression R1–R7.

## Spatial service

- inclusive edge, invalid order, incomplete bbox, mixed selector, empty bbox;
- deterministic 13-cell sample `107,12,108,13`, full-grid bbox 587 cell và bbox cắt nhiều diagnostic regions;
- canonical order và selected bounds.
- selected bounds kiểm envelope hình học, không dùng center envelope.

## Calendar/summary

- 28/29/30/31 days;
- zero available;
- Nov 2026: 13 covered + 17 outside;
- peak tie earliest; all-zero peak null;
- sourceInputValid false không tạo missing.
- target year bị loại khỏi baseline và sample size giảm đúng một khi applicable.

## Map/comparison contract

- date/year/month/pentad exclusivity;
- 2000/2026 year partial;
- same bbox yields same cell IDs across two years;
- compatibility fields đủ để frontend quyết định delta.
- map summary khớp tổng cell và min/max; hai response đủ để FE dựng shared scale.

## Conformance

- Serialize DTO against OpenAPI v0.4.
- Golden examples từ Document 08 được nhúng vào OpenAPI và chạy được với mock server.
- Tolerance aggregate 0,01; cell float probe bit-exact ở repository level.

# 11. Delivery sequence điều chỉnh

1. TASK 03A giữ nguyên: artifact + validated daily repository.
2. Chốt v0.4 và OpenAPI trước khi đổi controller/service surface.
3. TASK 03B1: area geometry + spatial resolver + metadata.
4. TASK 03B2: calendar/map/daily/trends/seasonality services.
5. TASK 03B3: calendar days, summary và cell-period details.
6. TASK 03C: controllers, Problem Details, OpenAPI/golden tests.
7. Frontend tích hợp theo Document 08.

Backend member đang làm theo v0.3 có thể tiếp tục phần không xung đột: metadata, named area, daily aggregation, DTO/error nền. Bbox/year-map/calendar-days chỉ merge sau khi v0.4 được duyệt.

## 11.1. Điều chỉnh repository trước bbox

- Không cần thêm query bbox vào `AreaRepository`: `SpatialSelectionService` lọc 587 cell từ `findAllCells()` theo center-inclusive.
- `AreaActivityRepository` phải nhận resolved arbitrary cell set hoặc domain selection tương đương, không giả bbox thành diagnostic region.
- Cache aggregate phải khóa theo canonical cell IDs thực tế, không chỉ `type + id + cellCount`.
- Source aggregation phải đếm distinct cell theo source bên cạnh cell-day count.
