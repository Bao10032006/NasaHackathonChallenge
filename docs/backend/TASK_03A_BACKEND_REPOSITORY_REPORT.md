# TASK 03A — Báo cáo tích hợp artifact vào repository Java

- Ngày kiểm tra: 14/11/2026
- Artifact spec: `docs/backend/TASK_03A_ARTIFACT_SPEC.md` phiên bản `1.0.0`
- Snapshot: `hoalich-data-v1-2026-11-13`
- Phạm vi: manifest, kiểm định artifact, repository đọc dữ liệu ngày và cấu hình Spring

## 1. Kết quả

Backend đã đọc được fixture chính thức và snapshot thật theo layout little-endian `[date][cell]`. Ứng dụng kiểm tra fail-fast khi khởi động và chỉ tạo repository bean sau khi manifest, kích thước, SHA-256, thứ tự cell và nội dung nhị phân hợp lệ.

Chưa triển khai controller, service nghiệp vụ hoặc REST endpoint trong bước này.

## 2. Thành phần Java

- Domain bất biến: manifest và bản ghi activity theo cell/ngày.
- Interface repository: `DatasetMetadataRepository`, `DailyActivityRepository`.
- File implementation: `FileDailyActivityRepository`.
- Loader/validator nội bộ: đọc manifest, kiểm schema major, đường dẫn an toàn, kích thước, hash, layout, catalog metadata và miền giá trị.
- Spring configuration: tạo một repository implementation dùng được qua cả hai interface; đường dẫn lấy từ `hoalich.dataset.root` hoặc `HOALICH_DATASET_ROOT`.
- Lỗi dataset khi startup làm Spring context thất bại, đúng quy tắc fail-fast của spec.

## 3. Kiểm tra đã chạy

Lệnh:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'
.\mvnw.cmd clean verify
```

Môi trường:

- Java: Oracle JDK 21.0.12
- Maven: Maven Wrapper của dự án
- Spring Boot: 4.1.2

Kết quả thực tế:

- `BUILD SUCCESS`
- 18 test, 0 failure, 0 error, 0 skipped
- Spring context mặc định tải snapshot thật thành công.
- Spring context dùng override `HOALICH_DATASET_ROOT` tải fixture thành công.
- Không có `DataSource` hoặc cấu hình database.
- Fixture chính thức xác nhận endian probe, source code, input count, valid zero và invalid source input.
- Snapshot thật xác nhận R1–R6: Aqua model, S-NPP direct, NOAA-20 scaled, hai cell-level probe và 328 Aqua fallback cell-day.

R7 là regression của bảng seasonality pentad, không thuộc repository dữ liệu ngày và sẽ được kiểm tra khi triển khai repository tương ứng.

## 4. Hành vi validation

Backend từ chối khởi động khi gặp một trong các trường hợp chính:

- schema major không hỗ trợ;
- file/manifest thiếu hoặc JSON không hợp lệ;
- đường dẫn tuyệt đối hoặc thoát khỏi dataset root;
- thứ tự `cellIds` khác `cells_025.csv`;
- dtype, shape, byte size hoặc SHA-256 không khớp;
- source code ngoài 1–4, input count âm, validity ngoài 0–1;
- `validation.status` khác `PASS`.

Trường mới của schema minor được bỏ qua để giữ khả năng tương thích tiến hóa.

## 5. Sẵn sàng cho bước tiếp theo

Artifact contract `1.0.0` và repository dữ liệu ngày đã sẵn sàng làm nền cho tầng service. Bước tiếp theo nên triển khai service interface/implementation, DTO và controller theo API Contract v0.3, bắt đầu từ metadata/areas và daily/map, đồng thời giữ tổng hợp và warning semantics ở service thay vì repository.
