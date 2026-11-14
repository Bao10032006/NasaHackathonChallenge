---
subtitle: REST API Specification & Data Contract
title: HỎA LỊCH
version: v0.4-proposed
updated: 2026-11-14
language: vi
status: frontend-aligned proposal; backend approval pending
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 04 · v0.4 PROPOSED**

# 1. Trạng thái và compatibility

v0.4 mở rộng use case từ v0.3; không ghi đè Artifact Spec 1.0.0 hoặc kết quả TASK 03A. API vẫn read-only tại `/api/v1`, Spring MVC, không chạy harmonization trong request và không trả raw detection points.

Request v0.3 tiếp tục được hỗ trợ nơi có cùng semantics. Response v0.4 có thay đổi có chủ đích (`selection`, `coverage`, typed summary) so với draft v0.3, nên v0.4 là baseline mới sau khi được ký duyệt, không được mô tả là hoàn toàn additive.

Thay đổi chính:

- Bounding-box spatial selector dùng chung.
- Year-only selector cho `/map/cells`.
- `GET /calendar/days`.
- Selection, coverage và summary schema.
- `GET /cells/{cellId}/period-details`.
- `OUTSIDE_DATASET_RANGE` và `NO_CELLS_IN_BOUNDS`.
- `/harmonization/comparison` chuyển thành Optional.

# 2. Snapshot và metric

- `dataVersion=hoalich-data-v1-2026-11-13`
- `modelVersion=lai-clim-s2-k60-kappa3`
- date range `2000-11-01..2026-11-13`
- 587 cell, grid 0,25°, canonical order từ `cells_025.csv`
- `metric=snpp_eq`
- `unit=S-NPP-equivalent daytime detections`
- `timeZone=UTC`

Daily origin/code giữ nguyên Artifact Spec 1.0.0: Terra/Aqua model-redistributed, S-NPP direct, NOAA-20 scaled. `MIXED` chỉ dùng cho aggregate có nhiều origin.

# 3. Spatial selector

## 3.1. Named area

`areaType=national|diagnostic_region|cell` cùng `areaId` hợp lệ.

## 3.2. Bounding box

Bốn query parameter phải xuất hiện cùng nhau:

- `west`, `east`: `[-180,180]`, `west < east`.
- `south`, `north`: `[-90,90]`, `south < north`.

Không gửi đồng thời named area và bbox. Cell được chọn khi center nằm trong hoặc trên biên. Bbox được đối chiếu với toàn bộ 587 cell, không giới hạn theo diagnostic region và có thể chọn cell thuộc nhiều vùng. Backend không tự đảo hoặc clamp input.

Bbox bao phủ toàn bộ extent lưới trả đủ 587 cell. Bbox chỉ giao một phần extent trả các cell có tâm nằm trong khung; phần khung nằm ngoài extent không tạo cell giả.

Không có cell → `422 NO_CELLS_IN_BOUNDS`.

## 3.3. Selection response

Mọi analytical response có:

```json
{
  "selection": {
    "type": "BOUNDING_BOX",
    "selectionRule": "CENTER_INCLUSIVE",
    "requestedBounds": {"west":107.0,"south":12.0,"east":108.0,"north":13.0},
    "selectedBounds": {"west":107.0,"south":12.0,"east":108.0,"north":13.0},
    "cellCount": 13,
    "cellIds": ["48_428","48_429","48_430"]
  }
}
```

Named area dùng `type=NAMED_AREA`, thêm `area`, không có `requestedBounds`. `cellIds` luôn theo canonical grid order.

`selectedBounds` là bounding box nhỏ nhất bao phủ **toàn bộ hình học** của các cell được chọn: `west=min(cell.west)`, `south=min(cell.south)`, `east=max(cell.east)`, `north=max(cell.north)`. Đây không phải envelope chỉ bao các tâm cell. Với fixture trên, center envelope là `107.125..107.875 × 12.125..12.875`, còn `selectedBounds` là `107..108 × 12..13`.

# 4. Value, coverage và summary

## 4.1. Value status

- `AVAILABLE`: numeric value, kể cả `0`.
- `MISSING`: thiếu bất thường bên trong supported range; `value=null`.
- `OUTSIDE_DATASET_RANGE`: item của response dạng series có requested period không giao với dataset range; `value=null`.
- `INSUFFICIENT_BASELINE`: không đủ mẫu; statistic value null.

Quy tắc áp dụng cho item của `/calendar`, `/calendar/days` và `/trends`. Nếu period giao dataset nhưng chưa đủ ngày thì item là `AVAILABLE`, mang coverage `partial=true`; nếu không giao ngày nào thì là `OUTSIDE_DATASET_RANGE`. `/daily` và `/map/cells?date=` không trả placeholder outside-range; trả `422 DATE_OUTSIDE_DATASET_RANGE`.

## 4.2. Coverage

```json
{
  "requestedStartDate":"2026-11-01",
  "requestedEndDate":"2026-11-30",
  "coveredStartDate":"2026-11-01",
  "coveredEndDate":"2026-11-13",
  "expectedDayCount":30,
  "coveredDayCount":13,
  "uncoveredDayCount":17,
  "partial":true
}
```

Nếu không có ngày covered, `coveredStartDate` và `coveredEndDate` là null. `sourceInputValid=false` không làm giảm `coveredDayCount`.

## 4.3. Summary

- Calendar month/pentad của năm dùng `CalendarSummary`: `totalValue`, `valueStatus`, `coverage`, `peakPeriod`.
- Calendar days dùng `DailyCalendarSummary`: `totalValue`, `valueStatus`, `coverage`, `peakDate`.
- Map dùng `MapSummary`: `totalValue`, `valueStatus`, `origin`, `coverage`, `minCellValue`, `maxCellValue`.
- Daily: chính value + source composition là summary của ngày.

Không dùng field chung `peak`. `peakPeriod` và `peakDate` là hai schema riêng để client sinh type không phải suy luận field tùy chọn. `partial` chỉ nằm trong `coverage`, không lặp ở summary.

Peak chỉ xét child item `AVAILABLE` và không partial. Tie lấy thời điểm sớm nhất. Nếu không có item hợp lệ hoặc mọi item hợp lệ bằng zero, peak null. Parent period partial vẫn có thể trả peak trong covered range; UI phải hiển thị coverage cùng peak. `minCellValue`/`maxCellValue` chỉ xét cell `AVAILABLE`; frontend lấy min/max của hai map response để dựng shared color scale.

# 5. Metadata và lỗi

`meta` giữ schema v0.3 với version/metric/unit/timeZone/warnings.

Problem Details dùng `application/problem+json`. Codes:

- `400 INVALID_PARAMETER`
- `400 INVALID_SPATIAL_SELECTOR`
- `400 INVALID_TEMPORAL_SELECTOR`
- `400 INVALID_BOUNDS`
- `404 AREA_NOT_FOUND`
- `404 CELL_NOT_FOUND`
- `422 NO_CELLS_IN_BOUNDS`
- `422 UNSUPPORTED_QUERY`
- `422 DATE_OUTSIDE_DATASET_RANGE`
- `503 DATASET_UNAVAILABLE`
- `500 INTERNAL_ERROR`

## 5.1. Error mapping bắt buộc

| Trường hợp | HTTP | `code` |
|---|---:|---|
| Sai kiểu/format/range primitive, ví dụ month=13 | 400 | `INVALID_PARAMETER` |
| Thiếu `areaType` hoặc `areaId`; bbox thiếu một hay nhiều cạnh; vừa named area vừa bbox | 400 | `INVALID_SPATIAL_SELECTOR` |
| `west >= east`, `south >= north` hoặc tọa độ ngoài domain | 400 | `INVALID_BOUNDS` |
| Không có hoặc trộn temporal selector; gửi cả month và pentad; date cùng year | 400 | `INVALID_TEMPORAL_SELECTOR` |
| Named area không tồn tại | 404 | `AREA_NOT_FOUND` |
| Cell ID không tồn tại | 404 | `CELL_NOT_FOUND` |
| Bbox hợp lệ nhưng không chọn được cell | 422 | `NO_CELLS_IN_BOUNDS` |
| Query hợp lệ về cú pháp nhưng feature/range chưa được hỗ trợ | 422 | `UNSUPPORTED_QUERY` |
| Exact date nằm ngoài dataset range | 422 | `DATE_OUTSIDE_DATASET_RANGE` |
| Artifact/manifest bắt buộc thiếu hoặc không hợp lệ | 503 | `DATASET_UNAVAILABLE` |
| Lỗi không dự kiến | 500 | `INTERNAL_ERROR` |

Frontend điều khiển state theo `code`, không parse `detail`.

# 6. Endpoints

## 6.1. `GET /metadata`

Giữ các field v0.3 và bổ sung capabilities. Response bắt buộc có:

- `dateRange`, `yearRange`, `gridDegrees`;
- `supportedGranularities` theo endpoint;
- `daily.available=true`, `daily.uncertaintyIntervalAvailable=false`, qualification;
- source-code dictionary, limitations và `warningCatalog` ánh xạ warning code sang câu hiển thị;

- spatial selectors `NAMED_AREA|BOUNDING_BOX`;
- map granularities `day|year|month|pentad`;
- `calendarDaysAvailable=true`;
- `rawDetectionPointsAvailable=false`;
- comparison rules và optional feature statuses.

## 6.2. `GET /areas`

Giữ v0.3. Cell trả `id`, center, bounds, region. National và 5 diagnostic regions có `name` tiếng Việt ổn định: `Toàn quốc`, `Đồng bằng sông Cửu Long`, `Đồng bằng sông Hồng`, `Khu vực khác`, `Tây Bắc`, `Tây Nguyên`. Endpoint này không resolve bbox; analytical endpoint tự trả `selection`.

## 6.3. `GET /calendar`

Query:

- một spatial selector;
- `year`;
- `granularity=month|pentad`;
- baseline params tương thích v0.3.

Response có 12 hoặc 73 values, selection, summary, baseline tùy chọn và meta. Mỗi value có period/start/end/value/status/partial/origin/coverage. Item có zero overlap với dataset dùng `OUTSIDE_DATASET_RANGE`; item có overlap chưa đủ dùng `AVAILABLE` + `coverage.partial=true`.

Khi `includeBaseline=true`, median dùng các năm trong `[baselineStartYear,baselineEndYear]` có period đầy đủ. Nếu target `year` nằm trong khoảng này thì luôn loại target year để tránh tự so sánh; response đặt `excludesTargetYear=true`. Missing/partial bị loại, zero hợp lệ được giữ, minimum sample size là 5.

## 6.4. `GET /calendar/days` — mới

Query:

- một spatial selector;
- `year`, `month`.

Response luôn có đúng số ngày dân lịch của tháng. Ví dụ dưới đây là excerpt rút gọn của `values`; response thật vẫn có đủ 30 item:

```json
{
  "year":2026,
  "month":11,
  "values":[
    {"date":"2026-11-13","value":0.0,"valueStatus":"AVAILABLE","origin":"SCALED_OBSERVATION"},
    {"date":"2026-11-14","value":null,"valueStatus":"OUTSIDE_DATASET_RANGE","origin":null}
  ],
  "summary": {
    "totalValue":3.185015,
    "valueStatus":"AVAILABLE",
    "peakDate":{"date":"2026-11-09","value":1.979063},
    "coverage":{"requestedStartDate":"2026-11-01","requestedEndDate":"2026-11-30","coveredStartDate":"2026-11-01","coveredEndDate":"2026-11-13","expectedDayCount":30,"coveredDayCount":13,"uncoveredDayCount":17,"partial":true}
  },
  "selection":{},
  "meta":{}
}
```

Với cùng selection/date, available item phải khớp `/daily` và tổng cells của `/map/cells?date=` trong tolerance 0,01.

## 6.5. `GET /map/cells`

Spatial selector: named area, bbox, hoặc bỏ trống để giữ hành vi v0.3 mặc định national.

Đúng một temporal selector:

1. `date`; hoặc
2. `year` độc lập; hoặc
3. `year+month`; hoặc
4. `year+pentad`.

Không gửi `month` và `pentad` đồng thời. `year` độc lập không được suy thành thiếu month/pentad.

Response:

- typed `temporalSelector` với requested/effective range và coverage;
- selection;
- `summary` gồm aggregate toàn selection, origin, coverage và min/max cell value;
- ordered cells `{cellId,center,bounds,value,valueStatus,partial,origin,...}`;
- meta.

Date bổ sung sourceCode/source/input count/validity. Year/month/pentad aggregate origin từ daily composition. Source composition chi tiết của period dùng endpoint cell details.

## 6.6. `GET /daily`

Query: `date`, một spatial selector, `includeCells=false|true`.

Giữ semantics v0.3; response thay `area` bắt buộc bằng `selection`, đồng thời giữ `area` tùy chọn cho named area để tương thích client. Bbox aggregate source composition trên đúng selected cell set.

## 6.7. `GET /trends`

Query: spatial selector, `startYear`, `endYear`, `granularity=year|month|pentad`, `period?`.

Giữ v0.3 và thêm selection. Month/pentad yêu cầu period; year cấm period. Không có daily trend.

## 6.8. `GET /seasonality`

Query: spatial selector, `granularity=month|pentad`, reference range mặc định 2003–2025.

Giữ mean/median/sample size, loại missing/partial, minimum sample size 5. Khi statistic dùng để so với một target year nằm trong reference range, loại target year và công bố quy tắc; seasonality thuần không có target year thì dùng toàn bộ reference range. Tổng theo mùa chưa thuộc v0.4.

## 6.9. `GET /cells/{cellId}/period-details` — mới

Query dùng đúng một temporal selector như map. `cellId` phải thuộc snapshot; không cần bbox.

Response:

- cell metadata;
- typed temporal selector và coverage;
- value/status/origin;
- source composition gồm source code, source, origin, `cellCount`, contributing cell-day count, harmonized value, input observation count, source-input-valid count;
- meta.

Endpoint không trả raw detection coordinates/timestamps.

## 6.10. `GET /harmonization/comparison` — Optional

Giữ contract v0.3 để dùng cho methodology nếu đội chọn triển khai. Không nằm trong Definition of Done luồng demo v0.4. Nguồn và cách đọc dữ liệu vẫn nằm trong `/metadata` và UI Data Notes.

# 7. Dual-map comparison

Không thêm endpoint comparison riêng. Frontend gọi map hai lần.

Frontend chỉ tính delta khi:

- `meta.dataVersion`, `modelVersion`, metric và unit giống nhau;
- `selection.cellIds` giống nhau cả thứ tự;
- hai temporal selectors có cùng effective duration và đều không partial;
- cả hai cell values `AVAILABLE`.

Nếu không tương thích, vẫn hiển thị hai map và đặt `differenceAvailable=false` cùng reason local (`VERSION_MISMATCH`, `CELL_SET_MISMATCH`, `COVERAGE_MISMATCH`, `VALUE_UNAVAILABLE`).

# 8. Frontend integration rules

- Không suy missing từ value zero.
- Outside-range calendar item có null và không click sang exact-date API.
- Map marker là grid-cell center, không phải raw hotspot.
- Dùng stable codes/status, không parse `detail` để điều khiển UI.
- Cache key gồm endpoint, mọi spatial/temporal param và version.
- Cell source details tải on-demand.
- Daily model/scaled/direct copy giữ đúng v0.3.
- OpenAPI examples là mock fixture chuẩn; frontend không lấy golden value làm production constant.
- Dev mặc định dùng Vite proxy `/api` → backend `http://localhost:8080`; nếu chạy khác origin không qua proxy, backend dùng allow-list CORS externalized, không dùng wildcard credentials.
- Snapshot response có thể dùng `ETag` theo normalized query + data/model version. Không đặt cache immutable dài hạn trên URL không mang version vì deployment có thể đổi snapshot.
- v0.4 luôn trả `center` và `bounds` trong map cell. Tùy chọn `includeGeometry=false` chỉ xem xét sau khi đo payload; không thêm biến thể response trước khi có nhu cầu thực tế.

# 9. Compatibility và phê duyệt

Các request v0.3 có cùng semantics vẫn hợp lệ. Response v0.4 thay `area` bắt buộc bằng `selection` ở một số endpoint và chuẩn hóa summary, nên đây là controlled contract revision trước khi có client production, không phải thay đổi hoàn toàn additive. `/calendar/days` và cell-period details là route mới. Spatial selector cross-field và year-only map phải có contract tests trước frontend integration.

v0.4 chưa được xem là implementation baseline cho đến khi Backend và Frontend ký duyệt OpenAPI v0.4. Binary artifact TASK 03A không đổi; repository chỉ cần enhancement có kiểm soát cho arbitrary cell set, exact cache key và distinct source-cell count.
