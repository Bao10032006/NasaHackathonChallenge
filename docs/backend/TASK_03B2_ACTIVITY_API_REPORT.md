# TASK 03B2B — Activity Service & REST API Report

**Ngày thực hiện:** 14/11/2026  
**Nhánh:** `task03b2b/activity-api`  
**Repository baseline:** `13a7fe6`  
**Contract baseline:** Hỏa Lịch API/OpenAPI v0.4

## 1. Kết quả

Đã triển khai bốn API lõi của TASK 03B2B:

- `GET /api/v1/map/cells`;
- `GET /api/v1/calendar`;
- `GET /api/v1/calendar/days`;
- `GET /api/v1/daily`.

Implementation dùng kiến trúc `controller → service interface → service.impl → repository`, không đọc artifact trong controller/service và không đưa DTO HTTP vào repository.

Phần này **không triển khai phân loại đám cháy, anomaly, cảnh báo thời gian thực hoặc dự báo**. Các response chỉ tổng hợp chỉ số `snpp_eq` đã hài hòa, độ phủ thời gian và provenance đã có trong artifact/manifest.

## 2. Thay đổi chính

### Temporal selection và coverage

- Validate đúng một selector cho map: `date`, `year`, `year+month` hoặc `year+pentad`.
- Tính requested/covered range, expected/covered/uncovered day count và `partial`.
- Exact date ngoài dataset trả `422 DATE_OUTSIDE_DATASET_RANGE`.
- Period không giao dataset trả `value=null`, `OUTSIDE_DATASET_RANGE`.
- Period giao chưa đủ vẫn là `AVAILABLE`, kèm `coverage.partial=true`.
- Hỗ trợ ngày nhuận và pentad 1–73.

### Tổng hợp, nguồn và summary

- Tính `DIRECT_OBSERVATION`, `SCALED_OBSERVATION`, `MODEL_REDISTRIBUTED` hoặc `MIXED` từ source composition và manifest.
- Source có harmonized value bằng `0` không làm aggregate origin thành `MIXED` sai nếu còn source dương duy nhất; nếu toàn bộ source đều bằng `0`, origin vẫn phản ánh tập source thực tế.
- Giữ riêng harmonized value, distinct source cell count, cell-day count, input observation count và source-input-valid cell-day count.
- `peakPeriod`/`peakDate` chỉ xét item `AVAILABLE`, đầy đủ và có value dương; đồng hạng chọn mốc sớm nhất; toàn bộ bằng `0` trả peak `null`.
- Baseline dùng median, minimum sample size 5 và loại target year khi target nằm trong reference range.
- Warning trả bằng stable code từ warning catalog; không đưa nội dung suy đoán mới vào API.

### HTTP contract

- DTO giữ đúng envelope và field name OpenAPI v0.4, gồm `peakPeriod` và `peakDate`.
- Required nullable fields vẫn được serialize dưới dạng JSON `null`; optional fields được bỏ khi không áp dụng.
- `/map/cells` giữ national default khi thiếu spatial selector.
- Ba endpoint exact-date dùng cùng selection/date cho cùng total và origin.
- Thêm stable errors: `INVALID_TEMPORAL_SELECTOR`, `UNSUPPORTED_QUERY`, `DATE_OUTSIDE_DATASET_RANGE`.

## 3. File thay đổi

Nhóm file chính:

- `controller/ActivityController.java`;
- `dto/activity/**` và các DTO common cho coverage, temporal selector, map cell, source composition;
- `mapper/ActivityMapper.java`, mở rộng `ResponseMetaMapper.java`;
- `service/ActivityService.java`, `TemporalSelectionService.java`, `ProvenanceService.java`;
- `service/impl/ActivityServiceImpl.java`, `TemporalSelectionServiceImpl.java`, `ProvenanceServiceImpl.java`;
- `service/model/**` cho activity result, coverage, origin, status và temporal selection;
- `exception/ApiException.java`;
- unit/MockMvc/application-context tests tương ứng.

Không thay đổi repository/file implementation của TASK 03B2A, dataset, derived artifacts, frontend hoặc tài liệu contract v0.4.

## 4. Kiểm chứng

Môi trường:

- Windows 11;
- Oracle JDK `21.0.12`;
- Maven Wrapper / Apache Maven `3.10.0`;
- Spring Boot `4.1.2`;
- Java compiler `release 21`.

Lệnh kiểm chứng cuối:

```powershell
Set-Location backend
$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'
.\mvnw.cmd clean verify
```

Kết quả thực tế:

- `BUILD SUCCESS`;
- 96 test;
- 0 failure;
- 0 error;
- 0 skipped;
- packaged JAR được tạo thành công.

Packaged JAR được chạy với dataset thật và smoke-test bằng bbox mẫu `west=107&south=12&east=108&north=13`. Kết quả kiểm tra:

- map năm 2024: 13 cell, tổng `2182.780156135559`;
- calendar năm 2024: tổng `2182.780156135559`, peak tháng 2 = `893.0`;
- calendar days tháng 3/2024: 31 ngày, tổng `450.0`;
- daily 18/03/2024: 13 cell, tổng `53.0`;
- map ngày 18/03/2024: tổng `53.0`, origin `DIRECT_OBSERVATION`;
- cùng bbox trả cùng ordered cell IDs; ba luồng exact-date trả cùng total.

## 5. Giới hạn và bước tiếp theo

- `/trends`, `/seasonality` và `/cells/{cellId}/period-details` chưa thuộc TASK 03B2.
- Anomaly/classification tiếp tục deferred và phải có decision riêng trước khi code.
- TASK tiếp theo chỉ nên bắt đầu sau khi code TASK 03B2 được review, merge và chạy lại full verification trên `main`.
