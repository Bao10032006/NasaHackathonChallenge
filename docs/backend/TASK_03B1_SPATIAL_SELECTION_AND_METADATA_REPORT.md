# TASK 03B1 — Spatial Selection & Metadata Foundation

**Ngày thực hiện:** 14/11/2026

**Contract baseline:** Hỏa Lịch API v0.4, commit `af231a3`

**Phạm vi:** Spring MVC backend, spatial selection dùng chung, metadata/areas API và repository hardening

## 1. Trạng thái ban đầu

- Dataset artifact, manifest reader, area repository và daily aggregation repository đã có và đã được kiểm định ở TASK 03A.
- Backend chưa có `controller`, DTO, mapper, service interface hoặc service implementation.
- Chưa có cơ chế dùng chung để resolve named area và bbox theo contract v0.4.
- `/api/v1/metadata` và `/api/v1/areas` chưa được triển khai.
- Cache của `FileAreaActivityRepository` chỉ tra theo `type:id` rồi so số lượng cell. Hai selection cùng tên/cùng số cell nhưng khác tập cell có thể nhận nhầm aggregate đã cache.
- Source composition mới đếm cell-day, chưa có số cell phân biệt theo source mà contract v0.4 cần.
- Spring Boot 4 tách module kiểm thử MVC khỏi starter test tổng quát.

## 2. Kiến trúc đã triển khai

Luồng HTTP tuân theo N-layer:

```text
controller → service interface → service.impl → repository
          ↘ DTO ← mapper ← domain/application model
```

Các controller không đọc file và không chứa quy tắc chọn cell. Repository không biết HTTP hoặc DTO.

## 3. Spatial selection foundation

`SpatialSelectionService` cung cấp hai chế độ:

- named area: `national`, `diagnostic_region`, `cell`;
- bbox: `west`, `south`, `east`, `north`.

Quy tắc đã chốt và kiểm thử:

- named area và bbox loại trừ nhau;
- bbox phải có đủ bốn cạnh, tọa độ hữu hạn và đúng miền địa lý;
- `west < east`, `south < north`;
- chọn cell khi tâm nằm trong **hoặc trên biên** bbox;
- lọc trên toàn bộ cell của snapshot, không giới hạn theo diagnostic region;
- kết quả giữ canonical dataset order;
- `selectedBounds` là bbox nhỏ nhất bao trọn hình học các cell được chọn, không phải center envelope;
- bbox không chứa tâm cell trả `422 NO_CELLS_IN_BOUNDS`;
- `resolveOrNational` được tách riêng để endpoint tương thích v0.3 có thể chủ động mặc định toàn quốc; resolver chuẩn vẫn yêu cầu selector rõ ràng.

## 4. API đã triển khai

### `GET /api/v1/metadata`

Trả đúng cấu trúc v0.4:

- version, metric, unit, timezone và `dataThrough`;
- date/year range và grid size;
- granularities và capabilities;
- source-code dictionary;
- scientific limitations;
- warning catalog;
- daily-data qualification.

Capability harmonization comparison phản ánh artifact thực tế của dataset đang chạy; anomaly và raw detection points vẫn `false`.

### `GET /api/v1/areas`

- Hỗ trợ filter tùy chọn `type=national|diagnostic_region|cell`.
- Không filter trả national, diagnostic regions và toàn bộ cells.
- Cell trả center, bounds và diagnostic region.
- National và năm diagnostic region trả tên tiếng Việt ổn định và `cellCount`.
- Thứ tự diagnostic region canonical: `DBSCL`, `DBSH`, `Khac`, `TayBac`, `TayNguyen`; dataset thu nhỏ vẫn chỉ trả vùng thực sự tồn tại.

## 5. Error handling và frontend development

- Thêm Problem Details JSON dùng `application/problem+json` với `type`, `title`, `status`, stable `code`, `detail`, `instance`, `timestamp`.
- Đã hỗ trợ các code cần cho foundation: `INVALID_PARAMETER`, `INVALID_SPATIAL_SELECTOR`, `INVALID_BOUNDS`, `AREA_NOT_FOUND`, `CELL_NOT_FOUND`, `NO_CELLS_IN_BOUNDS`, `DATASET_UNAVAILABLE`, `INTERNAL_ERROR`.
- CORS allow-list được externalize bằng `HOALICH_ALLOWED_ORIGINS`; mặc định chỉ cho `http://localhost:5173` và không bật wildcard credentials.

## 6. Repository hardening

- Cache key của area aggregation nay gồm `type`, `id` và chính xác ordered cell ID list.
- Thêm regression test với hai area cùng type, id và cell count nhưng khác cell set; aggregate không còn bị trả nhầm từ cache.
- `SourceComposition` bổ sung `cellCount`: số cell phân biệt dùng source ít nhất một lần trong kỳ.
- `cellDays` vẫn được giữ riêng; hai đại lượng không bị đánh đồng.
- Dataset gốc và derived artifacts không thay đổi.

## 7. Dependency và cấu hình

- Giữ Java target 21 và Spring Boot 4.1.2.
- Thêm duy nhất `spring-boot-starter-webmvc-test` ở scope `test`, vì Spring Boot 4 tách test support cho MVC thành module riêng.
- Không thêm WebFlux, JDBC Session, database, JPA, Security hoặc infrastructure ngoài phạm vi.
- Thêm `hoalich.web.allowed-origins=${HOALICH_ALLOWED_ORIGINS:http://localhost:5173}`.

## 8. File thay đổi

### Tạo mới

- `config`: `WebProperties`, `WebMvcConfiguration`.
- `controller`: `MetadataController`, `AreaController`, `GlobalExceptionHandler`.
- `domain/spatial`: `Bounds`, `SelectionType`, `SelectionRule`, `SpatialSelection`.
- `dto`: common, metadata và area response DTO.
- `exception`: `ApiException`.
- `mapper`: `ResponseMetaMapper`, `MetadataMapper`, `AreaMapper`, `SpatialSelectionMapper`.
- `service`: `SpatialSelectionService`, `MetadataService`, `AreaService`.
- `service/impl`: ba implementation tương ứng.
- `service/model`: `SpatialSelectionCriteria`, `MetadataOverview`, `AreaCatalogEntry`.
- Test: `SpatialSelectionServiceImplTests`, `MetadataAreaControllerIntegrationTests`.

### Chỉnh sửa

- `backend/pom.xml`.
- `backend/src/main/resources/application.properties`.
- `SourceComposition`, `FileAreaActivityRepository`.
- `BackendApplicationTests`, `FileAreaActivityRepositoryFixtureTests`.

Không xóa file nào.

## 9. Môi trường và kết quả kiểm chứng

Môi trường bắt buộc đã dùng:

- Oracle JDK `21.0.12 LTS`;
- Maven Wrapper / Apache Maven `3.10.0`;
- Spring Boot `4.1.2`;
- Windows 11, timezone `Asia/Saigon`.

Lệnh chính:

```powershell
.\mvnw.cmd clean verify
```

Kết quả thực tế:

- build: **SUCCESS**;
- Java compiler: `release 21`;
- test suites: 11;
- tests: **47**;
- failures: **0**;
- errors: **0**;
- skipped: **0**;
- Spring application context: load thành công;
- no-database assertion: tiếp tục đạt;
- dependency-tree filter: không có WebFlux hoặc JDBC Session.

Smoke test chạy packaged JAR bằng JDK 21 trên dataset thật:

- `GET /api/v1/metadata` → HTTP 200, `dataVersion=hoalich-data-v1-2026-11-13`, range `2000-11-01..2026-11-13`;
- `GET /api/v1/areas?type=diagnostic_region` → HTTP 200, đủ 5 diagnostic regions;
- ứng dụng dừng có kiểm soát sau smoke test.

## 10. Giới hạn còn lại

- TASK 03B1 cố ý chưa triển khai `/map/cells`, `/calendar`, `/calendar/days`, `/daily`, `/trends` hoặc `/seasonality`.
- Spatial selection đã sẵn sàng để các endpoint trên tái sử dụng nhưng chưa có analytical controller gọi nó.
- Anomaly, CSV export, seasonal aggregate và raw hotspot points vẫn ngoài phạm vi.
- Không có blocker kỹ thuật cho bước tiếp theo.

## 11. Readiness và task tiếp theo

Foundation đã sẵn sàng cho **TASK 03B2 — Map, Calendar & Daily APIs**:

1. dùng `SpatialSelectionService` để resolve cùng một cell set ở mọi endpoint;
2. triển khai `/map/cells` cho year/month/pentad/date;
3. triển khai `/calendar` và `/calendar/days` với coverage + typed summary;
4. triển khai `/daily` và source composition;
5. đối chiếu response bằng golden examples v0.4 và regression dataset thật.
