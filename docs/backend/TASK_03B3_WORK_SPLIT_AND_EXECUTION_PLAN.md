# TASK 03B3 — Historical Analysis & Cell Provenance Work Split

**Ngày lập:** 14/11/2026

**Backend baseline:** `main` tại commit `abdb54b`

**Contract baseline:** Hỏa Lịch API Contract và OpenAPI v0.4

**Mục tiêu chung:** hoàn thiện ba API Must còn thiếu của contract v0.4:

- `GET /api/v1/trends`;
- `GET /api/v1/seasonality`;
- `GET /api/v1/cells/{cellId}/period-details`.

TASK 03B3 tiếp tục kiến trúc N-layer `controller → service interface → service.impl → repository`, tái sử dụng spatial/temporal selection và activity repository đã hoàn thành trong TASK 03B1–03B2.

## 1. Nguồn sự thật và nguyên tắc chung

Thứ tự đối chiếu khi triển khai:

1. `mvp_bussinessRule/HoaLich_OpenAPI_v0.4.yaml` cho HTTP request/response, field, kiểu dữ liệu và status code.
2. `mvp_bussinessRule/HoaLich_04_API_Data_Contract_v0.4.md` cho data semantics.
3. `mvp_bussinessRule/HoaLich_03_Functional_Nonfunctional_Requirements_v0.4.md` cho business rule.
4. `mvp_bussinessRule/HoaLich_06_Technical_Design_Implementation_Plan_v0.4.md` cho trách nhiệm từng tầng.
5. `README.md` cho trạng thái repository và quy tắc phối hợp hiện hành.

Quy tắc bắt buộc:

- Không sửa contract v0.4 để khớp với code. Nếu phát hiện mâu thuẫn, ghi blocker và trao đổi trước khi đổi tài liệu.
- Không sửa dataset gốc, derived artifacts hoặc script harmonization/export.
- Không tạo JPA, database, cache phân tán hoặc web stack mới.
- Không coi `snpp_eq` là số vụ cháy, diện tích cháy, rủi ro hoặc dự báo.
- Zero hợp lệ phải giữ là `0`; không đổi zero thành missing.
- Cộng float32 bằng `double`; không làm tròn tùy ý trong domain/repository.
- Named area và bbox phải đi qua cùng `SpatialSelectionService` và cùng tập cell ổn định.
- Missing, outside range, partial và insufficient baseline là các trạng thái khác nhau.
- Controller không đọc file; repository không tạo DTO HTTP.
- Dùng JDK 21 và Maven Wrapper để kiểm chứng. Không ghi test pass nếu chưa chạy.

## 2. Nội dung không thuộc TASK 03B3

Không triển khai trong task này:

- anomaly detection hoặc phân loại mức độ cháy;
- thuật toán xác định “đám cháy” từ các cell liền kề;
- raw hotspot coordinates/timestamps;
- CSV export;
- tổng hợp theo mùa nhiều tháng;
- `/harmonization/comparison` vì đây là API Optional;
- thay đổi frontend ngoài việc cung cấp response mẫu nếu cần tích hợp.

Trước khi bắt đầu anomaly hoặc phân loại cháy phải tạo decision/task riêng và báo cho chủ dự án duyệt.

## 3. Baseline kỹ thuật được tái sử dụng

TASK 03B3 không cần tạo repository đọc dataset mới. Các thành phần hiện có đã đủ làm nền:

- `ActivityQueryRepository`: aggregate một tập cell theo inclusive date range, daily series và per-cell totals;
- `AreaRepository`: tra cell metadata và cell ID;
- `SpatialSelectionService`: resolve named area hoặc bbox;
- `TemporalSelectionService`: validate date/year/month/pentad và tính coverage;
- `ProvenanceService`: ánh xạ source composition thành source/origin;
- `ResponseMetaMapper`, `SpatialSelectionMapper`, các DTO common và error handler hiện hành.

Không mở rộng interface repository chỉ để bao một vòng lặp service. Chỉ đề xuất thay đổi repository khi có test hoặc đo đạc chứng minh API không thể đáp ứng đúng hoặc đủ nhanh bằng interface hiện tại.

Baseline kế thừa từ TASK 03B2 là 110 test, 0 failure, 0 error, 1 skipped do quyền tạo symlink trên Windows. Đây là số liệu của lần kiểm chứng TASK 03B2; TASK 03B3 phải chạy lại và ghi số liệu mới.

## 4. Nhánh và cách bắt đầu

Hai người bắt đầu từ cùng baseline đã cập nhật:

```powershell
git switch main
git pull origin main
```

### Người A — thành viên phụ trách cell provenance và data validation

```powershell
git switch -c task03b3a/cell-period-provenance
```

### Người B — bạn và Codex, phụ trách historical analysis

```powershell
git switch -c task03b3b/historical-analysis
```

Hai nhánh được phép làm song song vì sở hữu các class khác nhau. Không sửa `ActivityController`, `ActivityService` hoặc `ActivityServiceImpl`; ba API mới phải dùng controller/service riêng để tránh làm phình service hiện tại và tránh conflict.

Nếu phát sinh thay đổi bắt buộc ở interface/file dùng chung, người phát hiện phải dừng phần phụ thuộc, tạo commit nhỏ riêng và gửi người còn lại review trước khi tiếp tục.

## 5. Người A — TASK 03B3A: Cell-period provenance

### A1 — Endpoint và validation

Triển khai:

```text
GET /api/v1/cells/{cellId}/period-details
```

Yêu cầu:

- `cellId` phải đúng syntax và tồn tại trong active snapshot;
- cell không tồn tại trả `404 CELL_NOT_FOUND`;
- dùng đúng một temporal selector giống `/map/cells`:
  - `date`;
  - `year`;
  - `year + month`;
  - `year + pentad`;
- tổ hợp temporal sai trả `400 INVALID_TEMPORAL_SELECTOR` hoặc `INVALID_PARAMETER` theo error matrix v0.4;
- exact date ngoài dataset trả `422 DATE_OUTSIDE_DATASET_RANGE` qua temporal service hiện có;
- period không giao dataset trả `value=null`, `OUTSIDE_DATASET_RANGE`, `origin=null` và source composition rỗng;
- period giao dataset một phần chỉ aggregate covered range, trả `AVAILABLE` với coverage partial trong `temporalSelector`;
- không nhận area hoặc bbox vì cell path đã xác định spatial scope.

### A2 — Response và provenance

Response phải đúng `CellPeriodDetailsResponse` trong OpenAPI v0.4:

- metadata của cell;
- typed temporal selector và coverage;
- harmonized value, `valueStatus` và `origin`;
- source composition gồm:
  - `sourceCode`;
  - source label;
  - origin;
  - distinct `cellCount`;
  - `contributingCellDayCount`;
  - `harmonizedValue`;
  - `inputObservationCount`;
  - `sourceInputValidCellCount`;
- response meta/data version.

Tái sử dụng `ActivityQueryRepository.summarize(List.of(cellId), coveredStart, coveredEnd)` và `ProvenanceService`. Không đọc binary artifact trực tiếp trong service. Endpoint không được trả hoặc suy diễn raw detection coordinates/timestamps.

### A3 — File ownership

Người A được tạo/sửa:

- `controller/CellController.java`;
- `dto/cell/**`;
- `mapper/CellPeriodDetailMapper.java`;
- `service/CellPeriodDetailService.java`;
- `service/impl/CellPeriodDetailServiceImpl.java`;
- `service/model/CellPeriodDetailResult.java` và model chỉ dành cho endpoint này;
- `controller/CellControllerIntegrationTests.java`;
- `service/impl/CellPeriodDetailServiceImplTests.java`;
- regression test riêng cho cell provenance nếu cần;
- `docs/backend/TASK_03B3A_CELL_PROVENANCE_REPORT.md`.

Người A không sửa:

- `ActivityController`, `ActivityService`, `ActivityServiceImpl`, `ActivityMapper`;
- class trends/seasonality do Người B sở hữu;
- repository/file implementation, trừ khi có blocker được hai bên thống nhất;
- OpenAPI/API Contract v0.4;
- frontend và dataset artifacts;
- `README.md` trước bước tích hợp cuối.

### A4 — Test bắt buộc

Tối thiểu phải có:

- date, year, month và pentad hợp lệ;
- cell không tồn tại;
- malformed cell ID;
- temporal selector thiếu, thừa hoặc mâu thuẫn;
- exact date ngoài range;
- full period, partial period và outside-range period;
- zero vẫn là `AVAILABLE`;
- source composition giữ đúng `cellCount` và cell-day count;
- tổng source harmonized value khớp cell aggregate trong tolerance artifact;
- JSON response đúng OpenAPI field names và không rò đường dẫn máy.

Golden regression gợi ý dùng cell trong bbox mẫu `west=107,south=12,east=108,north=13`, nhưng expected value phải được tính lại từ artifact thật và ghi nguồn/tolerance trong report trước khi hard-code vào test.

### A5 — Deliverable

Người A gửi:

- branch/commit hash hoặc PR;
- đường dẫn report;
- lệnh Maven đã chạy và kết quả thực tế;
- golden values đã xác minh;
- mọi deviation hoặc blocker.

## 6. Người B — TASK 03B3B: Trends và seasonality

### B1 — Historical query model và service

Tạo service interface riêng, ví dụ `HistoricalAnalysisService`, với implementation trong `service.impl`. Service nhận spatial criteria và query parameters, resolve cell set bằng `SpatialSelectionService`, sau đó dùng `ActivityQueryRepository` cho mọi aggregate.

Không thêm logic lịch sử vào `ActivityServiceImpl`.

### B2 — `GET /api/v1/trends`

Triển khai query:

- một spatial selector: named area hoặc bbox;
- `startYear` và `endYear` bắt buộc, `startYear <= endYear`;
- `granularity=year|month|pentad`;
- `year` cấm `period`;
- `month` yêu cầu `period=1..12`;
- `pentad` yêu cầu `period=1..73`;
- không hỗ trợ daily trend.

Response:

- giữ selection/cell set ổn định;
- một point cho mỗi năm trong inclusive range;
- point gồm year, period khi phù hợp, value, status, partial, origin và coverage;
- requested period không giao dataset trả null + `OUTSIDE_DATASET_RANGE`;
- period giao dataset một phần trả numeric aggregate + `AVAILABLE` + `partial=true`;
- zero hợp lệ trả `0` + `AVAILABLE`;
- origin được suy ra từ composition thật, không bịa source metadata.

### B3 — `GET /api/v1/seasonality`

Triển khai query:

- một spatial selector: named area hoặc bbox;
- `granularity=month|pentad`;
- `startYear` mặc định 2003;
- `endYear` mặc định 2025;
- validate `startYear <= endYear`.

Quy tắc thống kê:

- trả đúng 12 month period hoặc 73 pentad period theo thứ tự tăng dần;
- mỗi period thu thập cùng kỳ qua inclusive reference years;
- loại point missing, outside dataset và partial;
- giữ numeric zero trong sample;
- `sampleSize` là số năm hợp lệ thật sự dùng để tính;
- mean dùng arithmetic mean trên `double`;
- median: sort ascending; odd lấy phần tử giữa, even lấy trung bình hai phần tử giữa;
- minimum sample size cố định là 5;
- dưới 5 mẫu trả `mean=null`, `median=null`, `INSUFFICIENT_BASELINE`;
- từ 5 mẫu trở lên trả mean, median và `AVAILABLE`;
- seasonality thuần không có target year nên không loại một năm mục tiêu khỏi reference range;
- không tổng hợp “mùa” gồm nhiều tháng trong TASK 03B3.

### B4 — File ownership

Người B được tạo/sửa:

- `controller/HistoricalAnalysisController.java`;
- `dto/analysis/**`;
- `mapper/HistoricalAnalysisMapper.java`;
- `service/HistoricalAnalysisService.java`;
- `service/impl/HistoricalAnalysisServiceImpl.java`;
- `service/model/TrendResult.java`, `SeasonalityResult.java` và model liên quan;
- pure helper thống kê nếu cần, không cần interface khi chỉ có một implementation;
- controller/service/integration tests cho trends và seasonality;
- `docs/backend/TASK_03B3B_HISTORICAL_ANALYSIS_REPORT.md`.

Người B không sửa:

- file thuộc ownership của Người A;
- `ActivityController`, `ActivityService`, `ActivityServiceImpl` nếu không có blocker;
- repository/file implementation khi chưa chứng minh nhu cầu;
- OpenAPI/API Contract v0.4;
- frontend và dataset artifacts;
- `README.md` trước bước tích hợp cuối.

### B5 — Test bắt buộc

Trends:

- year/month/pentad hợp lệ;
- thiếu hoặc thừa `period`;
- invalid granularity/range/year/period;
- named area và bbox;
- outside, partial, zero và origin;
- số point và thứ tự năm ổn định.

Seasonality:

- 12 và 73 period đúng thứ tự;
- mean/median cho odd và even sample size;
- zero nằm trong sample;
- loại partial/outside/missing;
- đúng ngưỡng 4 mẫu → insufficient và 5 mẫu → available;
- default 2003–2025 và custom reference range;
- named area và bbox cho cùng cell set trả cùng kết quả.

Golden regression tối thiểu cho bbox 13 cell `west=107,south=12,east=108,north=13`:

- March 2005 aggregate xấp xỉ `3039.161190`;
- March 2024 aggregate bằng `450.0`;
- year 2024 aggregate xấp xỉ `2182.780156`.

Median/mean seasonality phải được tính độc lập từ artifact thật trước khi ghi expected value. Không sửa expected value chỉ để làm test pass.

## 7. Điểm giao tiếp giữa hai nhánh

Hai bên cùng tái sử dụng nhưng không sửa tùy tiện:

- `ActivityQueryRepository`;
- `AreaRepository`;
- `SpatialSelectionService`;
- `TemporalSelectionService`;
- `ProvenanceService`;
- common DTO/mapper và error infrastructure hiện hành.

Quy ước:

- A không thêm method vào historical service của B.
- B không thêm method vào cell provenance service của A.
- Mỗi controller có base path riêng nên không cần cùng sửa `ActivityController`.
- Test fake/stub đặt trong test class hoặc test package của từng nhánh; không tạo shared fake khi chưa cần.
- Không cùng cập nhật README/report tổng trong lúc hai nhánh đang chạy.

## 8. TASK 03B3C — Tích hợp cuối

Sau khi cả hai nhánh được review:

1. Merge từng nhánh vào `main`; nhánh merge sau phải cập nhật từ `main` và giải quyết conflict mà không bỏ test của nhánh trước.
2. Chạy `git diff --check`.
3. Chạy backend bằng JDK 21:

```powershell
Set-Location backend
& .\mvnw.cmd clean verify
```

4. Package và chạy JAR với dataset thật.
5. Smoke test cả ba endpoint mới bằng named area và bbox.
6. Kiểm tra trends/seasonality dùng đúng cùng cell set với `/calendar` cho query tương đương.
7. Kiểm tra cell-period total/provenance khớp cell tương ứng của `/map/cells` cho cùng temporal selector.
8. Đối chiếu response thực tế với OpenAPI v0.4.
9. Ghi kết quả vào `docs/backend/TASK_03B3_HISTORICAL_AND_PROVENANCE_REPORT.md`.
10. Chỉ sau khi test đạt mới cập nhật trạng thái `README.md`.

## 9. Definition of Done

TASK 03B3 hoàn thành khi:

- cả ba endpoint đúng OpenAPI v0.4;
- trends và seasonality hỗ trợ named area lẫn bbox trên toàn bộ 587 cell;
- cell details hỗ trợ đủ bốn temporal selector;
- coverage, partial, outside range, missing, zero và insufficient baseline không bị đánh đồng;
- mean, median, sample size và origin đúng quy tắc;
- provenance khớp artifact và không tuyên bố raw detection không tồn tại;
- unit, integration và real-data golden regression đạt;
- Maven Wrapper chạy bằng JDK 21, application context load và build package thành công;
- report ghi lệnh, môi trường, số test, smoke result và blocker thực tế;
- không thay đổi dataset, contract, frontend hoặc anomaly scope;
- hai nhánh được review trước khi merge vào `main`.

## 10. Bước bắt đầu ngay

Người A kéo `main`, tạo nhánh `task03b3a/cell-period-provenance` và làm A1–A5.

Người B có thể đồng thời tạo nhánh `task03b3b/historical-analysis` và làm B1–B5. Không cần chờ Người A bàn giao interface vì TASK 03B2 đã cung cấp đủ repository/service nền dùng chung.
