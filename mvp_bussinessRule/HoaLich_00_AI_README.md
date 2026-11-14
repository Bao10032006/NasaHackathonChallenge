---
title: Hỏa Lịch — AI Documentation Index
version: v0.2
updated: 2026-11-14
language: vi
backend: Java 21 / Spring Boot 4.1.2 / Spring MVC
frontend: React TypeScript
data_pipeline: Python offline
status: MVP specification; implementation in progress
---

# HỎA LỊCH — TÀI LIỆU CHO AI / ĐỘI PHÁT TRIỂN

Đây là chỉ mục đặc tả MVP của dự án Hỏa Lịch. Bộ v0.2 cập nhật v0.1 sau khi đối chiếu phần giới thiệu challenge “Harmonization of MODIS and VIIRS Hotspots” và trạng thái backend sau TASK 02A.

**v0.2 là phiên bản mặc định để triển khai.** Các file v0.1 được giữ nguyên làm lịch sử; không dùng v0.1 để ghi đè quyết định mới trong v0.2.

# 1. Thứ tự đọc v0.2

1. [01 — Product Vision & Scope v0.2](HoaLich_01_Product_Vision_and_Scope_v0.2.md): mục tiêu challenge, phạm vi, guardrails và success criteria.
2. [02 — User Stories v0.2](HoaLich_02_User_Stories_v0.2.md): US01–US10, ưu tiên và acceptance criteria.
3. [03 — Functional & Non-functional Requirements v0.2](HoaLich_03_Functional_Nonfunctional_Requirements_v0.2.md): FR01–FR13, baseline/anomaly gates, business rules và Definition of Done.
4. [04 — API & Data Contract v0.2](HoaLich_04_API_Data_Contract_v0.2.md): nguồn dữ liệu, endpoint, baseline schema, feature gates và contract tests.
5. [05 — UI/UX & User Flow v0.2](HoaLich_05_UIUX_User_Flow_Wireframe_v0.2.md): IA, wireframe, state, copywriting và demo scenario.
6. [06 — Technical Design & Implementation Plan v0.2](HoaLich_06_Technical_Design_Implementation_Plan_v0.2.md): kiến trúc file-backed, modules, increments, verification và readiness gates.

# 2. Tài liệu lịch sử v0.1

- [Vision & Scope v0.1](HoaLich_01_Product_Vision_and_Scope_v0.1.md)
- [User Stories v0.1](HoaLich_02_User_Stories_v0.1.md)
- [Requirements v0.1](HoaLich_03_Functional_Nonfunctional_Requirements_v0.1.md)
- [API Contract v0.1](HoaLich_04_API_Data_Contract_v0.1.md)
- [UI/UX v0.1](HoaLich_05_UIUX_User_Flow_Wireframe_v0.1.md)
- [Technical Design v0.1](HoaLich_06_Technical_Design_Implementation_Plan_v0.1.md)

# 3. Quyết định sản phẩm v0.2

- Challenge có hai phần phải được thể hiện: harmonization và burning activity calendar web application.
- Luồng Must gồm chọn area/time, calendar, map, trends, seasonality, historical comparison và giải thích/minh chứng harmonization.
- Historical comparison trả baseline, reference years, sample size và delta; không tự động gọi là anomaly.
- Anomaly là Should và feature-gated cho đến khi chốt method, threshold, minimum sample size và validation.
- Day View là Could/Discovery. Không đưa `granularity=day` vào API/UI production cho đến khi vượt D07 Day View readiness gate.
- Không mở rộng MVP thành real-time fire alert, fire prediction, burned-area estimation hoặc số vụ cháy.

# 4. Quyết định kỹ thuật mới nhất

- **Backend:** Java 21 + Spring Boot 4.1.2 + Spring MVC; REST API chỉ đọc.
- **Frontend:** React + TypeScript theo Document 05.
- **Pipeline:** Python chạy offline; web request không retrain harmonization.
- **Storage MVP:** CSV/JSON/NPZ file-backed, load/index chọn lọc. Không dùng JPA, PostgreSQL, SQLite, Redis, WebFlux, JDBC Session hoặc Spring Security trong MVP hiện tại.
- **Dataset config:** `hoalich.dataset.root` hoặc biến môi trường `HOALICH_DATASET_ROOT`; không hardcode đường dẫn máy.
- **Snapshot:** không sửa artifact nguồn; mỗi response quan trọng có data/model version và coverage metadata.

# 5. Ràng buộc dữ liệu bắt buộc

- `snpp_eq`: **số phát hiện tương đương S-NPP**, không phải số vụ cháy hoặc diện tích cháy.
- `missing` khác `0`; lỗi API cũng không được biểu diễn như `0`.
- Năm/kỳ chưa đủ dữ liệu phải có `partial`/warning và chỉ so với khoảng tương ứng.
- ToanQuoc, 5 vùng chẩn đoán và cell 0,25° là phạm vi hiện tại; vùng chẩn đoán không phải địa giới hành chính.
- Không gửi artifact detections khoảng 1,08 GB xuống frontend và không đặt hotspot giả cho giá trị tổng hợp.
- Snapshot hiện tại dùng `k_cell=60`; đổi model phải tái xuất, đổi version và chạy regression.
- Raw MODIS/VIIRS và harmonized series không được trình bày như cùng metric nếu định nghĩa/đơn vị khác nhau.

# 6. Readiness Gates còn mở

1. **D02 Baseline:** chốt median/reference years/exclusion/coverage rule và method version.
2. **D03 Anomaly:** chốt threshold, sample size, labels và validation trước khi bật feature.
3. **D04 Partial/Coverage:** xác nhận transition years, `dataThrough` và rule tham gia baseline.
4. **D06 Snapshot ownership:** owner, manifest/hash và regression approval.
5. **D07 Day View:** data definition, validation, uncertainty, API/UI contract và performance.

# 7. Quy tắc cho AI khi triển khai

- Đọc theo thứ tự: User Stories → Requirements → API Contract → Technical Design; Vision điều chỉnh phạm vi và ngôn ngữ sản phẩm.
- Ưu tiên Must; không để anomaly, export hoặc Day View chặn core API/UI.
- Không tự thêm authentication, database, microservices, realtime tracking hoặc dự báo cháy.
- Không tự thêm `granularity=day`; chỉ thực hiện sau khi D07 được cập nhật thành Ready trong tài liệu.
- Không gắn nhãn anomaly từ một delta đơn giản; chỉ dùng contract/method version đã được phê duyệt.
- Khi tài liệu và code khác nhau, báo chênh lệch; không âm thầm thay đổi requirement hay artifact.
- Mọi quyết định chưa có trong v0.2 phải được ghi là đề xuất, không trình bày như requirement đã duyệt.
