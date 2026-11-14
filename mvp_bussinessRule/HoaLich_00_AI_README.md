---
title: Hỏa Lịch — AI Documentation Index
version: v0.1
updated: 2026-11-14
language: vi
backend: Java Spring Boot
frontend: React TypeScript
data_pipeline: Python offline
status: MVP specification, not tested implementation
---

# HỎA LỊCH — TÀI LIỆU CHO AI / ĐỘI PHÁT TRIỂN

Đây là bộ đặc tả MVP của dự án Hỏa Lịch (NASA Space Apps Challenge 2026), chuyển trực tiếp từ 6 file Word trong cùng thư mục. **File `.docx` là bản gốc, các file `.md` dành cho AI đọc, tìm kiếm và triển khai.** Nội dung chưa phải API đã chạy hoặc chức năng đã hoàn thành.

## Thứ tự đọc

1. [01 — Product Vision & Scope](HoaLich_01_Product_Vision_and_Scope_v0.1.md): ai sử dụng, vấn đề gì, giá trị và giới hạn sản phẩm.
2. [02 — User Stories](HoaLich_02_User_Stories_v0.1.md): US01–US09, ưu tiên Must/Should/Could và acceptance criteria.
3. [03 — Functional & Non-functional Requirements](HoaLich_03_Functional_Nonfunctional_Requirements_v0.1.md): FR01–FR11, business rules, NFR, Definition of Done.
4. [04 — API & Data Contract](HoaLich_04_API_Data_Contract_v0.1.md): nguồn dữ liệu, REST endpoints, JSON mẫu, validation cases.
5. [05 — UI/UX & User Flow](HoaLich_05_UIUX_User_Flow_Wireframe_v0.1.md): information architecture, UI states và demo scenario.
6. [06 — Technical Design & Implementation Plan](HoaLich_06_Technical_Design_Implementation_Plan_v0.1.md): kiến trúc, modules, thứ tự code, kiểm thử và blockers.

## Quyết định kỹ thuật mới nhất (đã chốt ngày 14/11/2026)

- **Backend:** Java + Spring Boot, cung cấp REST API chỉ đọc, validation, filtering và aggregation.
- **Frontend:** React + TypeScript (theo thiết kế hiện tại).
- **Data pipeline:** Python xử lý harmonization offline; **không retrain** khi người dùng yêu cầu dữ liệu.
- **Storage MVP:** JSON/CSV đã xử lý, index in-memory hoặc SQLite nếu cần; PostgreSQL/PostGIS là hướng mở rộng, chưa bắt buộc.
- **Phạm vi MVP:** phân tích lịch sử hoạt động cháy tại Việt Nam; không có AI fire forecasting hoặc real-time fire alerts.

## Các ràng buộc dữ liệu bắt buộc

- `snpp_eq`: **số phát hiện tương đương S-NPP**, không phải số vụ cháy hoặc diện tích cháy.
- `missing` khác `0`; không mặc định kỳ không có dữ liệu thành zero.
- Dữ liệu năm 2026 chưa hoàn chỉnh. Những so sánh lịch sử cần có nhãn `partial` và cách so sánh tương ứng.
- Phạm vi địa lý ban đầu: `ToanQuoc`, 5 vùng chẩn đoán và tập ô lưới 0,25° đã được dữ liệu hỗ trợ; **không tự coi các vùng chẩn đoán là ranh giới hành chính**.
- Không gửi JSON detections khoảng 1,08 GB xuống frontend. Không đặt điểm nhiệt giả tại tọa độ của giá trị ước lượng.
- Data snapshot ở phiên bản này dùng `k_cell=60`. Nếu thuật toán đổi, phải tái xuất dữ liệu và kiểm tra regression.

## Những việc còn phải chốt / kiểm thử

1. Kiểm chứng các con số mẫu và field mapping với file gốc trong `HoaLich_harmonization_handoff_v1.zip`.
2. Chốt ngưỡng, baseline và điều kiện dùng Anomaly Detection trước khi triển khai US06/FR08.
3. Xác nhận nhu cầu người dùng mục tiêu bằng khảo sát/thử nghiệm nếu có điều kiện.
4. Chạy API tests, frontend E2E tests và thử nghiệm với dữ liệu thật trước khi demo.

## Quy tắc cho AI khi triển khai

- Ưu tiên **User Stories & Acceptance Criteria → Requirements → API Contract → Technical Design** khi sinh code; Vision & Scope điều chỉnh phạm vi và ngôn ngữ sản phẩm.
- Không tự thêm authentication, realtime tracking, dự báo cháy, JPA/database phức tạp nếu chưa có yêu cầu.
- Trường hợp tài liệu v0.1 dùng ngôn ngữ “khuyến nghị Spring Boot”, **quyết định stack đã chốt ở README này và Document 06 Markdown có hiệu lực mới hơn**.
- Khi đưa ra quyết định chưa có trong bộ tài liệu, nêu rõ đó là đề xuất, không trình bày là requirement đã được phê duyệt.
