---
title: Hỏa Lịch — AI Documentation Index
version: v0.4-proposed
updated: 2026-11-14
language: vi
backend: Java 21 / Spring Boot 4.1.2 / Spring MVC
frontend: React TypeScript
data_pipeline: Python offline
status: v0.3 implementation baseline; v0.4 frontend-aligned proposal
---

# HỎA LỊCH — TÀI LIỆU CHO AI / ĐỘI PHÁT TRIỂN

v0.3 là baseline đã dùng để hoàn thành TASK 03A artifact/repository. v0.4 là proposal sau review frontend ngày 14/11/2026; không tự động thay surface backend v0.3 cho đến khi Backend và Frontend duyệt OpenAPI v0.4.

# 1. Thứ tự đọc proposal v0.4

1. [01 — Product Vision & Scope v0.4](HoaLich_01_Product_Vision_and_Scope_v0.4.md)
2. [02 — User Stories v0.4](HoaLich_02_User_Stories_v0.4.md)
3. [03 — Functional & Non-functional Requirements v0.4](HoaLich_03_Functional_Nonfunctional_Requirements_v0.4.md)
4. [04 — API & Data Contract v0.4](HoaLich_04_API_Data_Contract_v0.4.md)
5. [05 — UI/UX & User Flow v0.4](HoaLich_05_UIUX_User_Flow_Wireframe_v0.4.md)
6. [06 — Technical Design v0.4](HoaLich_06_Technical_Design_Implementation_Plan_v0.4.md)
7. [07 — Decision Log v0.4](HoaLich_07_Challenge_Alignment_and_Decision_Log_v0.4.md)
8. [08 — Frontend Integration Golden Examples v0.4](HoaLich_08_Frontend_Integration_Examples_v0.4.md)
9. [OpenAPI v0.4](HoaLich_OpenAPI_v0.4.yaml)

# 2. Baseline v0.3 và artifact 1.0

- [API Contract v0.3](HoaLich_04_API_Data_Contract_v0.3.md)
- [OpenAPI v0.3](HoaLich_OpenAPI_v0.3.yaml)
- [Technical Design v0.3](HoaLich_06_Technical_Design_Implementation_Plan_v0.3.md)
- [Decision Log v0.3](HoaLich_07_Challenge_Alignment_and_Decision_Log_v0.3.md)
- [Artifact Spec 1.0.0](../docs/backend/TASK_03A_ARTIFACT_SPEC.md)
- [Backend Repository Report](../docs/backend/TASK_03A_BACKEND_REPOSITORY_REPORT.md)

Không sửa hoặc tái xuất artifact chỉ vì API v0.4 thêm use case. Repository daily hiện có đủ nền cho bbox/range aggregation; service/controller phải theo contract được duyệt.

# 3. Delta v0.4

- Bounding box dùng chung trên toàn bộ 587 cell Việt Nam: center-inclusive, ordered cell IDs, no-cell error. Tây Nguyên trong Document 08 chỉ là golden example.
- Map thêm year-only.
- Calendar thêm `/calendar/days` với 28–31 item.
- Selection, coverage và summary là schema chung.
- Dual map dùng hai request; delta chỉ khi compatible.
- Cell-period provenance tải on-demand.
- Harmonization comparison chuyển Optional; Data Notes vẫn Must.
- Seasonal aggregate, rank, anomaly, export, persisted custom area và raw detections deferred.

# 4. Invariants bắt buộc

- `snpp_eq` không phải số vụ cháy, diện tích cháy, risk hoặc forecast.
- Grid marker là tâm cell 0,25°, không phải raw hotspot coordinate.
- `0` là dữ liệu thật; missing/outside/error không bao giờ dùng `0`.
- Calendar placeholder ngoài range dùng `value=null`, `OUTSIDE_DATASET_RANGE`.
- Daily direct/scaled/model-redistributed/mixed phải được phân biệt.
- Partial có requested/covered range và day counts.
- Cùng bbox + dataVersion phải resolve cùng canonical cell set.
- Không gắn anomaly label từ delta đơn giản.

# 5. Quy tắc triển khai song song

- Backend member đang làm v0.3 có thể tiếp tục phần không xung đột: metadata, named-area resolution, daily aggregation, service interfaces, Problem Details nền.
- Không đổi controller/service public surface sang bbox/year-map/calendar-days trước khi OpenAPI v0.4 được duyệt.
- Frontend dùng Document 08 làm fixture sau khi field names được chốt; không hardcode golden values vào production.
- Khi v0.3 và v0.4 khác nhau, ghi rõ baseline/proposal; không âm thầm coi proposal là code đã có.

# 6. Tài liệu lịch sử

Các file v0.1 và v0.2 được giữ nguyên. Không dùng chúng để ghi đè decision v0.3/v0.4 mới hơn.
