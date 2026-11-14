# TASK 03B2A — Activity Query Repository (Người A)

**Ngày:** 14/11/2026

**Người thực hiện:** HoangAnh250 (Người A — Data/Repository)

**Plan:** [TASK 03B2 — Work Split & Execution Plan](TASK_03B2_WORK_SPLIT_AND_EXECUTION_PLAN.md)

**Contract baseline:** OpenAPI/API Contract v0.4 (`af231a3`), Artifact Spec 1.0.0

**Trạng thái:** A0–A3 đã merge vào `main` và kiểm chứng bằng JDK 21. Báo cáo này là A5.

## 1. Kết quả

Backend có một query engine dùng chung cho mọi lựa chọn không gian: named area và bbox đều được service resolve thành danh sách cell ID rồi gọi cùng `ActivityQueryRepository`. Engine hỗ trợ selection tùy ý 1–587 cell, mọi khoảng ngày hợp lệ trong dataset, trả tổng vùng, chuỗi ngày, tổng từng cell và source composition đầy đủ.

Không có blocker cho Người B.

## 2. Commit bàn giao

| Phần | Nội dung | Nhánh | Commit trên `main` |
|---|---|---|---|
| A0 | Interface `ActivityQueryRepository` + `ActivityAggregate`, `ActivityDailySeries`, `CellActivityAggregate` | `task03b2a/activity-query` | `bf86831` (PR #2, merge `93a111f`) |
| A1 | `FileActivityQueryRepository`, delegate `FileAreaActivityRepository`, bean wiring | `task03b2a/a1-file-query` | `ad84aac` |
| A2 | Kiểm provenance của manifest lúc khởi động + test ngữ nghĩa nguồn | `task03b2a/a2-provenance` | `99d3454` (merge `0026c66`) |
| A3 | Test biên: năm nhuận, partial, hai đầu dataset, cache cùng kích thước | `task03b2a/a3-regression-tests` | `13a7fe6` |
| A5 | Báo cáo này | `task03b2a/a5-report` | — |

Tất cả nhánh được giữ trên remote.

## 3. Hướng dẫn dùng cho Người B

### 3.1. Inject

```java
private final ActivityQueryRepository activityQueryRepository;
```

Bean thực tế là `FileActivityQueryRepository`, đăng ký trong `DatasetConfiguration`.

### 3.2. Hợp đồng gọi

- `cellIds`: lấy từ `SpatialSelection` theo canonical order; không rỗng, không `null`/blank, không trùng, mọi ID phải có trong snapshot.
- Khoảng ngày inclusive và **phải nằm trong dataset**. Service clip period với dataset range và tính coverage **trước** khi gọi. Repository không tạo placeholder `OUTSIDE_DATASET_RANGE`.
- Input sai ném `IllegalArgumentException`. Nếu service đã validate/clip đúng thì exception này không xảy ra; nếu có thì đó là lỗi lập trình, không nên trả `0`.
- Giá trị không làm tròn; `0` là giá trị thật.
- `summarize` và `dailySeries` không phụ thuộc thứ tự `cellIds`; `summarizeCells` giữ đúng thứ tự đầu vào.

### 3.3. Ánh xạ sang `SourceComposition` của OpenAPI v0.4

| Domain (`SourceComposition`) | OpenAPI v0.4 | Ghi chú |
|---|---|---|
| `sourceCode` | `sourceCode` | 1 Terra, 2 Aqua, 3 S-NPP, 4 NOAA-20 |
| — | `source`, `origin` | Lấy từ `manifest.sourceCodes()` theo `code`; đã được kiểm khi khởi động (mục 4) |
| `cellCount` | `cellCount` | Số cell phân biệt dùng nguồn ít nhất một lần trong kỳ |
| `cellDays` | `contributingCellDayCount` | Số cell-day dùng nguồn |
| `value` | `harmonizedValue` | Tổng snpp_eq của nguồn |
| `inputObservationCount` | `inputObservationCount` | Số phát hiện của vệ tinh tương ứng; **không phải** snpp_eq |
| `sourceInputValidCellDays` | `sourceInputValidCellCount` | Xem câu hỏi mở 7.1 |

Composition chỉ chứa nguồn có ít nhất một cell-day, sắp tăng dần theo `sourceCode`.

### 3.4. Các mẫu dùng theo endpoint

| Endpoint | Cách gọi |
|---|---|
| `/map/cells?date=` | `summarizeCells(cells, date, date)`: mỗi cell có đúng 1 source; `sourceInputValid = sourceInputValidCellDays == 1` |
| `/map/cells` year/month/pentad | `summarizeCells(cells, clippedStart, clippedEnd)` cho cell; `summarize` cho summary |
| `/calendar` month/pentad | `summarize` cho từng period đã clip; period không giao dataset không gọi repository |
| `/calendar/days` | `dailySeries` cho giá trị; `summarize(cells, d, d)` cho origin từng ngày (31 lần, đo ở mục 5) |
| `/daily` | `summarize(cells, date, date)`; `includeCells=true` thêm `summarizeCells(cells, date, date)` |

### 3.5. Lưu ý khi suy `origin`

- Nguồn có thể xuất hiện trong composition với `value = 0`. Ví dụ bbox golden tháng 11/2026: S-NPP có 13 cell-day với giá trị `0`. Theo Contract §3.5, origin chỉ xét **đóng góp dương**, nên kỳ đó là `MIXED` (Aqua + NOAA-20), không tính S-NPP.
- Khi tổng kỳ bằng `0`, contract dùng origin của đa số cell-day: dùng `cellDays` của composition.
- Giá trị `MODEL_REDISTRIBUTED` có thể dương dù `inputObservationCount = 0` (ví dụ cell `34_420` ngày 25/03/2005).
- Aqua dự phòng sau quỹ đạo trôi: 328 cell-day ngày 06/11/2026; dùng để kích hoạt `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`.

## 4. Thiết kế và thay đổi

### 4.1. `FileActivityQueryRepository` (A1)

- Selection được chuẩn hóa theo canonical cell order trước khi cộng, nên bbox và named area ra cùng tập cell cho kết quả **giống nhau từng bit**, và thứ tự input không làm đổi tổng.
- Bảng per-day (tổng + composition) được tính sẵn cho ToanQuoc và 5 vùng; bất kỳ selection nào trùng đúng tập cell đó cũng dùng lại bảng. Selection khác được tính on-demand bằng cùng phép cộng.
- Cộng float32 bằng `double` theo từng ngày; không dùng prefix-sum; không tạo object cho từng cell-day.
- `FileAreaActivityRepository` (TASK 03A) nay delegate sang engine, nên chỉ còn một thuật toán aggregate.

### 4.2. Provenance (A2)

Bốn file nhị phân được bảo vệ bằng SHA-256 nhưng `dataset-manifest.json` thì không. Vì service đọc nhãn `source`/`origin` từ manifest, khi khởi động backend nay kiểm thêm:

- `source` thuộc `TERRA|AQUA|SNPP|NOAA20` và không trùng; `origin` thuộc `DIRECT_OBSERVATION|SCALED_OBSERVATION|MODEL_REDISTRIBUTED`;
- `firstDate`/`lastDate` là ngày ISO hợp lệ, không đảo ngược;
- `cellDays`, `firstDate`, `lastDate` của từng code **khớp với `daily-source.u8`**.

Sai bất kỳ điểm nào → `DatasetUnavailableException`, context không khởi động (fail-fast). Snapshot thật và fixture `daily-mini` đều đạt.

### 4.3. File đã thay đổi

Trong phạm vi Người A:

- `repository/ActivityQueryRepository.java` (mới);
- `domain/activity/ActivityAggregate.java`, `ActivityDailySeries.java`, `CellActivityAggregate.java` (mới);
- `repository/file/FileActivityQueryRepository.java` (mới);
- `repository/file/FileAreaActivityRepository.java` (delegate);
- `repository/file/DatasetArtifactValidator.java`, `FileDailyActivityRepository.java` (kiểm provenance);
- `config/DatasetConfiguration.java` (bean engine);
- test trong `src/test/.../repository/file/`.

Không thay đổi controller, service, DTO, mapper, OpenAPI/Contract, dataset, script export hoặc frontend.

## 5. Hiệu năng (đo thực tế)

Benchmark tạm (không commit) trên snapshot thật: 3 lần warm-up, 20 lần đo mỗi kịch bản. Máy: AMD Ryzen 7 H 255, Windows 11, Oracle JDK 21.0.12, `-Xmx1g`.

| Kịch bản | Median | p95 |
|---|---:|---:|
| Khởi động: mở + kiểm 4 file nhị phân | 611 ms (một lần) | — |
| Khởi động: tính sẵn 6 vùng | 113 ms (một lần) | — |
| `summarize` toàn quốc 9.509 ngày (bảng tính sẵn) | 6,2 ms | 7,2 ms |
| `summarize` bbox 500 cell 9.509 ngày (on-demand) | 27,5 ms | 30,3 ms |
| `summarizeCells` 587 cell năm 2024 (annual map) | 6,0 ms | 6,1 ms |
| Calendar pentad 73 × 24 năm, bbox 500 cell (1.752 lần `summarize`) | 74,7 ms | 152,1 ms |
| Trends 25 năm, bbox 500 cell | 53,2 ms | 68,8 ms |
| Calendar days: 31 lần `summarize` 1 ngày, toàn quốc | 4,1 ms | 7,3 ms |

Mọi kịch bản tầng repository thấp hơn nhiều so với NFR01 (p95 ≤ 2 giây). Thời gian HTTP/serialization của Người B chưa nằm trong số này.

## 6. Kiểm chứng

Môi trường:

- Oracle JDK `21.0.12` LTS;
- Maven Wrapper → Apache Maven `3.10.0`;
- Spring Boot `4.1.2`;
- Windows 11.

Lệnh:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'
Set-Location backend
.\mvnw.cmd clean verify
```

Kết quả trên `main` tại `13a7fe6`: **BUILD SUCCESS, 77 tests, 0 failures, 0 errors, 0 skipped**. Sau merge A2 (có commit frontend chen giữa) đã chạy lại toàn bộ trước khi push.

### Đối chiếu danh sách test A3 của plan

| Yêu cầu plan | Test |
|---|---|
| Thứ tự cell đầu ra giống selection | `FileActivityQueryRepositoryFixtureTests.summarizesCellsInInputOrder`, `ActivityQueryEdgeCaseRegressionTests.allNationalCellTotalsAddUpToTheNationalTotal` |
| Hai selection cùng số cell, khác cell ID không dùng nhầm cache | `ActivityQueryEdgeCaseRegressionTests.sameSizeSelectionsNeverShareACachedTable`, `FileAreaActivityRepositoryFixtureTests` (regression của 03B1) |
| Named area và tập cell bbox tương đương cho cùng kết quả | `RealActivityQueryRegressionTests.namedAreaAndShuffledSelectionOfTheSameCellsAreIdentical`, `precomputedTablesMatchOnDemandAggregationOnRealData` |
| Tổng các cell bằng aggregate vùng | fixture `cellTotalsAddUpToTheSelectionTotal`; dữ liệu thật 587 cell năm 2024 |
| `cellCount` khác `cellDays` | fixture `summarizesAllCellsWithDistinctCellAndCellDayCounts`; dữ liệu thật năm 2024 |
| Một ngày, một tháng, năm nhuận, toàn dataset, partial | `RealActivityQueryRegressionTests`, `ActivityQueryEdgeCaseRegressionTests` |
| Zero hợp lệ không bị coi là missing | `SourceProvenanceRegressionTests.zeroValuedCellDaysStayInTheCompositionAsRealZeros`, fixture exact-date |
| Input sai bị từ chối rõ ràng | fixture `rejectsInvalidSelectionsAndDates` (10 ca) |
| Golden bbox 13 cell: 2024 `2182.780156`, 03/2024 `450.0`, 18/03/2024 `53.0`, 03/2005 `3039.161190`, đỉnh tháng 2 `893.0` | `RealActivityQueryRegressionTests` |

Mọi số kỳ vọng được tính lại độc lập bằng numpy từ derived binaries. Sai số `1e-6`; riêng tổng toàn bộ 9.509 ngày dùng `1e-4` vì khác thứ tự cộng giữa numpy/Java (vẫn rất nhỏ so với tolerance contract `0.01`).

## 7. Câu hỏi mở và giới hạn

### 7.1. Ngữ nghĩa `sourceInputValidCellCount`

OpenAPI v0.4 đặt tên `sourceInputValidCellCount` nhưng chưa mô tả. Với một ngày, số cell và số cell-day bằng nhau. Với một kỳ nhiều ngày, repository hiện trả **số cell-day** có input hợp lệ (`sourceInputValidCellDays`). Đề nghị Người B và người giữ contract chốt một trong hai:

- giữ nghĩa cell-day và bổ sung description vào OpenAPI; hoặc
- đổi sang số cell phân biệt, khi đó Người A sẽ thêm trường tương ứng.

### 7.2. Giới hạn đã biết

- Composition không có theo từng ngày trong `ActivityDailySeries`; origin từng ngày lấy bằng `summarize` một ngày. Số đo ở mục 5 cho thấy cách này đủ nhanh nên không đổi interface A0.
- Selection không trùng named area được tính lại mỗi request (không có cache LRU). Số đo cho thấy chưa cần.
- `AreaActivityRepository` được giữ để tương thích TASK 03A; có thể bỏ sau khi service chỉ dùng `ActivityQueryRepository`.
- Benchmark đo trên một máy; chưa có đo tải đồng thời 5 request như NFR01 mô tả.

## 8. A6 — Gia cố sau review toàn backend (15/11/2026)

Review toàn backend sau TASK 03B2B không thấy lỗi mức cao/trung bình ở tầng repository; các điểm mức thấp đã sửa trên nhánh `task03b2a/a6-repository-hardening`:

| Điểm | Thay đổi |
|---|---|
| Byte phục vụ khác byte đã hash (hash bằng stream rồi `readAllBytes` lần hai) | `DatasetArtifactValidator.readVerified` đọc mỗi file **một lần** và kiểm size + SHA-256 trên chính mảng byte trả về; 4 artifact ngày, `cells_025.csv` và `harmonized_national_year.csv` đều dùng byte đã kiểm. `ValidatedDataset.artifactPaths` → `artifactBytes`; `resolveDeclaredSource` → `readDeclaredSource`; `SimpleCsvTable.read(Path)` → `parse(byte[])`. |
| Nhãn nguồn không bị ràng theo spec | Mã 1..4 phải đúng `TERRA/AQUA/SNPP/NOAA20` với origin tương ứng của Artifact Spec §5.2; mã 4 bắt buộc `scaleDivisor` dương (`scaleDivisorReported` nếu có cũng phải dương); `metric` phải là `snpp_eq`, `timeZone` phải là `UTC`. |
| Thiếu ngày trong manifest gây `NullPointerException` | Báo rõ tên trường (`dateRange.start`, `dateRange.end`, `dataThrough`). |
| Kiểm đường dẫn chỉ theo chuỗi | Thêm so sánh `toRealPath()` để chặn symlink trỏ ra ngoài dataset root; chuỗi đường dẫn không hợp lệ báo `DatasetUnavailableException` thay vì `InvalidPathException`. |
| Manifest singleton còn collection lồng có thể sửa | `WarningDefinition.params`, `Validation.checks/regressionSamples` được copy sâu thành collection không sửa được (giữ giá trị JSON `null`). |
| CSV trùng tên cột lấy cột cuối | `SimpleCsvTable` báo lỗi khi header trùng tên. |

Test mới: 8 test trong `FileDailyActivityRepositoryTests` (nhãn sai mã, thiếu `scaleDivisor`, `timeZone` khác UTC, thiếu `dataThrough`, thoát root qua `cellOrderSource` và `optionalArtifacts.path`, đường dẫn không hợp lệ, symlink) và 6 test trong `RepositoryHardeningTests`. Kết quả JDK 21.0.12: **110 tests, 0 failures, 0 errors, 1 skipped**. Test bị bỏ qua là test symlink: Windows chặn tạo symlink khi không có quyền ("A required privilege is not held by the client"); test chạy trên Linux/macOS/CI hoặc Windows bật Developer Mode.

Hai lỗi mức trung bình do review tìm thấy nằm ở phạm vi Người B; theo yêu cầu của người dùng, đã sửa trên nhánh riêng `task03b2/fix-origin-and-http-errors`:

1. `ProvenanceServiceImpl.resolveOrigin`: kỳ có tổng `0` từng trả `MIXED` thay vì origin của đa số cell-day (Technical Design v0.4 §6, Contract §3.5). Nay: đóng góp dương quyết định origin như cũ; khi tổng bằng `0`, origin có nhiều cell-day nhất thắng (Terra và Aqua cộng chung là `MODEL_REDISTRIBUTED`); hòa thì `MIXED` vì không có đa số. Ví dụ: cell `40_422` tháng 01/2012 (Aqua 19, S-NPP 12 cell-day, tổng 0) nay là `MODEL_REDISTRIBUTED`.
2. `GlobalExceptionHandler`: URL không tồn tại và method không hỗ trợ từng trả `500 INTERNAL_ERROR` kèm log ERROR. Nay trả `404 NOT_FOUND` và `405 METHOD_NOT_ALLOWED` (có header `Allow`), dạng `application/problem+json`, không log ERROR. Hai code `NOT_FOUND`/`METHOD_NOT_ALLOWED` chỉ dùng cho route ngoài contract; nên bổ sung vào enum `Problem.code` của OpenAPI ở lần cập nhật contract tới.

Kiểm chứng: JDK 21.0.12 `mvnw clean verify` **115 tests, 0 failures, 1 skipped** (symlink); JAR thật trả 404/405 và origin `MODEL_REDISTRIBUTED` cho ví dụ trên.

## 9. Việc tiếp theo

- Người B tích hợp `ActivityQueryRepository` vào service 03B2B và chốt câu hỏi 7.1.
- Khi tích hợp 03B2C, Người A review kết quả repository và đối chiếu response với Document 08.
