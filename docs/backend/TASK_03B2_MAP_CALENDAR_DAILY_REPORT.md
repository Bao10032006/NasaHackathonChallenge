# TASK 03B2 — Map, Calendar & Daily Integration Report

**Ngày:** 14/11/2026  
**Contract:** OpenAPI v0.4  
**Data query baseline:** `bf86831`, `ad84aac`, `99d3454`, `13a7fe6`

## 1. Trạng thái

TASK 03B2 đã được tích hợp về mặt source trên nhánh `task03b2b/activity-api` dựa trên `main` commit `13a7fe6`:

- repository query engine từ TASK 03B2A đã có trên baseline;
- service, DTO, mapper và controller của TASK 03B2B đã nối với repository thật;
- bốn API map/calendar/daily đã chạy bằng packaged JAR và dataset thật;
- không thay đổi artifact hoặc contract v0.4.

Task chưa được coi là đã merge vào `main` cho đến khi người dùng yêu cầu commit/push và nhánh được review.

## 2. Thành phần đã tích hợp

Repository/data commits đã có trên baseline:

- `bf86831`: ActivityQueryRepository interface/domain handoff;
- `ad84aac`: file-backed activity query implementation và bean wiring;
- `0026c66`: source provenance validation;
- `13a7fe6`: edge-case và golden regression tests.

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

Kết quả thực tế ngày 14/11/2026:

- `BUILD SUCCESS`;
- 96 test;
- 0 failure;
- 0 error;
- 0 skipped;
- compiler chạy với `release 21`;
- packaged JAR được tạo thành công.

Packaged JAR đã khởi động thành công với default dataset path và sáu truy vấn smoke map/calendar/daily đã trả HTTP 200 cùng golden values nêu trong báo cáo TASK 03B2B.

## 5. Scientific boundary

API trả **harmonized S-NPP-equivalent daytime activity**, không phải danh sách đám cháy, số vụ cháy, burned area, tọa độ hotspot gốc, forecast hay cảnh báo thời gian thực.

TASK 03B2 không chứa thuật toán phân loại vùng đang cháy hoặc anomaly. Mọi việc thêm threshold/rank/anomaly phải được báo trước và chỉ triển khai sau khi method version, baseline, validation và UI copy được phê duyệt.

## 6. Việc còn lại trước khi đóng task trên main

1. Kiểm tra `git diff --check`.
2. Review diff, commit và push chỉ khi người dùng yêu cầu.
3. Merge nhánh API vào `main`.
4. Chạy lại full Maven verification trên `main` sau merge.

Sau đó mới lập task riêng cho trends/seasonality/cell-period provenance; không tự động bắt đầu anomaly.
