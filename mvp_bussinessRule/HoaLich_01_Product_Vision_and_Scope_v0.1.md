---
subtitle: Product Vision & Scope
title: HỎA LỊCH
source_docx: HoaLich_01_Product_Vision_and_Scope_v0.1.docx
format: github-flavored-markdown
---

**PRODUCT REQUIREMENTS · DOCUMENT 01**

| **Phiên bản** | v0.1 – Bản thảo để nhóm rà soát |
|---------------|---------------------------------|
| **Ngày**      | 14/11/2026                      |
| **Dự án**     | NASA Space Apps Challenge 2026  |
| **Challenge** | MODIS and VIIRS Hot Spots       |
| **Ngôn ngữ**  | Tiếng Việt                      |

# 1. Product Overview

## 1.1. Product Vision

Hỏa Lịch là nền tảng web trực quan hóa và phân tích lịch sử hoạt động cháy tại Việt Nam, sử dụng dữ liệu vệ tinh NASA MODIS và VIIRS đã được hài hòa (harmonized).

Nền tảng giúp người dùng khám phá xu hướng hoạt động cháy, xác định tính mùa vụ, so sánh các giai đoạn và nhận biết những biến động bất thường trong lịch sử.

## 1.2. Problem Statement

Dữ liệu phát hiện điểm nhiệt từ các vệ tinh MODIS và VIIRS có sự khác biệt về khả năng quan sát và phát hiện, khiến việc so sánh hoạt động cháy giữa nhiều năm có thể bị sai lệch.

Bên cạnh đó, dữ liệu vệ tinh thô khó tiếp cận và diễn giải đối với người dùng không chuyên về viễn thám.

**Vấn đề cần giải quyết:** Làm thế nào để chuyển dữ liệu vệ tinh từ nhiều cảm biến thành thông tin lịch sử hoạt động cháy nhất quán, trực quan và dễ sử dụng?

## 1.3. Target Users

| **Nhóm**      | **Đối tượng mục tiêu**                                                               | **Nhu cầu chính**                                                                             |
|---------------|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| **Primary**   | Cán bộ quản lý rừng, môi trường; người phụ trách phân tích và lập kế hoạch giám sát. | Xác định khu vực và thời kỳ hoạt động cháy đáng chú ý để tham khảo khi lập kế hoạch theo dõi. |
| **Secondary** | Nhà nghiên cứu, sinh viên; người quan tâm đến lịch sử hoạt động cháy.                | Khám phá xu hướng lịch sử, mùa vụ và khả năng so sánh dữ liệu qua nhiều năm.                  |

Lưu ý: Nhóm người dùng trên là giả định sản phẩm ban đầu, chưa được xác nhận bằng phỏng vấn người dùng.

## 1.4. Value Proposition

| **Giá trị**                      | **Mô tả**                                                                                          |
|----------------------------------|----------------------------------------------------------------------------------------------------|
| **Comparable Historical Data**   | Hài hòa dữ liệu MODIS–VIIRS nhằm cải thiện khả năng so sánh hoạt động cháy giữa các năm.           |
| **Understandable Fire Activity** | Chuyển dữ liệu vệ tinh thành bản đồ, lịch mùa vụ và biểu đồ dễ hiểu.                               |
| **Decision Support**             | Cung cấp thông tin lịch sử để nhận biết các khu vực, thời kỳ đáng chú ý khi lập kế hoạch theo dõi. |

## 1.5. Product Scope

| **In Scope – MVP**                                           | **Out of Scope – MVP**                                  |
|--------------------------------------------------------------|---------------------------------------------------------|
| **Bản đồ hoạt động cháy theo khu vực tại Việt Nam**          | Dự báo cháy rừng bằng AI                                |
| **Lịch hoạt động cháy theo tháng / pentad**                  | Cảnh báo cháy thời gian thực                            |
| **Phân tích xu hướng và mùa vụ lịch sử**                     | Xác định chính xác số vụ cháy thực tế                   |
| **So sánh lịch sử và làm rõ giai đoạn bất thường**           | Thay thế hệ thống giám sát cháy chính thức              |
| **Giải thích nguồn NASA, harmonization và giới hạn dữ liệu** | Tuyên bố mức độ rủi ro cháy tương lai từ số đếm lịch sử |

## 1.6. Core User Journey

Truy cập Hỏa Lịch → Chọn khu vực → Chọn khoảng thời gian → Xem lịch và bản đồ hoạt động cháy → So sánh với lịch sử → Nhận biết thời kỳ hoạt động cháy cao hoặc bất thường.

# 2. Data Interpretation & Guardrails

- Số phát hiện đã hài hòa là thước đo hoạt động cháy tương đương theo chuẩn cảm biến, không phải số vụ cháy thực tế.

- Dữ liệu lịch sử không tự động thể hiện nguy cơ hoặc dự báo cháy trong tương lai.

- Khi dữ liệu thiếu hoặc một năm chưa đầy đủ, giao diện phải nêu rõ giới hạn so sánh.

- Những dấu hiệu bất thường chỉ mang ý nghĩa phân tích thống kê và cần có cách tính, nguồn so sánh được giải thích.

# 3. Success Criteria – phiên bản đề xuất

- Người dùng hoàn thành được luồng chính: chọn vùng và thời gian → xem lịch/bản đồ → so sánh lịch sử.

- Mọi chỉ số hiển thị có tên gọi, đơn vị và mô tả nguồn dữ liệu nhất quán.

- Một tình huống demo có thể giải thích vì sao harmonization làm thay đổi cách đọc xu hướng lịch sử.

Lưu ý: Các tiêu chí thành công cần được chuyển thành Acceptance Criteria đo được trong giai đoạn triển khai. Đây là tài liệu định hướng, chưa phải SRS đã duyệt.
