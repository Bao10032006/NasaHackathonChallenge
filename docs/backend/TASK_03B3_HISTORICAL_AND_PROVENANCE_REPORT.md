# TASK 03B3 — Historical Analysis & Cell Provenance Report

**Ngày:** 15/11/2026

**Kế hoạch:** [TASK 03B3 — Work Split & Execution Plan](TASK_03B3_WORK_SPLIT_AND_EXECUTION_PLAN.md)

**Kích hoạt:** review backend ngày 15/11/2026. Review ghi nhận 3 API Must v0.4 còn trả 404 và 2 lỗi phản hồi.

## 1. Nhánh và commit

| Nhánh | Commit | Nội dung |
|---|---|---|
| `fix/backend-http-406-and-capability` | `5fe142d` | Sửa 2 lỗi phản hồi từ review |
| `task03b3b/historical-analysis` | `c1dbb6d` | `GET /trends`, `GET /seasonality` |
| `task03b3a/cell-period-provenance` | `f495d41` | `GET /cells/{cellId}/period-details` |
| `task03b3c/integration` | các merge commit + report/README | Tích hợp, verify, smoke test |

Ba nhánh tạo từ `main` tại `a078f94`. Chúng không sửa `ActivityController`, `ActivityService`, `ActivityServiceImpl`, repository, contract, dataset hay frontend. Mỗi API mới có controller, service, mapper và DTO riêng, đúng file ownership của kế hoạch.

## 2. Hai lỗi phản hồi đã sửa

| Lỗi | Trước | Sau |
|---|---|---|
| `Accept: text/html` hoặc `application/xml` | `500 INTERNAL_ERROR`: `HttpMediaTypeNotAcceptableException` rơi vào handler tổng | `406 NOT_ACCEPTABLE` (Problem Details) |
| `/metadata` báo `harmonizationComparisonAvailable: true` | Endpoint `/harmonization/comparison` trả 404 | `false`; capability phản ánh khả năng phục vụ của API, không chỉ việc bảng dữ liệu đã nạp |

Test hồi quy: `ContentNegotiationAndCapabilityIntegrationTests` (6 test). Trong đó có một test kiểm tra bất biến “capability bật thì endpoint trả 200, tắt thì trả 404”. Test này vẫn giữ đúng khi về sau triển khai endpoint Optional.

`/harmonization/comparison` vẫn chưa triển khai. Đây là API Optional, nằm ngoài TASK 03B3. Khi thêm endpoint, đổi hằng `HARMONIZATION_COMPARISON_ENDPOINT_IMPLEMENTED` trong `MetadataServiceImpl` trong cùng commit.

## 3. API mới

### `GET /api/v1/trends`

- Một spatial selector (named area hoặc bbox), dùng chung `SpatialSelectionService`.
- `startYear`, `endYear` bắt buộc; phải có `startYear ≤ endYear` và nằm trong phạm vi năm của dataset.
- `granularity=year|month|pentad`. Với `year`, cấm `period`. Với `month`, `period` từ 1–12. Với `pentad`, `period` từ 1–73.
- Mỗi năm một point, sắp tăng dần:
  - Không giao dataset: `value=null`, `OUTSIDE_DATASET_RANGE`, `origin=null`, `partial=false`.
  - Giao một phần: `AVAILABLE`, `partial=true`, cộng trên khoảng ngày đã có dữ liệu.
  - Bằng 0: vẫn là `AVAILABLE`.
  - `origin` lấy từ cơ cấu nguồn thật.
- Cảnh báo theo `warningCatalog`: `PARTIAL_PERIOD`, `TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY`, `DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY`, `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`.

### `GET /api/v1/seasonality`

- `granularity=month|pentad`. Khoảng tham chiếu mặc định 2003–2025, có thể truyền `startYear`/`endYear`.
- Trả 12 hoặc 73 period theo thứ tự tăng dần.
- Loại kỳ thiếu dữ liệu, ngoài phạm vi và chưa đủ ngày. Giữ giá trị 0.
- `sampleSize` là số năm thực sự được dùng.
- Mean tính bằng `double`. Median: số mẫu lẻ lấy phần tử giữa, số mẫu chẵn lấy trung bình hai phần tử giữa.
- Dưới 5 mẫu: `mean` và `median` là `null`, trạng thái `INSUFFICIENT_BASELINE`.
- Không loại năm mục tiêu, vì seasonality thuần không có năm mục tiêu.

### `GET /api/v1/cells/{cellId}/period-details`

- Đúng một temporal selector, theo cùng quy tắc với `/map/cells`.
- Mã lỗi:

  | Trường hợp | Phản hồi |
  |---|---|
  | `cellId` sai dạng `^[0-9]+_[0-9]+$` | `400 INVALID_PARAMETER` |
  | Ô không tồn tại | `404 CELL_NOT_FOUND` |
  | Ngày cụ thể ngoài dataset | `422 DATE_OUTSIDE_DATASET_RANGE` |

- Kỳ không giao dataset: `value=null`, `OUTSIDE_DATASET_RANGE`, `origin=null`, `sourceComposition=[]`.
- Cơ cấu nguồn đủ 8 field của OpenAPI.
- Không trả tọa độ hay thời điểm detection gốc.
- Cảnh báo dùng cùng ngữ nghĩa với ô tương ứng của `/map/cells`.

## 4. Golden value

Tính độc lập bằng numpy, đọc trực tiếp `derived/daily-values.f32`, `daily-source.u8`, `daily-input-count.i16` và `daily-source-input-valid.u8`, cộng bằng float64. Dung sai trong test là `1e-4`.

| Truy vấn | Giá trị |
|---|---|
| Bbox 107,12,108,13 (13 ô), tháng 3/2005 | 3039.161190, `MODEL_REDISTRIBUTED` |
| Bbox, tháng 3/2024 | 450.0, `DIRECT_OBSERVATION` |
| Bbox, năm 2024 | 2182.780156 |
| Bbox, năm 2000 (đã có dữ liệu 1/11–31/12) | 76.883103, `partial=true` |
| Seasonality bbox, tháng 3, 2003–2025 | n = 23, mean 1405.899386, median 1202.0 |
| Seasonality bbox, tháng 8 | mean 2.973882, median 1.176552 |
| Seasonality bbox, pentad 15 | mean 304.907923, median 184.0 |
| Seasonality bbox, tháng 3, 2004–2023 (n chẵn = 20) | median 1206.078039 |
| Ô 51_431, tháng 3/2024 | 78.0; S-NPP 31 ô-ngày, 78 detection đầu vào |
| Ô 51_431, năm 2024 | 499.989531 `MIXED` (S-NPP 345 ô-ngày 499.0 + NOAA-20 21 ô-ngày 0.989531) |
| Ô 51_431, 1–13/11/2026 | 0.014271 từ Aqua, S-NPP và NOAA-20 |
| Ô 40_422, tháng 1/2012 | 0.0 `AVAILABLE` `MODEL_REDISTRIBUTED` (Aqua 19 + S-NPP 12 ô-ngày) |

## 5. Kiểm chứng đã chạy

Môi trường:

- JDK `21.0.12`;
- Maven Wrapper;
- Spring Boot `4.1.2`;
- Windows.

Lệnh:

```powershell
Set-Location backend
& .\mvnw.cmd clean verify
```

Kết quả trên `task03b3c/integration`:

- **152 test, 0 failure, 0 error, 1 skipped.** Test bị bỏ qua vẫn là test symlink, do Windows không cấp quyền tạo symbolic link, giống baseline.
- `BUILD SUCCESS`; package `backend-0.0.1-SNAPSHOT.jar`.
- `git diff --check main...HEAD`: không lỗi.

Test mới:

| Lớp test | Số test |
|---|---:|
| `HistoricalAnalysisControllerIntegrationTests` | 15 |
| `HistoricalAnalysisServiceImplTests` | 5 |
| `CellControllerIntegrationTests` | 11 |
| `ContentNegotiationAndCapabilityIntegrationTests` | 6 |

Smoke test JAR với dataset thật (cổng 8091):

| Yêu cầu | Kết quả |
|---|---|
| `/trends` bbox tháng 3, 2005–2024 | 200; 20 point; 2005 = 3039.16119 `MODEL_REDISTRIBUTED`; 2024 = 450.0 `DIRECT_OBSERVATION` |
| `/trends` Tây Nguyên theo năm, 2003–2026 | 200; 24 point; 2026 `partial=true`; cảnh báo `PARTIAL_PERIOD`, `DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY`, `AQUA_FALLBACK_AFTER_ORBIT_DRIFT` |
| `/trends` tháng 3/2000 | `null`, `OUTSIDE_DATASET_RANGE` |
| `/seasonality` bbox theo tháng | 200; 12 period; tháng 3: n = 23, mean 1405.899…, median 1202.0 |
| `/seasonality` toàn quốc theo pentad | 200; 73 period; khoảng 147 ms |
| `/cells/51_431/period-details` tháng 3/2024 | 200; 78.0 `DIRECT_OBSERVATION`, cơ cấu nguồn đúng golden |
| `/cells/51_431/period-details` tháng 12/2026 | `null`, `OUTSIDE_DATASET_RANGE`, `[]` |
| `/cells/99_999/period-details` | 404 `CELL_NOT_FOUND` |
| `/calendar` bbox 2024, tháng 3 | 450.0; 13 ô, cùng tập ô với `/trends` |
| `/metadata` | `harmonizationComparisonAvailable: false` |
| `/harmonization/comparison` | 404 (khớp capability) |
| `/metadata` với `Accept: text/html` / `application/xml` | 406 |
| Log ứng dụng | 0 dòng `ERROR` |

`CellControllerIntegrationTests` đối chiếu giá trị và origin của cả 13 ô trong bbox mẫu với `/map/cells` cùng kỳ.

## 6. Giới hạn và việc chưa làm

- `/harmonization/comparison` (Optional) chưa triển khai; capability đã chuyển sang `false`.
- Phần backlog analytics trong `docs/HoaLich_analytics_v0.1/DATA_CONTRACT_ANALYTICS.md` (anomaly, events, data-quality…) vẫn là đề xuất `v0.2-draft`, chưa thuộc MVP v0.4.
- Contract không liệt kê `/cells/{cellId}/period-details` trong `appliesTo` của `warningCatalog`. Endpoint dùng cùng mã cảnh báo với ô tương ứng của `/map/cells`. Nếu đội muốn, bổ sung endpoint này vào `appliesTo` ở revision manifest tiếp theo.
- Chưa có JSON Schema validator tự động so response với OpenAPI. Field và kiểu đã được đối chiếu thủ công và qua test JSON path.
