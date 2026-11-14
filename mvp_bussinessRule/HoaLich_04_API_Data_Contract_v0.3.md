---
subtitle: REST API Specification & Data Contract
title: HỎA LỊCH
version: v0.3-proposed
updated: 2026-11-14
language: vi
status: proposed for approval after TASK 02B
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 04 · v0.3 PROPOSED**

# 1. Trạng thái và phạm vi

Tài liệu này là đề xuất thay thế Document 04 v0.2 sau khi TASK 02B đã kiểm tra trực tiếp `cube_daily_day_veg.npz`, pipeline sinh dữ liệu và các artifact tổng hợp. v0.2 không bị ghi đè.

API là read-only, base path `/api/v1`, chạy trên Spring Boot MVC. API không chạy lại harmonization trong request và không trả danh sách hotspot gốc.

Các thay đổi v0.3 là additive:

- Thêm `GET /seasonality` để contract hóa yêu cầu seasonality vốn chưa có endpoint riêng.
- Thêm `GET /daily` cho một ngày cụ thể với provenance đúng cấp cell-day.
- Cho phép temporal selector `date` trên `GET /map/cells`.
- Giữ `/calendar` ở `month|pentad`; không thêm `granularity=day`.
- Chuẩn hóa Problem Details và validation giữa các endpoint.
- Hoãn `/anomalies` và `/export.csv` khỏi contract được khuyến nghị phê duyệt.

# 2. Bằng chứng dữ liệu dùng để chốt contract

Daily NPZ đã được kiểm tra trực tiếp:

- SHA-256: `CE62F017494B758B4A6A8CFE889601E1974DC3C4BB10113CD1E1B8A901900B93`.
- 9.509 ngày liên tục từ `2000-11-01` đến `2026-11-13`.
- 587 cell theo đúng thứ tự `cells_025.csv`; `lat` và `lon` khớp chính xác.
- Shape của các ma trận ngày: `[9509, 587]`.
- `harmonized` là `float32`, hữu hạn, không âm, không có NaN; `src_code` là `int8` với code 1–4.
- `src_code=3`: `harmonized` bằng chính xác số đếm S-NPP của cell-day.
- `src_code=4`: NOAA-20 được chia tỷ số `1.0106`.
- `src_code=1|2`: kết quả mô hình Terra/Aqua cấp tháng được phân bổ xuống ngày bằng Aqua ngày và profile khí hậu S-NPP, `kappa=3`.
- Tổng ngày theo cell-tháng khớp 183.731 dòng `harmonized_025_month.csv` sau làm tròn 0,01.

Daily data đủ để phục vụ một màn khám phá ngày có qualification, nhưng không đủ căn cứ để gọi mọi giá trị là “số hotspot đo trực tiếp trong ngày”. Không có khoảng bất định riêng ở cấp ngày và validation phát hành chỉ rõ đến cấp pentad/tháng.

# 3. Quy ước chung

## 3.1. Định danh snapshot đề xuất

- `dataVersion`: `hoalich-data-v1-2026-11-13`.
- `modelVersion`: `lai-clim-s2-k60-kappa3`.
- `metric`: `snpp_eq`.
- `displayName`: `Số phát hiện tương đương S-NPP`.
- `unit`: `S-NPP-equivalent daytime detections`.
- `timeZone`: `UTC`; đối với các phát hiện ban ngày trong snapshot Việt Nam, ngày UTC trùng ngày địa phương theo tài liệu handoff.

Hai version string trên là canonical ID được đề xuất cho API; artifact v1 chưa chứa sẵn hai string canonical này.

## 3.2. Area

- `areaType = national | diagnostic_region | cell`.
- `national` chỉ chấp nhận `areaId=ToanQuoc`.
- `diagnostic_region` chấp nhận `DBSCL | DBSH | TayNguyen | TayBac | Khac`.
- `cell` chấp nhận một ID có trong `cells_025.csv`, định dạng `cy_cx`.
- Vùng chẩn đoán không phải ranh giới hành chính.

## 3.3. Missing, zero và partial

- Giá trị `0` là giá trị có thật trong artifact; không đổi thành `null`.
- Missing dùng `value=null` và `valueStatus=MISSING`.
- `partial=true` chỉ khi period tổng hợp chưa đủ ngày theo dataset range/manifest.
- Source gap được vá bằng nguồn khác hoặc mô hình không phải `MISSING`; provenance phải thể hiện bằng `origin` và source composition.
- Lỗi đọc dataset không được trả response 200 với giá trị `0`.

## 3.4. Daily origin

| `src_code` | `source` | `origin` | Ý nghĩa |
|---:|---|---|---|
| 1 | `TERRA` | `MODEL_REDISTRIBUTED` | Terra → Aqua → S-NPP ở cấp tháng, sau đó phân bổ xuống ngày. |
| 2 | `AQUA` | `MODEL_REDISTRIBUTED` | Aqua → S-NPP ở cấp tháng, sau đó phân bổ xuống ngày; cũng dùng cho fallback. |
| 3 | `SNPP` | `DIRECT_OBSERVATION` | Số đếm S-NPP ban ngày trực tiếp tại cell-day. |
| 4 | `NOAA20` | `SCALED_OBSERVATION` | Số đếm NOAA-20 tại cell-day chia `1.0106`. |

`MIXED` chỉ dùng cho tổng area khi các cell sử dụng nhiều origin trong cùng ngày. Không suy source theo tháng từ nhãn `src` tổng hợp.

## 3.5. Origin cho month/pentad (bổ sung sau review 14/11/2026)

Vision v0.2 §6.1 (Must) yêu cầu phân biệt dữ liệu ước lượng với dữ liệu quan sát. Vì vậy mỗi giá trị tháng/pentad có `valueStatus=AVAILABLE` trong `/calendar`, `/trends` và `/map/cells` (selector month/pentad) phải kèm `origin`:

- Tính từ daily cube: lấy các ngày thuộc period (giao với dataset range) và các cell thuộc area/cell, cộng `harmonized` theo từng `src_code`.
- Nếu toàn bộ giá trị dương của period đến từ một origin → trả origin đó (`DIRECT_OBSERVATION`, `SCALED_OBSERVATION` hoặc `MODEL_REDISTRIBUTED`).
- Nếu có nhiều origin → `MIXED`.
- Nếu tổng period bằng `0` → lấy origin của số ô-ngày chiếm đa số (để giá trị 0 vẫn biết là 0 quan sát hay 0 ước lượng).
- Không dùng nhãn `src` tổng hợp của bảng tháng/pentad (nhãn đó là nguồn đa số toàn quốc, không phải của area).
- Period có ngày `src_code=1` còn phải mang warning `TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY`.

`origin` là trường thêm mới, không phá client v0.2. Chi tiết nguồn theo từng ngày vẫn chỉ có ở `/daily`.

# 4. Response metadata

Mọi response dữ liệu chứa:

```json
{
  "meta": {
    "dataVersion": "hoalich-data-v1-2026-11-13",
    "modelVersion": "lai-clim-s2-k60-kappa3",
    "dataThrough": "2026-11-13",
    "metric": "snpp_eq",
    "unit": "S-NPP-equivalent daytime detections",
    "timeZone": "UTC",
    "warnings": []
  }
}
```

`warnings` là array mã ổn định; frontend ánh xạ mã sang copy phù hợp. Các mã ban đầu:

- `PARTIAL_PERIOD`
- `TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY`
- `MODEL_REDISTRIBUTED_DAILY_VALUE`
- `NO_DAILY_UNCERTAINTY_INTERVAL`
- `DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY`
- `DATASET_EDGE_DATE`
- `AQUA_FALLBACK_AFTER_ORBIT_DRIFT` — có cell-day `src_code=2` từ năm 2022 trở đi (Aqua dự phòng khi cả S-NPP lẫn NOAA-20 không hợp lệ, trong giai đoạn quỹ đạo Aqua đã trôi). Snapshot v1: chỉ 1 ngày năm 2026 (328 cell-day).

# 5. Error contract

Content type lỗi: `application/problem+json`.

```json
{
  "type": "https://hoalich.vn/problems/invalid-parameter",
  "title": "Invalid request parameter",
  "status": 400,
  "code": "INVALID_PARAMETER",
  "detail": "month must be between 1 and 12",
  "instance": "/api/v1/map/cells",
  "errors": [
    {
      "field": "month",
      "rejectedValue": 15,
      "message": "must be between 1 and 12"
    }
  ],
  "timestamp": "2026-11-14T10:00:00Z"
}
```

Status/code chuẩn:

- `400 INVALID_PARAMETER`: sai format/range hoặc temporal selector không hợp lệ.
- `404 AREA_NOT_FOUND`: area/cell không có trong snapshot.
- `422 UNSUPPORTED_QUERY`: tổ hợp đúng cú pháp nhưng dataset/endpoint không hỗ trợ.
- `422 DATE_OUTSIDE_DATASET_RANGE`: ngày ngoài `2000-11-01..2026-11-13`.
- `503 DATASET_UNAVAILABLE`: dataset root/file bắt buộc không sẵn sàng.
- `500 INTERNAL_ERROR`: lỗi không dự kiến; không lộ filesystem path/stack trace.

# 6. Core endpoints

## 6.1. `GET /api/v1/metadata`

**Query:** không có.

**Dependency:** `summary.json`, manifest/hash do backend quản lý, danh sách artifact đã validate.

**Response bắt buộc:**

- Version, metric, unit, grid `0.25`, time zone.
- `dateRange`, `yearRange`, `dataThrough`.
- Supported area types và granularities theo endpoint.
- Source code dictionary 1–4.
- Daily qualification và `dailyUncertaintyAvailable=false`.
- Partial period notes cho 2000 và 2026.
- Scientific limitations.

## 6.2. `GET /api/v1/areas`

**Query:** `type? = national | diagnostic_region | cell`.

**Dependency:** `cells_025.csv`.

**Response:** array area. Cell trả `id`, `center`, `bounds`, `diagnosticRegion`; national/region trả `cellCount`. Không gọi diagnostic region là tỉnh/huyện.

**Validation:** enum sai → 400. Không có phân trang vì snapshot hiện chỉ có 587 cell; nếu mở rộng lớn hơn phải version contract.

## 6.3. `GET /api/v1/calendar`

**Query bắt buộc:** `areaType`, `areaId`, `year`, `granularity=month|pentad`.

**Query tương thích v0.2:** `includeBaseline=false|true`, `baselineStartYear?`, `baselineEndYear?`.

**Dependency:**

- Cell/pentad: `web_cells_pentad.json` hoặc `harmonized_cells_pentad.npz`.
- National/region pentad: `harmonized_regions_pentad.csv`.
- Month: `harmonized_025_month.csv`, join `cells_025.csv`; ưu tiên aggregate đã xuất khi có.

**Response:** 12 hoặc 73 `values`, mỗi item có `period`, `startDate`, `endDate`, `value`, `valueStatus`, `partial` và `origin` khi `valueStatus=AVAILABLE` (§3.5). Khi `includeBaseline=true`, thêm baseline median cùng period với reference years/sample size theo quy tắc `/seasonality`.

**Validation:** year trong 2000–2026; không chấp nhận `day`; period ngoài snapshot trả `MISSING`, không tự tạo zero.

## 6.4. `GET /api/v1/map/cells`

**Query bắt buộc:** một area filter tùy chọn và đúng một temporal selector:

1. `date=YYYY-MM-DD`; hoặc
2. `year` + `month`; hoặc
3. `year` + `pentad`.

**Dependency:** daily cube cho `date`; month/pentad artifacts cho selector tương ứng; `cells_025.csv` cho bounds.

**Response:** cell items `{cellId,bounds,value,valueStatus,partial}`. Với `year`+`month` hoặc `year`+`pentad`, bổ sung `origin` theo §3.5. Với `date`, bổ sung `{sourceCode,source,origin,inputObservationCount,sourceInputValid}`.

**Validation:** thiếu selector, nhiều selector đồng thời hoặc thiếu một phần pair → 400. Date ngoài range → 422. Area filter chỉ giảm tập cell; không thay đổi bounds.

## 6.5. `GET /api/v1/trends`

**Query:** `areaType`, `areaId`, `startYear`, `endYear`, `granularity=year|month|pentad`, `period?`.

- `granularity=year`: không nhận `period`.
- `month`: bắt buộc `period=1..12`.
- `pentad`: bắt buộc `period=1..73`.

**Response:** points `{year,period?,value,valueStatus,partial,origin?,coverage?}`; `origin` bắt buộc khi `valueStatus=AVAILABLE` (§3.5). Không hỗ trợ daily trend trong v0.3.

**Dependency:** yearly/national table khi đúng scope; các bảng month/pentad cho region/cell. Không cộng từ dữ liệu đã làm tròn nếu có aggregate chính thức tốt hơn.

## 6.6. `GET /api/v1/seasonality` — mới v0.3

**Query:** `areaType`, `areaId`, `granularity=month|pentad`, `startYear=2003`, `endYear=2025`.

**Response:** một item cho mỗi period gồm (số thật của snapshot v1: `areaType=diagnostic_region`, `areaId=TayNguyen`, `granularity=pentad`, 2003–2025, đọc từ `harmonized_regions_pentad.csv`):

```json
{
  "period": 15,
  "sampleSize": 23,
  "mean": 1672.6,
  "median": 1373.0,
  "valueStatus": "AVAILABLE"
}
```

Lưu ý công bố cùng response hoặc `/metadata`: baseline 2003–2025 gồm 2003–2011 là ước lượng từ Aqua đã hiệu chuẩn và 2012–2025 là S-NPP/NOAA-20; pentad 73 có 6 ngày ở năm nhuận (BR07).

`mean` và `median` dùng các năm đủ dữ liệu của đúng area/period. Missing/partial bị loại theo rule và `sampleSize` tính riêng từng period. `baselineMethod` mặc định cho comparison là `median`; response vẫn trả cả mean và median để frontend trình bày seasonality.

**Validation:** `startYear <= endYear`; khoảng nằm trong snapshot; tối thiểu 5 mẫu để `valueStatus=AVAILABLE`, nếu không trả `INSUFFICIENT_BASELINE` với value null.

## 6.7. `GET /api/v1/daily` — mới v0.3

**Query:** `date`, `areaType`, `areaId`, `includeCells=false|true`.

**Dependency:** `cube_daily_day_veg.npz` hoặc derived daily index có cùng semantics; `cells_025.csv`.

**Response area-level:**

```json
{
  "area": {"type": "diagnostic_region", "id": "TayNguyen"},
  "date": "2005-03-25",
  "metric": "snpp_eq",
  "value": 171.635599,
  "valueStatus": "AVAILABLE",
  "origin": "MODEL_REDISTRIBUTED",
  "partial": false,
  "sourceComposition": [
    {
      "sourceCode": 2,
      "source": "AQUA",
      "origin": "MODEL_REDISTRIBUTED",
      "cellCount": 122,
      "harmonizedValue": 171.635599,
      "inputObservationCount": 21,
      "sourceInputValidCellCount": 122
    }
  ],
  "meta": {
    "dataVersion": "hoalich-data-v1-2026-11-13",
    "modelVersion": "lai-clim-s2-k60-kappa3",
    "dataThrough": "2026-11-13",
    "metric": "snpp_eq",
    "unit": "S-NPP-equivalent daytime detections",
    "timeZone": "UTC",
    "warnings": [
      "MODEL_REDISTRIBUTED_DAILY_VALUE",
      "NO_DAILY_UNCERTAINTY_INTERVAL",
      "DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY"
    ]
  }
}
```

Số trong ví dụ trên được đọc/tính trực tiếp từ snapshot v1, không phải mock. `inputObservationCount=21` là tổng Aqua count đầu vào trong 122 cell, không phải `snpp_eq`.

Khi `includeCells=true`, thêm tối đa các cell thuộc area với fields:

`cellId`, `bounds`, `value`, `valueStatus`, `sourceCode`, `source`, `origin`, `inputObservationCount`, `sourceInputValid`.

**Quy tắc:**

- Area value là tổng `harmonized` của các cell thuộc area.
- Area `origin=MIXED` nếu source composition có nhiều origin.
- Không có `lo90`/`hi90` cấp ngày vì artifact không cung cấp và validation không phê duyệt daily uncertainty.
- Giá trị model redistributed có thể dương dù input count của đúng ngày bằng 0.
- `includeCells=true` không trả raw coordinates/detections.
- Trong dataset range, daily cube không có giá trị thiếu: `valueStatus` luôn là `AVAILABLE`; giá trị `0` (khoảng 57% cell-day của snapshot v1) là giá trị thật. Ngày ngoài range trả `422 DATE_OUTSIDE_DATASET_RANGE`, không trả `MISSING`.
- `partial` của một ngày luôn `false`; ngày cuối `dataThrough` mang warning `DATASET_EDGE_DATE`.
- `inputObservationCount` và `sourceInputValid` lấy theo đúng vệ tinh của `src_code`: 1→Terra, 2→Aqua, 3→S-NPP, 4→NOAA-20.
- Có cell-day `src_code=2` từ 2022 trở đi → thêm warning `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`.

## 6.8. `GET /api/v1/harmonization/comparison`

**Query:** `startYear?`, `endYear?` trong phạm vi bảng quốc gia.

**Dependency:** `harmonized_national_year.csv`, `summary.json` và evidence đã phát hành.

**Response:** các series có `seriesType`, metric/unit riêng, points và explanation key. Không đặt raw merged counts và harmonized values dưới cùng một metric label.

# 7. Optional endpoints

## 7.1. `GET /api/v1/cells/{cellId}` — có thể phê duyệt sau core

Data dependency đã đủ. Endpoint trả cell metadata và một query period tùy chọn; không cung cấp tọa độ hotspot giả. Đây là Should, không chặn frontend core.

## 7.2. `/api/v1/anomalies` — chưa sẵn sàng

Chưa phê duyệt vì thiếu `anomalyMethodVersion`, threshold, minimum sample size và validation/copywriting. Không đăng ký route trong implementation core; không trả classification giả từ delta dương.

## 7.3. `/api/v1/export.csv` — chưa sẵn sàng

Chưa chốt column schema, row limit, filename/version metadata và query size. Có thể thiết kế sau khi các query service core ổn định.

# 8. Frontend integration rules

- Dùng `valueStatus`, không suy missing từ `value==0`.
- Với daily, luôn hiển thị `origin` và warnings gần giá trị; không gọi chung là “hotspot quan sát”.
- `DIRECT_OBSERVATION` chỉ có nghĩa S-NPP count trực tiếp trong snapshot đã lọc, không phải số vụ cháy.
- `MODEL_REDISTRIBUTED` phải dùng copy “ước lượng hài hòa theo ngày”.
- `SCALED_OBSERVATION` phải dùng copy “quan sát NOAA-20 đã quy đổi về S-NPP”.
- Không hiển thị daily confidence interval vì dataset không có interval cấp ngày.
- Map date sử dụng chính date/area filter của `/daily`; không trộn response từ hai snapshot/version khác nhau.
- Cache key phải gồm endpoint, toàn bộ filter, `dataVersion` và `modelVersion`.
- Error UI dùng `code`; `detail` chỉ dùng bổ sung, không parse chuỗi tự do để điều khiển logic.

# 9. Breaking-change assessment

Không có breaking change bắt buộc đối với client v0.2:

- Endpoint và parameter core v0.2 được giữ.
- `/seasonality` và `/daily` là endpoint mới.
- `date` trên `/map/cells` là selector mới; request month/pentad cũ vẫn hợp lệ.
- `/calendar` vẫn chỉ `month|pentad`.
- `origin` trên calendar/trends/map month-pentad (§3.5) là trường thêm mới.
- Error payload được freeze trước khi controller tồn tại, nên chưa phá client implementation thực tế.

Thay đổi hành vi cần frontend biết: `includeBaseline=true` phải theo cùng baseline rule của `/seasonality`; anomaly không nằm trong contract approved v0.3.

# 10. Khuyến nghị phê duyệt

Phê duyệt cho implementation:

- `/metadata`, `/areas`, `/calendar`, `/map/cells`, `/trends`, `/seasonality`, `/daily`, `/harmonization/comparison`.
- Baseline mặc định: median, reference years `2003..2025`, loại missing/partial; sample size theo period.
- Daily với ba origin rõ ràng và không có daily uncertainty interval.

Hoãn anomaly, export và Day View anomaly/trend cho đến khi có validation và decision riêng.

