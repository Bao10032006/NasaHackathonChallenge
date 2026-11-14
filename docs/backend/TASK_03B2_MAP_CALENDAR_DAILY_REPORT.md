# TASK 03B2 — Map, Calendar & Daily Integration Report

**Ngày:** 14/11/2026<br>
**Contract:** OpenAPI v0.4<br>
**Activity API merge:** `7a2e65c`<br>
**Final verification baseline:** `17e8e34`

## 1. Trạng thái

TASK 03B2 đã hoàn thành và có trên `main` tại commit `17e8e34`:

- repository query engine từ TASK 03B2A đã có trên baseline;
- service, DTO, mapper và controller của TASK 03B2B đã nối với repository thật;
- bốn API map/calendar/daily đã chạy bằng packaged JAR và dataset thật;
- repository đã được harden sau full review;
- không thay đổi artifact hoặc contract v0.4.

Task đã merge, review và chạy lại full verification trên `main`; đủ điều kiện đóng TASK 03B2.

## 2. Thành phần đã tích hợp

Repository/data commits đã có trên baseline:

- `bf86831`: ActivityQueryRepository interface/domain handoff;
- `ad84aac`: file-backed activity query implementation và bean wiring;
- `0026c66`: source provenance validation;
- `13a7fe6`: edge-case và golden regression tests;
- `eeaa542`: báo cáo bàn giao TASK 03B2A;
- `7a2e65c`: merge Activity API TASK 03B2B;
- `17e8e34`: harden manifest, checksum, path/symlink và CSV validation sau full review.

API layer trong thay đổi hiện tại:

- temporal selector và coverage clipping;
- provenance/origin/warning rules;
- map year/month/pentad/date;
- calendar month/pentad và optional median baseline;
- civil-day calendar;
- exact-date aggregate/source composition;
- Problem Details errors và OpenAPI-compatible DTO.

## 3. Verification matrix

- Named area và bbox: đã kiểm bằng service/MockMvc và smoke test dataset thật.
- Stable ordered cell IDs: repository regression và map smoke test đạt.
- Region total bằng tổng cell: repository regression đạt; map/daily integration đạt.
- Zero khác missing: fixture regression và API placeholder test đạt.
- Outside range: series trả nullable item; exact date trả 422.
- Partial dataset edge: coverage và warning được kiểm bằng fixture/thực tế.
- Leap day/pentad 73: temporal và repository regression đạt.
- All-zero peak: unit test trả `null`.
- Baseline target-year exclusion: unit test kiểm `excludesTargetYear` và sample size.
- Exact-date consistency: map, daily và calendar day dùng cùng aggregate.
- Golden bbox thực tế: năm 2024, tháng 03/2024, ngày 18/03/2024 và peak tháng đều khớp Document 08/tolerance artifact.

## 4. Build và test thực tế

Môi trường:

- Oracle JDK `21.0.12`;
- Maven Wrapper / Maven `3.10.0`;
- Spring Boot `4.1.2`;
- Windows 11 x64.

Lệnh bắt buộc:

```powershell
Set-Location backend
$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'
.\mvnw.cmd clean verify
```

Kết quả thực tế trên `main` ngày 14/11/2026:

- `BUILD SUCCESS`;
- 110 test;
- 0 failure;
- 0 error;
- 1 skipped;
- compiler chạy với `release 21`;
- packaged JAR được tạo thành công.

Test bị skip là phép kiểm tạo symbolic link do Windows hiện tại không cấp quyền; các test application, repository, fixture, golden regression và API đều chạy thành công.

Packaged JAR đã khởi động thành công với default dataset path và sáu truy vấn smoke map/calendar/daily đã trả HTTP 200 cùng golden values nêu trong báo cáo TASK 03B2B.

Frontend scaffold cũng đã được xác minh bằng `npm ci`, `npm run typecheck` và `npm run build`. Đây mới là scaffold trình bày; chưa gọi API thật và chưa phải frontend demo hoàn chỉnh.

## 5. Scientific boundary

API trả **harmonized S-NPP-equivalent daytime activity**, không phải danh sách đám cháy, số vụ cháy, burned area, tọa độ hotspot gốc, forecast hay cảnh báo thời gian thực.

TASK 03B2 không chứa thuật toán phân loại vùng đang cháy hoặc anomaly. Mọi việc thêm threshold/rank/anomaly phải được báo trước và chỉ triển khai sau khi method version, baseline, validation và UI copy được phê duyệt.

## 6. Kết luận và task tiếp theo

TASK 03B2 đã đạt Definition of Done cho repository và bốn API lõi. Không còn blocker code ở phạm vi task này.

Task tiếp theo cần được lập riêng cho trends/seasonality/cell-period provenance. Không tự động bắt đầu anomaly; mọi threshold/rank/anomaly vẫn cần quyết định khoa học và sản phẩm riêng.
