---
subtitle: Architecture, Implementation Plan & Readiness Checklist
title: HỎA LỊCH
source_docx: HoaLich_06_Technical_Design_Implementation_Plan_v0.1.docx
format: github-flavored-markdown
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 06**

| **Thông tin** | **Giá trị**                                                               |
|---------------|---------------------------------------------------------------------------|
| **Phiên bản** | v0.1 – Bản thiết kế để nhóm rà soát                                       |
| **Ngày**      | 14/11/2026                                                                |
| **Dự án**     | NASA Space Apps Challenge 2026                                            |
| **Căn cứ**    | Vision & Scope v0.1; User Stories v0.1; Hỏa Lịch harmonization handoff v1 |

> **Quyết định kỹ thuật đã chốt — 14/11/2026:** Backend sử dụng **Java + Spring Boot** cho REST API. Python chỉ dùng cho pipeline harmonization chạy offline; frontend theo thiết kế hiện tại là React + TypeScript. Ưu tiên đọc JSON/CSV đã xử lý trong MVP, chưa bắt buộc PostgreSQL, JPA hay xác thực người dùng. Ghi chú này cập nhật lựa chọn trước đó từ mức “đề xuất” sang “đã chốt”; nội dung tài liệu Word gốc vẫn được giữ nguyên.

# 1. Kiến trúc tham chiếu

Khuyến nghị cho nhóm Software Engineering: React + TypeScript cho giao diện; Spring Boot REST API (Java) cho lớp truy vấn; bộ dữ liệu harmonization v1 được xử lý trước bằng Python và đóng gói dưới dạng CSV/JSON. Không retrain ML khi người dùng bấm lọc.

| **Layer**                     | **Trách nhiệm / công nghệ đề xuất**                                                                                           |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **Data Preparation – Python** | Dùng hoalich_pipeline.py / export đã bàn giao, xác thực hash + kiểm định + xuất bảng dễ truy vấn; dữ liệu sản phẩm k_cell=60. |
| **Data Storage**              | MVP: files JSON/CSV precomputed index vào bộ nhớ / SQLite. Nếu cần query lớn, PostgreSQL có thể bổ sung sau; không bắt buộc.  |
| **Backend – Spring Boot**     | Read-only REST endpoints, filter validation, aggregation, metadata, status missing/partial, cache nhẹ.                        |
| **Frontend – React/TS**       | Quản lý filter state, calendar, grid map, trend, tooltip và messages về provenance.                                           |
| **Deployment**                | Frontend static hosting + backend container; data snapshot version cố định; CORS giới hạn domain demo.                        |

# 2. Phân rã modules & trách nhiệm

| **Module**                   | **Đầu vào**                                                                        | **Đầu ra / Phụ thuộc**                                      |
|------------------------------|------------------------------------------------------------------------------------|-------------------------------------------------------------|
| **Dataset Loader**           | web_cells_pentad.json, harmonized_025_month.csv, regions_pentad.csv, cells_025.csv | Validated in-memory/indexed objects; metadata + dataVersion |
| **Area/Time Resolver**       | areaType, areaId, year, month/pentad                                               | Xác nhận phạm vi, ngày partial, region mapping              |
| **Aggregation Service**      | Kỳ/area + indexed data                                                             | calendar, map cells, trends, no double counting             |
| **Anomaly Service (Should)** | Lịch sử cùng mùa, quy tắc baseline                                                 | Delta / percentile / “insufficient baseline”                |
| **API Controllers**          | Query params                                                                       | JSON contract theo Document 04; error 4xx rõ nghĩa          |
| **UI Components**            | Filters + API responses                                                            | Calendar/Map/Trend/Tooltip/Warnings                         |

# 3. Quyết định lưu trữ và hiệu năng

- Không chuyển file harmonized_with_detections.json ~1,08 GB qua frontend; không load toàn bộ detections để vẽ map.

- Ưu tiên dữ liệu web_cells_pentad.json ~4,8 MB cho grid pentad; backend chỉ trả slice được lọc theo năm/vùng/kỳ.

- Index các CSV theo (area/cell,year,month/pentad) khi khởi động hoặc tiền xử lý thành file tối ưu; cache metadata và query phổ biến.

- Khi hiển thị 5 vùng chẩn đoán, nên đọc bảng regions_pentad có sẵn thay vì cộng raw detections trùng vệ tinh.

- Phiên bản data snapshot chứa model k_cell=60. Nếu nhóm dữ liệu đổi k=100 phải xuất lại toàn bộ artifacts liên quan và chạy regression.

# 4. Delivery Plan – từng increment

| **Sprint / thứ tự**    | **Work item & đầu ra**                                          | **Điều kiện hoàn thành**                                      |
|------------------------|-----------------------------------------------------------------|---------------------------------------------------------------|
| **0. Data handoff**    | Extract nguồn nhẹ, kiểm schema, sample, hash và status partial. | Đọc được 587 cells và 27 years, đối chiếu 3 giá trị mẫu.      |
| **1. API core**        | /metadata, /areas, /calendar, /map/cells, /trends.              | API smoke tests, input validation, missing khác zero.         |
| **2. UI core**         | Explore screen + filter, calendar, map, trend, glossary.        | Demo chọn vùng/thời gian và so sánh đồng bộ.                  |
| **3. Accuracy + UX**   | Cross-check CSV, partial flag, responsiveness, errors.          | Có test data checks và review visual.                         |
| **4. Enhancements**    | Anomaly, cell drawer, export nếu còn thời gian.                 | Chỉ bật khi baseline và acceptance criteria được chốt.        |
| **5. Submission demo** | Ổn định môi trường, demo script, README, citations, video.      | Demo offline rehearsal, không phụ thuộc nguồn live bên ngoài. |

# 5. Verification & Test Strategy

- Data unit tests: các value cell/month khớp harmonized_025_month.csv; valid range; null bảo toàn; pentad 1..73.

- API integration tests: 200/4xx, filter validation, partial-year warning và cùng filter ở calendar/map/trend.

- Frontend E2E smoke: chọn Tây Nguyên, năm 2024, đổi granularity, click cell, mở provenance; lỗi/missing states.

- Regression snapshot: lưu ba ví dụ tiêu biểu từ data v1 + metadata version để phát hiện sai khác do thay nguồn.

- Visualization QA: legend, thang màu, ghi chú phương pháp, responsive desktop/mobile, contrast/keyboard.

- Privacy/safety: API chỉ đọc; không dùng metric để cảnh báo cháy thời gian thực; tránh khẳng định có dự báo.

# 6. Open Decisions & Blockers (phải chốt trước triển khai tính năng liên quan)

| **Mã**  | **Quyết định**      | **Khuyến nghị / tác động**                                                                          |
|---------|---------------------|-----------------------------------------------------------------------------------------------------|
| **D01** | Phạm vi chọn vùng   | Chốt dùng ToanQuoc + 5 vùng chẩn đoán + 587 cells; chưa dùng tên tỉnh/huyện trong bản đầu.          |
| **D02** | Anomaly rule        | Đề xuất median cùng kỳ mùa vụ ≥5 năm đủ kỳ; chưa khẳng định ngưỡng “bất thường”; giữ Should.        |
| **D03** | Partial/coverage    | Chốt ngày dataThrough và các năm 2000/2012/2026; NRT update chỉ khi tái xuất data snapshot.         |
| **D04** | Provenance          | src tháng không per-cell; chỉ hiển thị nguồn ở cấp đúng hoặc bỏ nhãn chi tiết.                      |
| **D05** | Validation khoa học | Giữ k_cell=60 và không dùng lo90/hi90 làm bảo đảm; bản phát hành sau phải kiểm thử nếu đổi mô hình. |
| **D06** | Hosting / owner     | Chọn người giữ dataset snapshot và người phụ trách API, UI, QA, demo; gắn issue owner.              |

# 7. Implementation Readiness Gate

- Đủ để bắt đầu code MVP lõi nếu chấp nhận area scope và data snapshot hiện tại (D01, D03, D04).

- Chưa đủ để tuyên bố sản phẩm hoàn thành cho người quản lý rừng: cần usability feedback, đối chiếu số liệu và mô tả hạn chế.

- Không để các Should/Could chặn Must. Anomaly chỉ implement khi đã chốt baseline và phương pháp giải thích.

- Mỗi PR cần chỉ rõ US/FR liên quan; demo checklist phải đối chiếu với yêu cầu chứ không chỉ dựa vào screenshot.

Lưu ý: Lựa chọn stack, SLA và các ngưỡng là đề xuất triển khai của nhóm, không phải cam kết đã kiểm nghiệm. Bản tài liệu gắn với data v1 hiện có và cần cập nhật nếu pipeline thay đổi.
