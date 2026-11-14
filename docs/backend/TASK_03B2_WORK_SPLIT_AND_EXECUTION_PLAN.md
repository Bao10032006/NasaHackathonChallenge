# TASK 03B2 — Work Split & Execution Plan

**Ngày lập:** 14/11/2026

**Backend baseline:** commit `d5c9537`

**Contract baseline:** Hỏa Lịch API/OpenAPI v0.4 tại commit `af231a3`

**Mục tiêu chung:** triển khai bốn API lõi `/api/v1/map/cells`, `/api/v1/calendar`, `/api/v1/calendar/days` và `/api/v1/daily` trên dataset đã kiểm định, dùng chung spatial selection của TASK 03B1.

## 1. Nguyên tắc làm việc

- OpenAPI v0.4 là nguồn sự thật cho query parameter, JSON field, kiểu dữ liệu và error code.
- Không sửa dataset gốc, derived artifacts, frontend hoặc tài liệu v0.4 trong TASK 03B2. Nếu phát hiện mâu thuẫn, ghi lại và báo trước khi đổi contract.
- Không triển khai `/trends`, `/seasonality`, anomaly, CSV export hoặc raw hotspot points trong task này.
- Mọi API phải hỗ trợ toàn bộ 587 cell. Bbox Tây Nguyên chỉ là fixture kiểm thử, không phải giới hạn sản phẩm.
- Giữ kiến trúc `controller → service interface → service.impl → repository`; controller không đọc file và repository không tạo DTO HTTP.
- Hai người không cùng sửa một nhóm file. Thay đổi interface dùng chung phải được merge ở bước A0 trước khi làm song song.
- Dùng JDK 21 và Maven Wrapper để kiểm chứng. Không báo test thành công nếu chưa thực sự chạy.

## 2. Nhánh và thứ tự bắt đầu

### Người A — thành viên Data/Repository

```powershell
git switch main
git pull origin main
git switch -c task03b2a/activity-query
```

Người A thực hiện **A0 trước**, push commit interface nhỏ để review và merge vào `main`. Sau khi A0 được merge, Người A tiếp tục A1–A5 trên cùng nhánh đã rebase hoặc trên nhánh kế tiếp từ `main`.

### Người B — chủ nhánh API (bạn và Codex)

Người B bắt đầu code sau khi A0 đã vào `main`:

```powershell
git switch main
git pull origin main
git switch -c task03b2b/activity-api
```

Sau A0, hai người có thể làm song song. Người B dùng fake/stub repository trong test, không sửa file implementation của Người A.

## 3. Người A — TASK 03B2A: Activity Query Repository

### A0 — Bàn giao interface dùng chung

Tạo interface selection-neutral để named area và bbox đều sử dụng cùng một query engine:

```java
public interface ActivityQueryRepository {
    ActivityAggregate summarize(
            Collection<String> cellIds,
            LocalDate startInclusive,
            LocalDate endInclusive);

    ActivityDailySeries dailySeries(
            Collection<String> cellIds,
            LocalDate startInclusive,
            LocalDate endInclusive);

    List<CellActivityAggregate> summarizeCells(
            Collection<String> cellIds,
            LocalDate startInclusive,
            LocalDate endInclusive);
}
```

Tạo ba domain model, không chứa DTO hoặc enum của HTTP:

```java
ActivityAggregate(
    LocalDate startDate,
    LocalDate endDate,
    int cellCount,
    int dayCount,
    double value,
    List<SourceComposition> sources)

ActivityDailySeries(
    LocalDate startDate,
    double[] values)

CellActivityAggregate(
    String cellId,
    LocalDate startDate,
    LocalDate endDate,
    double value,
    List<SourceComposition> sources)
```

Yêu cầu interface:

- Giữ thứ tự `cellIds` đầu vào trong kết quả `summarizeCells`.
- Không tạo một object cho toàn bộ 9.509 × 587 cell-day trong bộ nhớ.
- Khoảng ngày là inclusive và phải nằm trong dataset. Service của Người B chịu trách nhiệm clip khoảng thời gian và tính coverage.
- Giá trị được cộng bằng `double` từ float32 artifact; không làm tròn trong repository.
- `SourceComposition.cellCount` là số cell phân biệt dùng source ít nhất một lần; `cellDays` là số cell-day.
- Input rỗng, cell không tồn tại, ngày đảo ngược hoặc ngày ngoài dataset phải thất bại rõ ràng, không âm thầm trả `0`.

Commit A0 chỉ gồm interface, domain model và JavaDoc. Không đưa implementation hoặc controller vào commit này.

### A1 — File-backed implementation

- Tạo `FileActivityQueryRepository` hoặc implementation tương đương cho interface A0.
- Đọc qua repository/file reader hiện có; không đọc lại NPZ và không thay đổi artifact.
- Tái sử dụng dữ liệu đã memory-map/validate ở TASK 03A.
- Hỗ trợ selection tùy ý từ 1 đến 587 cell, kể cả bbox cắt qua nhiều diagnostic region.
- Tính được tổng vùng, daily series, tổng từng cell và source composition cho mọi khoảng ngày hợp lệ.
- Đăng ký bean trong `DatasetConfiguration`.
- Nếu giữ `AreaActivityRepository`, code cũ phải tiếp tục chạy; có thể delegate sang query engine mới để tránh hai thuật toán khác nhau.

### A2 — Source/provenance semantics

- Mã nguồn và origin lấy từ manifest/artifact, không suy đoán metadata mới.
- Giữ riêng:
  - harmonized value;
  - distinct source cell count;
  - contributing cell-day count;
  - input observation count;
  - source-input-valid cell-day count.
- Một cell/kỳ có nhiều origin sẽ được service biểu diễn là `MIXED`; repository chỉ trả composition đủ để service kết luận.
- Giá trị `0` hợp lệ phải được giữ là `0`, không chuyển thành missing.

### A3 — Unit và regression tests

Tối thiểu phải kiểm tra:

- thứ tự cell đầu ra giống thứ tự selection;
- hai selection cùng số cell nhưng khác cell ID không dùng nhầm cache;
- named area và tập cell bbox tương đương cho cùng kết quả;
- tổng các cell bằng aggregate vùng trong sai số float cho phép;
- source `cellCount` khác `cellDays` đúng ngữ nghĩa;
- một ngày, một tháng, năm nhuận, toàn bộ dataset và khoảng partial hợp lệ;
- zero hợp lệ không bị coi là missing;
- input sai bị từ chối rõ ràng.

Golden regression trên bbox 13 cell `west=107`, `south=12`, `east=108`, `north=13`:

- năm 2024: `2182.780156`;
- tháng 03/2024: `450.0`;
- ngày 18/03/2024: `53.0`;
- tháng 03/2005: `3039.161190`;
- đỉnh tháng của năm 2024 là tháng 2 với `893.0`.

Sai số assertion phải theo artifact spec hiện hành; không sửa expected value để làm test qua.

### A4 — Phạm vi file của Người A

Được phép sửa/tạo:

- `backend/src/main/java/com/se201411/mvc/backend/repository/**`;
- `backend/src/main/java/com/se201411/mvc/backend/repository/file/**`;
- các model repository-neutral trong `domain/activity/**`;
- `backend/src/main/java/com/se201411/mvc/backend/config/DatasetConfiguration.java`;
- test repository tương ứng trong `backend/src/test/**/repository/**`;
- fixture test nhỏ nếu thật sự cần;
- `docs/backend/TASK_03B2A_ACTIVITY_QUERY_REPORT.md`.

Không sửa:

- `controller/**`, `dto/**`, `mapper/**`, `service/**`;
- `WebMvcConfiguration`, error handler hoặc application properties;
- OpenAPI/API Contract v0.4;
- dataset và script export;
- frontend.

### A5 — Deliverable của Người A

- Commit A0: interface + domain handoff.
- Commit A1: implementation + bean wiring.
- Commit A2: unit/regression tests + báo cáo.
- Push branch và gửi commit hash/PR cho Người B.
- Báo cáo phải ghi JDK/Maven, lệnh đã chạy, số test và mọi giới hạn còn lại.

## 4. Người B — TASK 03B2B: Service & REST API

### B1 — Temporal selection và coverage

Tạo service/model dùng chung để:

- validate đúng một temporal selector của `/map/cells`:
  - `date`;
  - `year`;
  - `year + month`;
  - `year + pentad`;
- tính requested range, covered range, expected/covered/uncovered day count và `partial`;
- clip period với dataset range trước khi gọi repository;
- exact-date ngoài dataset trả `422 DATE_OUTSIDE_DATASET_RANGE`;
- series period không giao dataset trả item `value=null`, `OUTSIDE_DATASET_RANGE`;
- partial overlap trả `AVAILABLE` và `coverage.partial=true`;
- xác định month, leap day và pentad 1–73 theo contract v0.4.

### B2 — Origin, warnings và summary rules

- Derive `DIRECT_OBSERVATION`, `SCALED_OBSERVATION`, `MODEL_REDISTRIBUTED` hoặc `MIXED` từ source composition/manifest.
- Không gọi harmonized daily value là raw fire count.
- `peakPeriod`/`peakDate` chỉ xét item `AVAILABLE` và đầy đủ.
- Nếu đồng hạng, chọn mốc sớm nhất.
- Nếu mọi giá trị hợp lệ đều bằng `0`, peak phải là `null`.
- Tổng, min/max và peak không được làm tròn tùy ý; serialization giữ độ chính xác phù hợp golden examples.
- Warning code lấy từ warning catalog hiện có.

### B3 — API endpoints

Triển khai đúng schema OpenAPI v0.4:

1. `GET /api/v1/map/cells`
   - hỗ trợ date/year/month/pentad;
   - không có spatial selector thì mặc định `ToanQuoc` để tương thích v0.3;
   - trả `selection`, `temporalSelector`, `summary`, ordered `cells`, `meta`;
   - exact date có source fields; aggregate period không bịa dominant source;
   - `summary` có total, origin, coverage và min/max cell value.

2. `GET /api/v1/calendar`
   - trả đúng 12 month hoặc 73 pentad item;
   - named area/bbox là bắt buộc;
   - hỗ trợ `includeBaseline`, `baselineStartYear`, `baselineEndYear`;
   - baseline dùng median, loại target year nếu nằm trong reference range;
   - summary dùng `peakPeriod`.

3. `GET /api/v1/calendar/days`
   - luôn trả đủ 28–31 ngày dân sự của tháng;
   - ngày ngoài dataset vẫn có item với `value=null`, `OUTSIDE_DATASET_RANGE`;
   - giữ zero hợp lệ;
   - summary dùng `peakDate`.

4. `GET /api/v1/daily`
   - exact date và spatial selector là bắt buộc;
   - trả aggregate và source composition;
   - `includeCells=true` mới trả danh sách cell;
   - tổng `/daily`, `/calendar/days` và `/map/cells?date=...` phải khớp khi cùng selection/date.

### B4 — Error handling

Bổ sung stable code còn thiếu vào `ApiException`/handler:

- `INVALID_TEMPORAL_SELECTOR`;
- `UNSUPPORTED_QUERY`;
- `DATE_OUTSIDE_DATASET_RANGE`.

Giữ nguyên các code spatial đã có. Không trả stack trace hoặc đường dẫn máy trong response.

### B5 — Phạm vi file của Người B

Được phép sửa/tạo:

- `controller/**`, `dto/**`, `mapper/**`;
- `service/**`, `service/impl/**`, `service/model/**`;
- domain temporal/API-neutral mới ngoài ba model A0;
- `exception/ApiException.java`, `GlobalExceptionHandler.java`;
- controller/service/integration tests;
- `docs/backend/TASK_03B2_ACTIVITY_API_REPORT.md`.

Không sửa khi Người A đang làm:

- `repository/file/**`;
- ba model A0;
- `DatasetConfiguration.java`;
- dataset, fixture nguồn hoặc script export;
- frontend;
- OpenAPI/API Contract v0.4.

## 5. TASK 03B2C — Tích hợp sau khi hai nhánh hoàn tất

Người B chịu trách nhiệm tích hợp cuối, Người A review kết quả repository:

1. Merge TASK 03B2A vào `main` trước.
2. Người B rebase TASK 03B2B lên `main`; không giải quyết conflict bằng cách bỏ code hoặc test của Người A.
3. Chạy `git diff --check`.
4. Chạy bằng JDK 21:

```powershell
Set-Location backend
& .\mvnw.cmd clean verify
```

5. Chạy packaged JAR với dataset thật và smoke test cả bốn endpoint.
6. Đối chiếu JSON với OpenAPI examples và Document 08.
7. Kiểm tra cùng một bbox luôn trả cùng ordered cell IDs ở mọi endpoint.
8. Kiểm tra ba API exact-date trả cùng total/origin/source semantics.
9. Kiểm tra ca thiếu dữ liệu, partial 11/2026, leap day và all-zero peak-null bằng synthetic fixture đã ghi rõ là không phải regression khoa học.
10. Tạo báo cáo tổng `docs/backend/TASK_03B2_MAP_CALENDAR_DAILY_REPORT.md`.

## 6. Definition of Done

TASK 03B2 chỉ hoàn thành khi:

- bốn endpoint đúng request/response OpenAPI v0.4;
- named area và bbox hoạt động trên toàn bộ bản đồ;
- cell order ổn định và tổng vùng khớp tổng cell;
- zero, missing, outside range và partial không bị đánh đồng;
- `peakPeriod`/`peakDate`, baseline và source origin đúng quy tắc;
- golden regression đạt trong tolerance đã công bố;
- Maven Wrapper chạy bằng JDK 21 và toàn bộ test qua;
- không thay đổi dataset, frontend hoặc contract v0.4;
- report ghi đúng kết quả thực thi;
- cả hai nhánh được review trước khi merge `main`.

## 7. Nội dung Người A cần gửi khi hoàn thành

Người A chỉ cần gửi lại:

- commit hash/PR của A0;
- commit hash/PR hoàn chỉnh của TASK 03B2A;
- đường dẫn báo cáo;
- kết quả Maven test thực tế;
- mọi deviation so với interface hoặc blocker còn tồn tại.

Không cần Người A triển khai controller hoặc chờ Người B hoàn thành REST API mới bàn giao repository.
