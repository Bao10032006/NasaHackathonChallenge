# Hỏa Lịch — Project Source of Truth

> Đây là điểm bắt đầu bắt buộc cho thành viên mới và mọi AI agent làm việc trong repository này.
>
> Đọc toàn bộ README trước khi phân tích, đề xuất hoặc sửa code. Sau đó đọc đúng tài liệu được chỉ định cho task đang thực hiện. Không suy luận trạng thái dự án chỉ từ tên file hoặc một phiên bản tài liệu cũ.

**Cập nhật:** 15/11/2026

**Ngôn ngữ làm việc:** tiếng Việt

**API/Product baseline đã chốt:** v0.4

**Bổ sung v0.4.1:** Khám phá sử dụng bảy vùng kinh tế - xã hội từ ranh giới cấp tỉnh trước sắp xếp năm 2025. Xem [API & Data Contract](mvp_bussinessRule/HoaLich_04_API_Data_Contract_v0.4.md#62-get-areas) để biết mã vùng và cách gán ô.

**Backend:** Java 21, Spring Boot 4.1.2, Spring MVC

**Dataset snapshot:** `hoalich-data-v1-2026-11-13`

## 1. Dự án này làm gì?

Hỏa Lịch là ứng dụng web trực quan hóa và phân tích lịch sử hoạt động cháy tại Việt Nam bằng dữ liệu NASA FIRMS đã được pipeline offline hài hòa về thước đo `snpp_eq`.

Luồng sản phẩm mục tiêu:

1. Chọn toàn quốc, một trong bảy vùng kinh tế - xã hội hoặc khoanh vùng trên bản đồ.
2. Xem bản đồ theo năm, tháng, pentad hoặc ngày.
3. Xem chuỗi 12 tháng, thẻ tóm tắt và lịch từng ngày.
4. Bấm một ngày để đồng bộ bản đồ và dữ liệu nguồn.
5. So sánh cùng vùng/cùng kỳ qua các năm.
6. Đọc rõ coverage, provenance và giới hạn khoa học.

`snpp_eq` là **số phát hiện ban ngày tương đương S-NPP**. Nó không phải số vụ cháy, diện tích cháy, rủi ro cháy hoặc dự báo.

## 2. Thứ tự ưu tiên nguồn sự thật

Khi tài liệu hoặc code có vẻ mâu thuẫn, dùng thứ tự sau:

1. **README gốc này**: trạng thái hiện tại, task đang chạy, điểm bắt đầu và quy tắc phối hợp.
2. **OpenAPI v0.4**: đường dẫn API, query parameter, response field, kiểu dữ liệu và error schema.
3. **API/Data Contract và Requirements v0.4**: ngữ nghĩa nghiệp vụ, coverage, status, baseline, provenance và validation.
4. **Decision Log v0.4**: quyết định đã chốt và lý do.
5. **Artifact Spec 1.0.0 cùng `dataset-manifest.json`**: layout byte, hash, version, dimensions và ngữ nghĩa dữ liệu nội bộ.
6. **Code và automated tests hiện tại**: phần nào thực sự đã được triển khai.
7. **Task reports**: bằng chứng build/test và giới hạn tại thời điểm hoàn thành task.
8. **Tài liệu v0.1–v0.3**: chỉ dùng để tra lịch sử; không được ghi đè quyết định v0.4.

Nguồn chính:

- [AI documentation index](mvp_bussinessRule/HoaLich_00_AI_README.md)
- [Product Vision & Scope v0.4](mvp_bussinessRule/HoaLich_01_Product_Vision_and_Scope_v0.4.md)
- [User Stories v0.4](mvp_bussinessRule/HoaLich_02_User_Stories_v0.4.md)
- [Functional & Non-functional Requirements v0.4](mvp_bussinessRule/HoaLich_03_Functional_Nonfunctional_Requirements_v0.4.md)
- [API & Data Contract v0.4](mvp_bussinessRule/HoaLich_04_API_Data_Contract_v0.4.md)
- [UI/UX & User Flow v0.4](mvp_bussinessRule/HoaLich_05_UIUX_User_Flow_Wireframe_v0.4.md)
- [Technical Design v0.4](mvp_bussinessRule/HoaLich_06_Technical_Design_Implementation_Plan_v0.4.md)
- [Decision Log v0.4](mvp_bussinessRule/HoaLich_07_Challenge_Alignment_and_Decision_Log_v0.4.md)
- [Frontend Golden Examples v0.4](mvp_bussinessRule/HoaLich_08_Frontend_Integration_Examples_v0.4.md)
- [OpenAPI v0.4](mvp_bussinessRule/HoaLich_OpenAPI_v0.4.yaml)
- [Artifact Spec 1.0.0](docs/backend/TASK_03A_ARTIFACT_SPEC.md)
- [Hướng dẫn deploy Vercel + Render](docs/DEPLOYMENT_VERCEL_RENDER.md)

### Lưu ý về chữ “proposed” trong tài liệu v0.4

Đội dự án đã review và chốt v0.4 làm baseline cho triển khai tiếp theo. Một số front matter hoặc đoạn mở đầu trong bộ tài liệu vẫn còn chữ `proposed` hay `backend approval pending`; đó là metadata chưa được dọn, không có nghĩa dự án quay lại v0.3. Không tự sửa nội dung contract chỉ để giải quyết nhãn trạng thái này.

Nếu cần thay đổi API sau v0.4, phải ghi rõ thay đổi và tạo revision mới; không âm thầm sửa semantics đã chốt.

## 3. Trạng thái triển khai hiện tại

Các mốc đã hoàn thành:

- **TASK 01:** phân tích context và kế hoạch triển khai.
- **TASK 02A:** ổn định Spring Boot skeleton, Java 21 và Maven Wrapper.
- **TASK 02B/02C:** kiểm chứng daily dataset, hoàn thiện contract và đồng bộ frontend thành v0.4.
- **TASK 03A:** xuất binary artifact, manifest, Java file repositories và regression tests.
- **TASK 03B1:** spatial selection, metadata/areas API, N-layer foundation, CORS và Problem Details.
- **TASK 03B2:** activity query repository, map/calendar/daily services và bốn REST API lõi.
- **TASK 03B3:** trends, seasonality, cell-period provenance và hai bản sửa lỗi phản hồi từ review backend 15/11/2026.

Mốc Git quan trọng:

- `af231a3`: bộ tài liệu/API v0.4 đã cập nhật theo frontend review.
- `d5c9537`: TASK 03B1 — spatial selection và metadata foundation.
- `92b5f96`: kế hoạch chia việc và thực thi TASK 03B2.
- `bf86831` → `13a7fe6`: repository query engine, provenance validation và regression tests của TASK 03B2A.
- `7a2e65c`: merge TASK 03B2B Activity API vào `main`.
- `17e8e34`: repository hardening sau full review và mốc hoàn tất TASK 03B2.
- `5fe142d`, `c1dbb6d`, `f495d41`: sửa 406/capability, TASK 03B3B và TASK 03B3A; tích hợp trên nhánh `task03b3c/integration`.

Kết quả backend gần nhất đã xác minh trên nhánh tích hợp `task03b3c/integration` (15/11/2026):

- JDK `21.0.12 LTS`;
- Maven Wrapper / Maven `3.10.0`;
- Spring Boot `4.1.2`;
- compiler `release 21`;
- 153 test, 0 failure, 0 error, 1 skipped (`clean verify`);
- packaged JAR và application context hoạt động;
- packaged JAR đã smoke-test ba API TASK 03B3, 406 và capability với dataset thật;
- test symlink duy nhất bị skip vì Windows hiện tại không cấp quyền tạo symbolic link;
- không có WebFlux, JDBC Session hoặc database dependency.

Frontend React/Vite hiện đã tích hợp API thật và các luồng Explore/Compare. Lần xác minh deploy gần nhất đã chạy thành công `npm ci`, TypeScript typecheck và production build.

### API đã có trong code

- `GET /api/v1/metadata`
- `GET /api/v1/areas`
- `GET /api/v1/map/cells`
- `GET /api/v1/calendar`
- `GET /api/v1/calendar/days`
- `GET /api/v1/daily`
- `GET /api/v1/trends`
- `GET /api/v1/seasonality`
- `GET /api/v1/cells/{cellId}/period-details`

### Repository/data capability đã có

- Validate manifest, checksum, dimensions và binary artifacts khi startup.
- Đọc daily values theo ngày và cell.
- Named-area catalog, cell geometry và diagnostic regions.
- Area daily series, aggregate và source composition.
- Spatial selection cho named area hoặc bbox center-inclusive.
- Harmonization comparison artifact nếu snapshot cung cấp.

### Chưa có trong code

- `/api/v1/harmonization/comparison` (Optional; `/metadata` báo `harmonizationComparisonAvailable: false` cho tới khi triển khai)
- anomaly và CSV export
- backlog analytics trong `docs/HoaLich_analytics_v0.1/` (đề xuất v0.2-draft, chưa thuộc MVP v0.4)

Không được nhầm “đã có trong OpenAPI” với “đã được controller triển khai”.

## 4. Task vừa hoàn thành: TASK 03B2

Mục tiêu TASK 03B2 là triển khai:

- `/api/v1/map/cells`;
- `/api/v1/calendar`;
- `/api/v1/calendar/days`;
- `/api/v1/daily`.

Tài liệu thực thi bắt buộc: [TASK 03B2 — Work Split & Execution Plan](docs/backend/TASK_03B2_WORK_SPLIT_AND_EXECUTION_PLAN.md).

### Người A — Data/Repository

Phụ trách TASK 03B2A:

- A0: `ActivityQueryRepository` và ba domain model bàn giao.
- A1–A2: file-backed implementation và provenance aggregation.
- A3: unit/regression tests bằng fixture và dataset thật.
- Không sửa controller, DTO, mapper hoặc service.

Người A phải merge A0 vào `main` trước để hai nhánh dùng cùng interface.

Trạng thái: A0–A3, báo cáo bàn giao và repository hardening đã merge vào `main`; review cuối ở commit `17e8e34`.

### Người B — API/Integration (chủ repository cùng Codex)

Phụ trách TASK 03B2B:

- temporal selector, coverage, partial/outside-range;
- origin, warning, peak và baseline rules;
- service interface + `service.impl`;
- controller, DTO, mapper và error handling;
- MockMvc/contract/integration tests cho bốn API.

Người B bắt đầu code sau khi A0 của Người A đã vào `main`. Hai bên tích hợp theo phần TASK 03B2C trong work-split plan.

Trạng thái: source, test và report đã merge vào `main` qua commit `7a2e65c`; full verification sau repository hardening đạt tại `17e8e34`.

Báo cáo:

- [TASK 03B2B — Activity Service & REST API Report](docs/backend/TASK_03B2_ACTIVITY_API_REPORT.md)
- [TASK 03B2 — Map, Calendar & Daily Integration Report](docs/backend/TASK_03B2_MAP_CALENDAR_DAILY_REPORT.md)

### TASK 03B3 — Trends, seasonality, cell provenance

Hoàn tất trên các nhánh `fix/backend-http-406-and-capability`, `task03b3b/historical-analysis`, `task03b3a/cell-period-provenance`; tích hợp và kiểm chứng trên `task03b3c/integration`.

Báo cáo: [TASK 03B3 — Historical Analysis & Cell Provenance Report](docs/backend/TASK_03B3_HISTORICAL_AND_PROVENANCE_REPORT.md)

### Task kế tiếp đề xuất

Anomaly vẫn phải có decision riêng (D03) trước khi triển khai; đầu vào đề xuất nằm ở `docs/HoaLich_analytics_v0.1/`. `/harmonization/comparison` là Optional, làm khi đội cần.

## 5. Cấu trúc repository

```text
.
├── backend/                         Spring Boot backend và dataset snapshot
│   ├── hoalich_data_v1/             Dữ liệu gốc + derived artifacts bất biến
│   ├── src/main/java/.../backend/
│   │   ├── config/                  Dataset/CORS configuration
│   │   ├── controller/              HTTP layer
│   │   ├── dto/                     Request/response DTO
│   │   ├── mapper/                  Domain/application model → DTO
│   │   ├── service/                 Service interface
│   │   ├── service/impl/            Service implementation
│   │   ├── repository/              Repository interface
│   │   ├── repository/file/         File-backed implementation
│   │   └── domain/                  Domain/data models
│   └── src/test/                    Unit, fixture, regression, MockMvc tests
├── docs/backend/                    Task plan, report và artifact spec
├── frontend/                        React/Vite frontend tích hợp API
├── mvp_bussinessRule/               Product/API/UX/technical documents
└── tools/data/                      Offline artifact exporter và Python requirements
```

Base Java package hiện tại là `com.se201411.mvc.backend`. Không đổi package nếu chưa có quyết định kiến trúc được ghi lại.

## 6. Kiến trúc bắt buộc

Backend dùng N-layer:

```text
HTTP request
    ↓
controller
    ↓
service interface
    ↓
service.impl
    ↓
repository interface
    ↓
repository.file
    ↓
validated immutable artifacts
```

DTO và mapper nằm ở biên HTTP. Repository không biết controller/DTO; controller không đọc file hoặc chứa thuật toán aggregate.

Không tự ý thêm:

- JPA hoặc database;
- PostgreSQL;
- Redis;
- Spring Security;
- WebFlux;
- JDBC Session;
- message broker hoặc microservice split.

Pipeline Python chạy offline. Spring Boot chỉ đọc artifacts đã phát hành; không tái harmonize, retrain hoặc đọc NPZ trong request.

## 7. Dataset và artifact invariants

Dataset mặc định:

```text
backend/hoalich_data_v1/hoalich_data_v1/
```

Snapshot hiện tại:

- date range: `2000-11-01` đến `2026-11-13`;
- 9.509 ngày liên tục;
- 587 cell, grid 0,25°;
- layout binary: little-endian, row-major `[date][cell]`;
- canonical cell order theo `tables/cells_025.csv`;
- `dataVersion`: `hoalich-data-v1-2026-11-13`;
- `modelVersion`: `lai-clim-s2-k60-kappa3`.

Derived artifacts Spring Boot sử dụng:

- `derived/daily-values.f32`;
- `derived/daily-source.u8`;
- `derived/daily-input-count.i16`;
- `derived/daily-source-input-valid.u8`;
- `derived/dataset-manifest.json`.

Không chỉnh binary, CSV, NPZ hoặc manifest bằng tay. Nếu artifact format thay đổi, phải tăng `schemaVersion`, chạy exporter/validation đúng quy trình và cập nhật spec.

### Source code semantics

- `1 = TERRA` → `MODEL_REDISTRIBUTED`;
- `2 = AQUA` → `MODEL_REDISTRIBUTED`;
- `3 = SNPP` → `DIRECT_OBSERVATION`;
- `4 = NOAA20` → `SCALED_OBSERVATION`.

Một kỳ chứa nhiều origin được biểu diễn là `MIXED`. Không bịa provenance không có trong artifact.

## 8. Quy tắc nghiệp vụ không được phá vỡ

### Spatial

- Named area dùng `areaType + areaId`; bbox dùng đủ `west, south, east, north`.
- Hai kiểu selector loại trừ nhau.
- Bbox chọn cell khi tâm nằm trong hoặc trên biên khung.
- Lọc trên toàn bộ 587 cell, không giới hạn theo diagnostic region.
- Kết quả giữ canonical dataset order.
- `selectedBounds` bao toàn bộ hình học cell đã chọn, không phải envelope của tâm.
- Bbox không có cell trả `422 NO_CELLS_IN_BOUNDS`.

### Time và coverage

- Map nhận đúng một trong: `date`, `year`, `year+month`, `year+pentad`.
- Pentad có giá trị 1–73; pentad 73 chứa ngày 366 của năm nhuận.
- Exact date ngoài dataset trả `422 DATE_OUTSIDE_DATASET_RANGE`.
- Series period hoàn toàn ngoài dataset dùng `value=null`, `OUTSIDE_DATASET_RANGE`.
- Period giao một phần dataset vẫn `AVAILABLE`, kèm `coverage.partial=true`.
- Calendar ngày luôn trả đủ 28–31 ngày dân sự.

### Value và summary

- `0` là giá trị hợp lệ, không phải missing.
- Missing/outside/error không được biểu diễn bằng `0`.
- Chỉ `AVAILABLE` có numeric value.
- Peak chỉ xét item `AVAILABLE` và không partial; hòa thì chọn mốc sớm nhất.
- Nếu mọi giá trị hợp lệ đều bằng `0`, peak là `null`.
- Calendar năm dùng `peakPeriod`; lịch ngày dùng `peakDate`.
- Baseline dùng median, loại target year khỏi reference range, loại missing/partial nhưng giữ zero.

### Scientific communication

- Cell marker là tâm ô lưới 0,25°, không phải tọa độ raw hotspot.
- Daily harmonized value có thể là direct, scaled hoặc model-redistributed.
- `sourceInputValid=false` là cờ provenance/quality, không tự động là missing.
- Diagnostic regions phục vụ phân tích, không phải địa giới hành chính.
- Không gọi chênh lệch hai kỳ là anomaly nếu chưa có method/threshold/version được duyệt.

## 9. API contract essentials

Tất cả response lõi phải mang version/metric/unit/timezone/warnings thông qua `meta` theo OpenAPI.

Các quy tắc quan trọng:

- Cùng bbox và `dataVersion` phải resolve cùng ordered `cellIds` ở mọi endpoint.
- `/daily`, `/calendar/days` và `/map/cells?date=...` phải khớp tổng và provenance khi cùng selection/date.
- Map summary chứa total, status, origin, coverage và min/max cell value.
- Source composition phân biệt distinct `cellCount` với `contributingCellDayCount`.
- Problem response dùng `application/problem+json` và stable error code.
- Không trả stack trace hoặc đường dẫn máy trong API.

Golden flow dùng để integration test:

```text
bbox 13 cell tại Tây Nguyên
→ map năm 2024 + calendar 12 tháng
→ lịch tháng 03/2024
→ ngày 18/03/2024
→ so tháng 03/2005 với tháng 03/2024
```

Tây Nguyên chỉ là fixture deterministic. Production phải hoạt động với mọi bbox hợp lệ trên lưới Việt Nam.

Golden values đã kiểm chứng:

- năm 2024: `2182.780156`;
- tháng 03/2024: `450.0`;
- ngày 18/03/2024: `53.0`;
- tháng 03/2005: `3039.161190`;
- peak tháng năm 2024: tháng 2, `893.0`.

Không hardcode các giá trị này vào production code.

## 10. Thiết lập và chạy backend

### Yêu cầu

- JDK 21;
- Git;
- không cần cài Maven toàn cục vì repository có Maven Wrapper.

### Windows PowerShell

```powershell
Set-Location backend
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21.0.12'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
& .\mvnw.cmd clean verify
& .\mvnw.cmd spring-boot:run
```

Không giả định mọi máy đều có JDK ở đúng đường dẫn ví dụ trên. Hãy kiểm tra `java -version` và `./mvnw -version` trước.

### macOS/Linux

```bash
cd backend
./mvnw clean verify
./mvnw spring-boot:run
```

### Cấu hình

Mặc định khi chạy từ thư mục `backend`:

```properties
hoalich.dataset.root=hoalich_data_v1/hoalich_data_v1
hoalich.web.allowed-origins=http://localhost:5173
```

Có thể override bằng:

- `HOALICH_DATASET_ROOT`;
- `HOALICH_ALLOWED_ORIGINS` — danh sách phân tách bằng dấu phẩy.

Không hardcode absolute machine path vào source hoặc `application.properties`.

Smoke test sau khi ứng dụng chạy:

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/metadata
Invoke-RestMethod 'http://localhost:8080/api/v1/areas?type=diagnostic_region'
```

## 11. Quy trình bắt buộc cho AI agent

Khi một AI bắt đầu phiên làm việc mới:

1. Đọc README này đầy đủ.
2. Chạy `git status --short --branch` và `git log -5 --oneline --decorate`.
3. Không tự động pull nếu người dùng chưa yêu cầu và worktree đang có thay đổi.
4. Xác định task hiện tại từ mục 4 và đọc task plan/report liên quan.
5. Đọc OpenAPI/API Contract v0.4 trước khi thiết kế public API.
6. Đọc Artifact Spec và manifest trước khi thay repository/data model.
7. Kiểm tra code thật; không kết luận chỉ dựa trên report hoặc prompt cũ.
8. Bảo toàn thay đổi chưa commit của người khác; không reset, checkout hoặc xóa chúng.
9. Chỉ sửa file thuộc ownership của task/nhánh hiện tại.
10. Dùng test fixture cho unit test và dataset thật cho golden regression phù hợp.
11. Chạy lệnh kiểm chứng thực tế trước khi báo pass.
12. Báo rõ lệnh, JDK/Maven, số test, failure/blocker và file đã thay đổi.
13. Không commit hoặc push nếu người dùng chưa yêu cầu rõ.
14. Không bắt đầu task kế tiếp khi task hiện tại chưa được nghiệm thu.

Nếu người dùng chỉ yêu cầu đánh giá hoặc review, không tự ý sửa code. Nếu người dùng yêu cầu triển khai, phải hoàn thành và kiểm chứng trong đúng phạm vi đã giao.

## 12. Git và phối hợp nhiều người

- `main` là nhánh tích hợp.
- Mỗi phần việc dùng branch riêng và commit nhỏ, reviewable.
- Pull/rebase trước khi bắt đầu phần việc mới.
- Không force-push hoặc rewrite lịch sử chung.
- Không dùng `git reset --hard` hoặc bỏ thay đổi của người khác.
- Không giải quyết conflict bằng cách chọn toàn bộ một phía mà chưa đọc semantic difference.
- Repository/data branch merge trước API branch khi API phụ thuộc interface mới.
- Sau merge phải chạy lại full Maven verification, không dùng kết quả test trước merge.

TASK 03B2 dùng:

- Người A: `task03b2a/activity-query`;
- Người B: `task03b2b/activity-api`.

## 13. Phạm vi đang hoãn

Không tự động triển khai các mục sau chỉ vì chúng xuất hiện trong ý tưởng sản phẩm:

- anomaly/rank classification;
- seasonal aggregate khi chưa chốt định nghĩa mùa;
- persisted custom area;
- raw detection points;
- real-time alerts hoặc forecast;
- burned area, fire weather hoặc hướng lan truyền;
- JPA/database/security/microservices.

Anomaly chỉ được triển khai sau khi có method version, baseline, threshold, validation và UI copy được duyệt. Ghi chú hiện tại: [TASK 03B Anomaly Design Note](docs/backend/TASK_03B_ANOMALY_DESIGN_NOTE.md).

## 14. Quy tắc cập nhật README này

README là source of truth về **trạng thái và điều phối**, nên task/PR thay đổi một trong các mục sau phải cập nhật README trong cùng đợt merge:

- baseline contract/version;
- endpoint đã triển khai;
- task đang chạy hoặc ownership;
- dataset/artifact version;
- Java/Spring/Maven baseline;
- build/test status gần nhất;
- quyết định khoa học hoặc kiến trúc có ảnh hưởng toàn dự án.

Không chép toàn bộ contract vào README. README phải trỏ đến tài liệu chi tiết và chỉ giữ các invariant, trạng thái cùng hướng dẫn bắt đầu cần thiết.

## CSV export (frontend)

Explore now includes an Export CSV button. Select a month or year and a national, regional or drawn-bounds selection, then download all cell values for that period. Day and pentad selections also work. Export uses the existing /map/cells response, including cells hidden by marker thresholds or zoom. Each row includes unrounded snpp_eq, status, origin when supplied, period/selection coverage, bounds and dataset/model versions. Missing values remain blank; zero remains zero.

Output uses UTF-8 BOM, comma separators and CRLF. This is browser-side export of aggregated cells, not raw detections or a new CSV API. Coordinates represent cell centers. Coverage columns describe the selected period/selection, not cloud-free pixel coverage. Backend and artifacts are unchanged.
