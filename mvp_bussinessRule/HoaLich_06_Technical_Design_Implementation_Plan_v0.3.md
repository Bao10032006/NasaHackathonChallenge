---
subtitle: Architecture, Implementation Plan & Readiness Checklist
title: HỎA LỊCH
version: v0.3-proposed
updated: 2026-11-14
language: vi
status: proposed architecture after TASK 02B
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 06 · v0.3 PROPOSED**

# 1. Quyết định kiến trúc

Backend là Spring Boot monolith theo n-layer, dùng Java 21, Spring MVC và dataset file-backed. Các tầng chính:

`controller → service interface → service.impl → repository interface → repository.file`

DTO, domain, mapper, configuration và exception là các package hỗ trợ có trách nhiệm riêng. Không dùng JPA/database chỉ để có repository pattern.

# 2. Package structure đề xuất

```text
com.se201411.mvc.backend
├── config
│   ├── DatasetProperties
│   └── DatasetConfiguration
├── controller
│   ├── MetadataController
│   ├── AreaController
│   ├── ActivityController
│   └── MethodologyController
├── dto
│   ├── request
│   │   ├── AreaQuery
│   │   ├── CalendarQuery
│   │   ├── MapCellsQuery
│   │   ├── TrendsQuery
│   │   ├── SeasonalityQuery
│   │   └── DailyQuery
│   └── response
│       ├── MetadataResponse
│       ├── AreaListResponse
│       ├── CalendarResponse
│       ├── MapCellsResponse
│       ├── TrendsResponse
│       ├── SeasonalityResponse
│       ├── DailyResponse
│       └── ProblemResponse
├── domain
│   ├── area
│   ├── activity
│   ├── dataset
│   └── time
├── mapper
│   ├── AreaResponseMapper
│   └── ActivityResponseMapper
├── repository
│   ├── DatasetMetadataRepository
│   ├── AreaRepository
│   ├── CalendarRepository
│   ├── TrendRepository
│   ├── DailyActivityRepository
│   └── file
│       ├── FileDatasetMetadataRepository
│       ├── FileAreaRepository
│       ├── FileCalendarRepository
│       ├── FileTrendRepository
│       └── FileDailyActivityRepository
├── service
│   ├── MetadataService
│   ├── AreaService
│   ├── CalendarService
│   ├── MapActivityService
│   ├── TrendService
│   ├── SeasonalityService
│   ├── DailyActivityService
│   ├── HarmonizationComparisonService
│   └── impl
│       ├── MetadataServiceImpl
│       ├── AreaServiceImpl
│       ├── CalendarServiceImpl
│       ├── MapActivityServiceImpl
│       ├── TrendServiceImpl
│       ├── SeasonalityServiceImpl
│       ├── DailyActivityServiceImpl
│       └── HarmonizationComparisonServiceImpl
└── exception
    ├── ApiExceptionHandler
    ├── InvalidQueryException
    ├── AreaNotFoundException
    ├── UnsupportedQueryException
    └── DatasetUnavailableException
```

Không bắt buộc tách mọi record/class vào file/package nhỏ nếu không giúp rõ trách nhiệm. Package tree trên là ranh giới dependency, không phải chỉ tiêu số lượng class.

# 3. Dependency rules

- Controller chỉ phụ thuộc service interface, request/response DTO và validation; không biết CSV/JSON/NPZ.
- Service interface mô tả use case, không chứa chi tiết file hoặc Spring MVC.
- `service.impl` điều phối repository, business rule, baseline, missing/partial và mapper.
- Repository interface trả domain model/query result, không trả API response DTO.
- `repository.file` là nơi duy nhất hiểu schema artifact và index file-backed.
- Domain không phụ thuộc controller, DTO hoặc filesystem.
- Mapper chuyển domain/service result sang response DTO; không đọc dataset hoặc tính harmonization.
- Exception handler tạo `application/problem+json` thống nhất.
- Không có dependency ngược từ repository lên service/controller.

# 4. Service interfaces

Service nên là interface với implementation trong `service.impl` vì:

- Tách contract use case khỏi cách đọc file.
- Unit test controller/service không cần load dataset thật.
- Cho phép thay derived daily format mà không đổi controller.
- Giữ anomaly hoặc export là module bổ sung, không làm phình một `HoaLichService` duy nhất.

Ví dụ định hướng, chưa phải source code của task này:

```java
public interface DailyActivityService {
    DailyActivityResult getDailyActivity(DailyQuery query);
}
```

Không cần interface cho DTO, immutable domain record, mapper thuần hoặc configuration class. Interface chỉ dùng ở ranh giới có khả năng thay implementation hoặc cần test double.

# 5. Repository boundaries

## 5.1. Metadata và area

- `DatasetMetadataRepository`: snapshot/version/range/model/source definitions/limitations.
- `AreaRepository`: cell list, bounds, region membership và area validation.

## 5.2. Calendar/trends/seasonality

- `CalendarRepository`: month/pentad series theo area/year.
- `TrendRepository`: comparable period theo nhiều năm.
- `SeasonalityServiceImpl`: tính mean/median/sample size từ series đã harmonized; không đọc file trực tiếp.

Không bắt buộc tạo `SeasonalityRepository` riêng nếu toàn bộ dữ liệu đã được `TrendRepository` cung cấp. Tránh interface chỉ chuyển tiếp không có ranh giới dữ liệu thực.

## 5.3. Daily

- `DailyActivityRepository`: query một date và tập cell, trả value, source code, selected input count và validity.
- `DailyActivityServiceImpl`: resolve area, aggregate cell values, tạo source composition/warnings và phân loại origin.
- `MapActivityServiceImpl`: dùng repository month/pentad hoặc daily tùy temporal selector; controller không tự chọn file.

# 6. Daily storage strategy

Không khuyến nghị đọc NPZ trực tiếp trong Spring Boot production vì:

- Java không có NPZ reader chuẩn.
- `cell.npy` trong daily NPZ dùng NumPy object dtype, cần pickle-aware loader.
- Thêm thư viện khoa học chỉ để đọc một artifact làm tăng rủi ro build/deploy.

TASK 03 nên tạo derived artifact bất biến từ snapshot đã hash, không sửa file gốc:

- `daily-manifest.json`: version, SHA-256 nguồn, dates, cells, row-major layout, source dictionary.
- `daily-values.f32`: `9509 × 587` float32 little-endian.
- `daily-source.u8`: source code 1–4.
- `daily-input-count.i16`: raw count của đúng vệ tinh ứng với source code (1→Terra, 2→Aqua, 3→S-NPP, 4→NOAA-20).
- `daily-source-input-valid.bitset` hoặc byte array: cờ hợp lệ của đúng vệ tinh đó (`valid_Terra|valid_Aqua|valid_SNPP|valid_N20` trong NPZ).

Kích thước logic hiện tại cho value + source khoảng 27,9 MB trước compression; thêm input count/validity vẫn phù hợp memory-map hoặc immutable in-memory primitive arrays. Không chuyển daily cube thành CSV 5,58 triệu dòng hoặc JSON lớn.

Derived export phải có script/test riêng, hash input/output và đối chiếu:

- Shape/date/cell mapping.
- Source counts.
- S-NPP direct equality.
- NOAA-20 ratio.
- Daily → month aggregation.
- Ba sample regression được TASK 02B ghi nhận.

# 6A. TASK 03A — phạm vi chi tiết (cập nhật sau review 14/11/2026)

Bổ sung cho §6, áp dụng cho snapshot **pipeline 1.0** (dữ liệu MVP) và phải dùng lại được khi đổi sang pipeline hoàn chỉnh sau MVP mà không sửa code Java.

## 6A.1. Đọc artifact an toàn

- Script xuất đọc NPZ với `allow_pickle=False`. Trong snapshot 1.0, `cell` là mảng object (pickle) nên **không đọc mảng này**; thứ tự cell lấy từ `cells_025.csv` và đối chiếu bằng `lat`/`lon` của NPZ (đã kiểm: khớp toàn bộ 587 cell). Cách này cũng chạy được với các bản sau, nơi `cell` là chuỗi.
- Mảng input count và cờ hợp lệ chọn theo source code của từng cell-day (§6), không lấy cố định một vệ tinh.

## 6A.2. Manifest là nguồn duy nhất cho phiên bản và phạm vi

`daily-manifest.json` (hoặc `dataset-manifest.json` chung) chứa:

- `dataVersion`, `modelVersion`, `dataThrough`, SHA-256 của mọi file nguồn và file xuất.
- `limitations` và các warning mặc định; Java đọc từ manifest, **không viết cứng**.
- **Ma trận partial/transition**: dataset `2000-11-01..2026-11-13`; tháng 11/2026 và pentad 64/2026 là partial; mốc nguồn 2002-08-01 (Terra→Aqua), 2012-01-20 (→S-NPP), 2026-11-02 (S-NPP dừng → NOAA-20).
- `capabilities`: danh sách artifact tùy chọn phát hiện được (ví dụ `calendar_regions_pentad.csv`, `anomaly_regions_pentad.csv` ở các bản pipeline sau). Thiếu artifact tùy chọn không làm startup lỗi.

## 6A.3. Kiểm schema theo cột bắt buộc, không theo số phiên bản

- Bắt buộc: `cells_025.csv`, `harmonized_025_month.csv`, `harmonized_regions_pentad.csv`, `harmonized_national_year.csv`, `uncertainty_table.csv`, `web_cells_pentad.json`, `summary.json`, daily cube (hoặc file xuất của nó).
- Kiểm theo tên cột/khóa cần dùng; cột thừa được bỏ qua.
- Script xuất chạy được trên mọi bản pipeline có cùng tên mảng NPZ (`dates, lat, lon, Terra, Aqua, SNPP, N20, N21, valid_*, harmonized, src_code`).

## 6A.4. Kiểm định của script xuất (bổ sung danh sách §6)

- Ngày liên tục, không NaN, không âm; thứ tự cell khớp `lat`/`lon`.
- Source code đúng theo thời gian: `1` chỉ trước 2002-08, `3|4` chỉ từ 2012-01-20.
- Tổng ngày khớp **cả** bảng tháng **và** bảng pentad — calendar pentad đọc bảng pentad còn map theo ngày đọc cube nên hai đường phải nhất quán. Sai số cho phép theo độ làm tròn của artifact: `harmonized_025_month.csv` và `harmonized_regions_pentad.csv` 0,01; `web_cells_pentad.json` 0,05 (lưu 1 chữ số thập phân). Đã kiểm trên snapshot 1.0: lệch lớn nhất lần lượt 0,005, 0,005 và 0,05.
- `null` trong `web_cells_pentad.json` chỉ nằm ngoài dataset range (snapshot 1.0: 0 null trong range, 41.090 null ngoài range); giá trị `0` trong cube là thật (snapshot 1.0: 3.172.368 / 5.581.783 cell-day).
- Đếm cell-day `src_code=2` từ 2022 (snapshot 1.0: 328 cell-day, 1 ngày năm 2026) để sinh warning `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`.
- Sample regression dùng số thật:
  - `/daily` TayNguyen 2005-03-25: `171.635599`, 122 cell, source AQUA, input 21.
  - `/seasonality` TayNguyen pentad 15, 2003–2025: `sampleSize=23`, `mean=1672.6`, `median=1373.0`.

## 6A.5. Repository phục vụ 03B

- `DailyActivityRepository` thêm truy vấn theo **khoảng ngày** × tập cell (lát cắt liên tục theo layout row-major) để service tính `origin` cho month/pentad (Contract v0.3 §3.5).
- Khi khởi động, dựng sẵn chuỗi tổng hợp cho 6 đơn vị (ToanQuoc + 5 vùng): năm × 73 pentad và năm × 12 tháng. Chi phí nhỏ; giúp 03B làm trends nhiều kỳ, seasonality và các thống kê phân vị mà không cần file mới.
- Không làm anomaly/export; không đổi sang dữ liệu pipeline khác trong 03A.

## 6A.6. Môi trường, lưu trữ và Git

- Script xuất chạy offline bằng Python có ghim phiên bản (`numpy`, `pandas`) do owner snapshot (D06) thực hiện; backend Java không cần Python. Đã kiểm trên Windows với Python 3.15, numpy 2.5.4, pandas 3.1.1.
- File xuất đặt cạnh snapshot dưới `HOALICH_DATASET_ROOT` (tổng khoảng 40 MB, mỗi file < 100 MB) hoặc phát hành kèm hash.
- `.gitattributes` ở gốc repo đánh dấu file nhị phân (`*.npz *.f32 *.u8 *.i16 *.bitset`) là `binary` và `*.csv *.json *.yaml *.md` là `text eol=lf`, để hash không đổi khi checkout trên Windows.

# 7. Loading lifecycle

1. Bind `hoalich.dataset.root`.
2. Resolve exact files dưới dataset root; không dùng absolute path hardcoded.
3. Validate manifest/schema/hash/version trước khi publish repository bean.
4. Load/index artifact core vào immutable primitive collections.
5. Fail startup với lỗi rõ nếu file bắt buộc thiếu/sai schema; không phục vụ zero giả.
6. Không reload giữa request trong MVP. Thay snapshot bằng restart có kiểm soát.

Các repository sau khi khởi tạo phải thread-safe cho read-only concurrent access.

# 8. API layer mapping

| Endpoint | Controller | Service interface |
|---|---|---|
| `/metadata` | `MetadataController` | `MetadataService` |
| `/areas` | `AreaController` | `AreaService` |
| `/calendar` | `ActivityController` | `CalendarService` |
| `/map/cells` | `ActivityController` | `MapActivityService` |
| `/trends` | `ActivityController` | `TrendService` |
| `/seasonality` | `ActivityController` | `SeasonalityService` |
| `/daily` | `ActivityController` | `DailyActivityService` |
| `/harmonization/comparison` | `MethodologyController` | `HarmonizationComparisonService` |

Controller có thể nhóm endpoint cùng resource trong một class; không cần một controller cho từng method nếu class vẫn cohesive.

# 9. Validation and error handling

- Jakarta Validation xử lý format/range đơn giản trên query DTO.
- Service/resolver xử lý cross-field rule: `areaType/areaId`, temporal selector loại trừ nhau, period theo granularity.
- Repository chỉ nhận criteria đã hợp lệ; corruption/missing file chuyển thành domain repository exception.
- `ApiExceptionHandler` ánh xạ về Problem Details code v0.3 và không lộ filesystem path.

# 10. Testing strategy

- Controller slice tests dùng mock service interface, xác minh binding/status/problem schema.
- Service unit tests dùng fake repository, xác minh aggregation, origin, source composition, missing/zero/partial.
- Repository contract tests dùng fixture nhỏ có cùng schema với artifact.
- Dataset integration tests chạy trên snapshot v1 cho hash/shape/sample regression.
- OpenAPI conformance tests so DTO serialization và endpoint response với `HoaLich_OpenAPI_v0.3.yaml`.
- Performance test chỉ chạy sau khi derived daily index và repositories hoàn thành.

# 11. Delivery sequence đề xuất

1. **TASK 03A — Dataset manifest and file repositories:** manifest, derived daily export, schema/hash validation, immutable indexes và repository contract tests; phạm vi chi tiết ở §6A.
2. **TASK 03B — Core services:** metadata/area/calendar/map/trends/seasonality/daily services và mappers.
3. **TASK 03C — Controllers and API conformance:** controllers, Problem Details, integration/OpenAPI tests.
4. Frontend integration chỉ dùng contract đã được duyệt và backend conformance tests đã pass.

Không triển khai anomaly/export trong 03A–03C nếu chưa có decision mới.

