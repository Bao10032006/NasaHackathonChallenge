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

v0.4 mở rộng v0.3; không ghi đè tài liệu hay code TASK 03A. API vẫn read-only tại `/api/v1`, Spring MVC, không chạy harmonization trong request và không trả raw detection points.

Thay đổi additive chính:

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

# 4. Value, coverage và summary

## 4.1. Value status

- `AVAILABLE`: numeric value, kể cả `0`.
- `MISSING`: thiếu bất thường bên trong supported range; `value=null`.
- `OUTSIDE_DATASET_RANGE`: calendar placeholder ngoài range; `value=null`.
- `INSUFFICIENT_BASELINE`: không đủ mẫu; statistic value null.

`/daily` và `/map/cells?date=` không trả placeholder outside-range; trả `422 DATE_OUTSIDE_DATASET_RANGE`.

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

- Calendar month/pentad của năm: `totalValue`, coverage, `peakPeriod`.
- Calendar days: `totalValue`, coverage, `peakDate`.
- Daily: chính value + source composition là summary của ngày.

Peak chỉ xét child item `AVAILABLE` và không partial. Tie lấy thời điểm sớm nhất. Nếu không có item hợp lệ hoặc mọi item hợp lệ bằng zero, peak null. Parent period partial vẫn có thể trả peak trong covered range; UI phải hiển thị coverage cùng peak.

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

# 6. Endpoints

## 6.1. `GET /metadata`

Giữ v0.3, bổ sung capabilities:

- spatial selectors `NAMED_AREA|BOUNDING_BOX`;
- map granularities `day|year|month|pentad`;
- `calendarDaysAvailable=true`;
- `rawDetectionPointsAvailable=false`;
- comparison rules và optional feature statuses.

## 6.2. `GET /areas`

Giữ v0.3. Cell trả `id`, center, bounds, region. Endpoint này không resolve bbox; analytical endpoint tự trả `selection`.

## 6.3. `GET /calendar`

Query:

- một spatial selector;
- `year`;
- `granularity=month|pentad`;
- baseline params tương thích v0.3.

Response có 12 hoặc 73 values, selection, summary, baseline tùy chọn và meta. Mỗi value có period/start/end/value/status/partial/origin/coverage.

## 6.4. `GET /calendar/days` — mới

Query:

- một spatial selector;
- `year`, `month`.

Response luôn có đúng số ngày dân lịch của tháng:

```json
{
  "year":2026,
  "month":11,
  "values":[
    {"date":"2026-11-13","value":3.0,"valueStatus":"AVAILABLE","origin":"MIXED"},
    {"date":"2026-11-14","value":null,"valueStatus":"OUTSIDE_DATASET_RANGE","origin":null}
  ],
  "summary": {"totalValue":3.0,"peakDate":null,"coverage":{}},
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

Giữ mean/median/sample size, loại missing/partial, minimum sample size 5. Tổng theo mùa chưa thuộc v0.4.

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

# 9. Compatibility và phê duyệt

v0.3 requests vẫn hợp lệ. Trường mới là additive; `/calendar/days` và cell-period details là route mới. Spatial selector cross-field và year-only map phải có contract tests trước frontend integration.

v0.4 chưa được xem là implementation baseline cho đến khi Backend và Frontend ký duyệt OpenAPI v0.4. TASK 03A repository/artifact không cần thay đổi.
