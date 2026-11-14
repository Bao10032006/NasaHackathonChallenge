# TASK 03A — Báo cáo repository vùng, tổng hợp theo vùng và bảng so sánh

- Ngày: 14/11/2026
- Nhánh: `task03a/area-repositories` (tách từ `main` tại `fe271f0`)
- Nền: phần B của TASK 03A (`TASK_03A_BACKEND_REPOSITORY_REPORT.md`) đã đọc được 4 file nhị phân và manifest.
- Phạm vi phần này: phần còn thiếu ở tầng repository để tầng service của API Contract v0.3 có dữ liệu mà dùng.

> **Trạng thái build: CHƯA biên dịch, CHƯA chạy test.** Máy viết code không có JDK 21. Người review cần chạy:
>
> ```powershell
> $env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'
> .\mvnw.cmd clean verify
> ```
>
> Mọi số kỳ vọng trong test đã được tính lại độc lập bằng Python (numpy) trên chính fixture và snapshot trong repo, và đều khớp. Nếu test đỏ, nhiều khả năng lỗi nằm ở cú pháp hoặc kiểu dữ liệu Java chứ không phải ở số kỳ vọng.

## 1. Vì sao cần phần này

Phần B mới cho đọc giá trị theo `(ngày, cell)`. API v0.3 cần thêm:

| Nhu cầu của API | Trước đó | Sau phần này |
|---|---|---|
| Danh sách vùng, cell, biên ô cho bản đồ | chỉ có `cellIds` trong manifest | `AreaRepository` đọc `tables/cells_025.csv` |
| Tổng `ToanQuoc` / vùng chẩn đoán theo khoảng ngày | phải cộng 587 cell × N ngày mỗi request | `AreaActivityRepository`, tính sẵn chuỗi ngày cho toàn quốc và 5 vùng |
| Thành phần nguồn (Terra/Aqua/S-NPP/NOAA-20) cho cảnh báo | không có | `SourceComposition` theo mã nguồn 1–4 |
| Trang phương pháp: so sánh hài hòa với số thô | không có | `HarmonizationComparisonRepository` đọc `tables/harmonized_national_year.csv` |
| Seasonality pentad (R7) | ghi "chưa thuộc repository dữ liệu ngày" | tính từ dữ liệu ngày; test R7 đã có |

## 2. Thành phần mới

**Domain** (record bất biến):

- `domain/area`: `AreaType` (`national`, `diagnostic_region`, `cell`), `CellArea` (tâm + biên ô), `AreaDefinition` (loại, id, danh sách cell; `NATIONAL_ID = "ToanQuoc"`).
- `domain/activity`: `AreaActivitySummary`, `AreaDailySeries`, `SourceComposition`.
- `domain/methodology`: `NationalYearComparison`.

**Interface repository**: `AreaRepository`, `AreaActivityRepository`, `HarmonizationComparisonRepository`.

**File implementation** (`repository/file`):

- `FileAreaRepository`: đọc `grid.cellOrderSource`, kiểm hash qua manifest `sources`, kiểm thứ tự cell khớp `grid.cellIds`. Biên ô = `lat_s`/`lon_w` + `grid.degrees`. Vùng giữ thứ tự xuất hiện đầu tiên trong CSV.
- `FileAreaActivityRepository`: tính sẵn lúc khởi động, cho toàn quốc và từng vùng, tổng mỗi ngày cùng số cell-day, giá trị, input count và số cell-day hợp lệ theo từng mã nguồn. Cell lẻ (hoặc vùng khác) được tính khi có request. Bộ nhớ thêm khoảng 6 MB.
- `FileHarmonizationComparisonRepository`: chỉ đọc bảng khi manifest khai báo nó trong `sources`; nếu không khai báo thì `isAvailable() == false` (fixture rơi vào trường hợp này).
- `SimpleCsvTable`: đọc CSV tối giản (không quote), kiểm cột bắt buộc ngay khi khởi động.
- `DatasetArtifactValidator.resolveDeclaredSource(...)`: tìm file được khai báo trong `sources` rồi kiểm kích thước + SHA-256 trước khi đọc.
- `FileDailyActivityRepository`: thêm accessor mức package (`valueAt`, `sourceCodeAt`, `dateIndexOf`, ...) để tầng tổng hợp không phải tạo object cho từng cell-day.

**Spring**: `DatasetConfiguration` thêm 3 bean, cùng dùng manifest đã kiểm của `FileDailyActivityRepository`. Vẫn fail-fast: CSV sai hash, thiếu cột hay lệch thứ tự cell đều làm context không khởi động.

## 3. Quyết định thiết kế

1. **Cộng từng ngày bằng `double`, không dùng tổng cộng dồn (prefix sum).** Trừ hai tổng cộng dồn lớn làm mất chữ số khi khoảng ngắn nằm cuối chuỗi 26 năm. Cộng thẳng tối đa 9509 phần tử mỗi request vẫn rất nhanh.
2. **Tổng theo tháng/pentad tính từ dữ liệu ngày, không đọc bảng tháng của pipeline.** Ví dụ toàn quốc tháng 3/2012: cộng từ ngày ra `26089.757095`, bảng tháng làm tròn ghi `26089.70`. Một nguồn sự thật giúp bản đồ ngày và biểu đồ tháng không lệch nhau.
3. **Repository không gắn cảnh báo.** `SourceComposition` chỉ đưa số liệu thô; việc đổi thành warning code thuộc tầng service (theo `warningCatalog` trong manifest).
4. **`inputObservationCount` không phải snpp_eq.** Đây là số phát hiện của vệ tinh được chọn, nên service không được hiển thị nó với đơn vị snpp_eq.
5. **Bảng so sánh là capability tùy chọn.** Snapshot thật có khai báo; fixture không có. Service nên ẩn mục so sánh khi `isAvailable()` là false thay vì báo lỗi.

## 4. Thay đổi dữ liệu

- `tools/data/export_daily_artifacts.py`: `SNAPSHOT_SOURCES` thêm `tables/harmonized_national_year.csv` và `tables/uncertainty_table.csv`.
- `dataset-manifest.json` của snapshot được xuất lại bằng `--replace`: **4 file nhị phân giữ nguyên từng byte**, chỉ thêm 2 mục `sources` và đổi `generatedAt`. Exporter chạy lại đủ 15 phép kiểm + R1–R7: PASS.
- `dataVersion` và `modelVersion` không đổi vì dữ liệu và mô hình không đổi.

## 5. Test mới

| File | Nội dung |
|---|---|
| `FileAreaRepositoryFixtureTests` | 4 cell đúng thứ tự; tâm/biên ô `34_419`; vùng `[DBSCL, TayNguyen]`; tra cứu national/vùng/cell; id lạ trả rỗng; ánh xạ `areaType` của API |
| `FileAreaActivityRepositoryFixtureTests` | toàn quốc `428.5` với thành phần 4 nguồn; chuỗi ngày `[157, 257.5, 5, 9]`; TayNguyen ngày 13/11 trộn Aqua 0 + S-NPP 5; DBSCL Terra input không hợp lệ vẫn có giá trị; cell `45_429` tính khi request; tổng vùng cộng lại bằng toàn quốc; ngày ngoài dữ liệu và khoảng đảo bị từ chối |
| `FileHarmonizationComparisonFixtureTests` | fixture không khai báo bảng → unavailable, danh sách rỗng |
| `RealAreaActivityRegressionTests` | 587 cell, 5 vùng (71/33/262/99/122 cell); R1 qua chỉ mục vùng `171.635599`, Aqua 122 cell-day, input 21; R2 toàn quốc `2275.0`, S-NPP 587 cell-day; R7 TayNguyen pentad 15, 2003–2025: trung vị `1373.0`, trung bình `1672.6`; tháng 3/2012 `26089.757095`; bảng so sánh 27 năm (2000–2026), năm 2015 `88898.0 / 14703 / 5440 / 88898 / 124575` |
| `BackendApplicationTests` | thêm kiểm 3 bean mới, bảng so sánh available trên snapshot thật |

Dự kiến tổng: 18 test cũ + 19 test mới = 37 test.

## 6. Việc còn lại cho bước service

- `MetadataService` / `AreaService`: dùng `AreaRepository` cho `/metadata` và `/areas`.
- `ActivityService`: dùng `AreaActivityRepository`, đổi `SourceComposition` thành warning theo `warningCatalog`.
- `AnomalyService`: theo `TASK_03B_ANOMALY_DESIGN_NOTE.md` (baseline 2003–2025 bỏ năm đang xét; median/p10/p90/MAD).
- `MethodologyService`: dùng `HarmonizationComparisonRepository`; luôn ghi rõ cột thô là số phát hiện, không phải snpp_eq.
