# TASK 02C — Báo cáo đồng bộ tài liệu v0.4 theo review Frontend

- Ngày: 14/11/2026
- Baseline giữ nguyên: API/Technical Design v0.3 và Artifact Spec 1.0.0
- Kết quả: tạo proposal v0.4; chưa thay đổi source Java hoặc dataset

## 1. Feedback được tiếp nhận

- Bounding box dùng chung cho map, calendar, daily, trends và seasonality trên toàn bộ 587 cell Việt Nam; không giới hạn theo diagnostic region.
- Map hỗ trợ whole-year selector.
- Một request `/calendar/days` trả 28–31 ngày.
- Summary theo year/month/date cùng coverage và peak rules.
- Dual-map comparison qua hai request có compatibility checks.
- Cell-period source composition tải on-demand.
- Harmonization comparison chuyển Optional; Data Notes vẫn Must.
- Seasonal aggregate/rank/anomaly/export/raw detections tiếp tục deferred.

## 2. Điều chỉnh bắt buộc so với feedback ban đầu

Ngày ngoài dataset range có `value=null` và `valueStatus=OUTSIDE_DATASET_RANGE`, không dùng zero. Exact-date API ngoài range trả `422 DATE_OUTSIDE_DATASET_RANGE`.

Snapshot v1 không có missing daily value bên trong date range. UI `MISSING` được kiểm bằng fixture tổng hợp riêng; không gắn nhãn đó là regression dữ liệu thật.

## 3. Quyết định contract chính

- Spatial selector là named area hoặc đầy đủ bốn bbox bounds, không đồng thời.
- Bbox center-inclusive, canonical cell order, empty → `NO_CELLS_IN_BOUNDS`.
- Map temporal selector: date; year-only; year+month; year+pentad.
- Coverage công bố requested/covered range và expected/covered/uncovered day counts.
- Peak chỉ xét child item available/non-partial; tie earliest; all-zero → null.
- Parent period partial vẫn có thể có peak trong covered range và phải mang coverage label.
- Dual map chỉ có delta khi version/metric/unit/cell set/effective duration tương thích.

## 4. Golden example đã xác minh

Bounding box `west=107,south=12,east=108,north=13` chọn đúng 13 cell Tây Nguyên và chỉ đóng vai trò golden example. Phạm vi chức năng bao phủ toàn bộ grid, kể cả bbox cắt nhiều vùng hoặc bao toàn quốc.

- Annual 2024: `2182.780156`; peak month 2: `893.0`.
- March 2024: `450.0`; peak date 18/03: `53.0`.
- March 2005: `3039.161190`, model redistributed.
- November 2026 covered 01–13/11: `3.185015`; 17 ngày còn lại outside range.

Các số được đọc trực tiếp từ derived daily binary; aggregate contract tolerance là `0.01`.

## 5. Files

- `mvp_bussinessRule/HoaLich_00_AI_README.md`
- `HoaLich_01_Product_Vision_and_Scope_v0.4.md`
- `HoaLich_02_User_Stories_v0.4.md`
- `HoaLich_03_Functional_Nonfunctional_Requirements_v0.4.md`
- `HoaLich_04_API_Data_Contract_v0.4.md`
- `HoaLich_05_UIUX_User_Flow_Wireframe_v0.4.md`
- `HoaLich_06_Technical_Design_Implementation_Plan_v0.4.md`
- `HoaLich_07_Challenge_Alignment_and_Decision_Log_v0.4.md`
- `HoaLich_08_Frontend_Integration_Examples_v0.4.md`
- `HoaLich_OpenAPI_v0.4.yaml`

## 6. Verification

- YAML parse thành công bằng SnakeYAML 2.6.
- Redocly OpenAPI lint xác nhận API description hợp lệ; còn một style warning không ảnh hưởng schema vì `/metadata` không có 4xx response tự nhiên.
- README links tồn tại.
- Không phát hiện quy tắc outside-range dùng zero.
- `git diff --check` sạch sau khi chuẩn hóa EOF.

## 7. Coordination

Backend đang triển khai v0.3 có thể tiếp tục phần không xung đột. Bbox, year-only map, calendar days, summary và cell-period-details chỉ nên đưa vào public controller/service surface sau khi Backend và Frontend duyệt field names của OpenAPI v0.4.

## 8. Contract review follow-up

Review chéo sau proposal ban đầu yêu cầu chuẩn hóa trước khi ký duyệt:

- Summary tách `peakPeriod`/`peakDate`; `partial` chỉ nằm trong coverage.
- Map response có summary total/origin/coverage/min/max.
- Metadata giữ field v0.3, thống nhất capability names và thêm warning catalog.
- `OUTSIDE_DATASET_RANGE` áp dụng nhất quán cho series item không giao dataset.
- Error-code matrix, target-year baseline exclusion và selected geometry bounds được ghi rõ.
- Golden examples được nhúng vào OpenAPI để FE sinh type/mock.
- Vite proxy/CORS, tên vùng tiếng Việt và cache/ETag guidance được bổ sung.

Điểm repository cần xử lý trước bbox: arbitrary resolved cell set, cache key theo exact canonical cell IDs và distinct source cell count. Bbox filtering vẫn thuộc `SpatialSelectionService`; không cần query database/repository riêng cho 587 cell.

Follow-up verification: Redocly xác nhận OpenAPI hợp lệ và không có `$ref` gãy; còn đúng một style warning vì `/metadata` không có 4xx tự nhiên. Bundle examples có 12 calendar item tổng `2182.780156`, 31 daily item tổng `450`, 13 map cell tổng `53`, min/max `0/13`; cell IDs được parse là string.
