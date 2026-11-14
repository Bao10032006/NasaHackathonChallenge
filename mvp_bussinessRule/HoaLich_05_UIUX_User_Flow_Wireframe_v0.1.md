---
subtitle: User Flow, Information Architecture & Wireframe Specification
title: HỎA LỊCH
source_docx: HoaLich_05_UIUX_User_Flow_Wireframe_v0.1.docx
format: github-flavored-markdown
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 05**

| **Thông tin** | **Giá trị**                                                               |
|---------------|---------------------------------------------------------------------------|
| **Phiên bản** | v0.1 – Bản thiết kế để nhóm rà soát                                       |
| **Ngày**      | 14/11/2026                                                                |
| **Dự án**     | NASA Space Apps Challenge 2026                                            |
| **Căn cứ**    | Vision & Scope v0.1; User Stories v0.1; Hỏa Lịch harmonization handoff v1 |

# 1. Trải nghiệm MVP

Một trang phân tích chính (không yêu cầu đăng nhập) để người dùng chọn vùng và thời gian, xem lịch hoạt động cháy, bản đồ và xu hướng, sau đó đọc giải thích nguồn dữ liệu. Ưu tiên đơn giản, minh bạch và thao tác trực tiếp; người dùng mục tiêu vẫn là giả định chưa khảo sát.

# 2. Information Architecture

| **Màn / thành phần**          | **Vai trò**                                                         | **Ưu tiên** |
|-------------------------------|---------------------------------------------------------------------|-------------|
| **Home / Explore**            | Giới thiệu sản phẩm, bộ lọc, lịch, bản đồ, biểu đồ xu hướng.        | Must        |
| **How it works / Data Notes** | Giải thích harmonization, định nghĩa snpp_eq, nguồn NASA, giới hạn. | Must        |
| **Details panel**             | Thông tin cell/vùng và giá trị từng kỳ.                             | Should      |
| **Anomalies panel**           | So sánh cùng mùa và lý giải tiêu chí bất thường.                    | Should      |
| **Export CSV**                | Tải bảng dữ liệu dùng lại.                                          | Could       |

# 3. Core User Flow

Mở trang → xem mô tả và cảnh báo chỉ số → chọn phạm vi (ToanQuoc / vùng chẩn đoán / cell) → chọn năm & granularity → xem calendar → xem map → xem trend → (tùy chọn) chọn cell hoặc anomaly → xem nguồn/giới hạn.

Nhánh lỗi: bộ lọc không hợp lệ → thông báo hướng dẫn; không có dữ liệu → empty state, không hiện 0; API lỗi → thông báo “Không tải được dữ liệu” và nút thử lại; năm partial → nhãn cảnh báo ngay trên biểu đồ.

# 4. Low-fidelity Wireframe – Desktop

| **Vị trí**       | **Nội dung giao diện**                                                         |
|------------------|--------------------------------------------------------------------------------|
| **HEADER**       | HỎA LỊCH Explore \| How it works \| Data Notes                                 |
| **INTRO**        | “Lịch sử hoạt động cháy tại Việt Nam” · Giải thích snpp_eq và phạm vi dữ liệu. |
| **FILTER BAR**   | \[Area type\] \[Area\] \[Year\] \[Month / Pentad\] \[Reset\]                   |
| **MAIN – LEFT**  | BURNING ACTIVITY CALENDAR (heatmap + tooltip, legend, partial badge)           |
| **MAIN – RIGHT** | FIRE ACTIVITY MAP (0,25° grid, legend, click cell)                             |
| **BELOW**        | HISTORICAL TRENDS (time-series) · Optional anomaly comparison                  |
| **FOOTER**       | Nguồn NASA FIRMS • model v1 / k=60 • dữ liệu lịch sử, không cảnh báo trực tiếp |

# 5. Layout trên mobile

Header rút gọn → bộ lọc 2 hàng → lịch → bản đồ → xu hướng → giải thích dữ liệu. Các mục phải cuộn dọc tự nhiên; không ép map và chart song song ở chiều rộng nhỏ. Tooltip phải có hành vi tap tương đương hover.

# 6. UI States & Copywriting

| **Trạng thái**        | **Quy định hiển thị**                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| **Loading**           | Skeleton hoặc spinner tại phần data, giữ bộ lọc hiển thị.                     |
| **No data**           | “Không có dữ liệu cho khu vực và kỳ đã chọn.” Không hiện số 0 giả.            |
| **Partial year**      | “Dữ liệu 2026 chỉ đến 13/11/2026; so sánh cùng khoảng thời gian.”             |
| **Error**             | “Không thể tải dữ liệu. Vui lòng thử lại.” Có nút Retry.                      |
| **Estimated metric**  | “Số phát hiện tương đương S-NPP (ước lượng/hài hòa), không phải số vụ cháy.”  |
| **Diagnostic region** | “Vùng phân tích phục vụ nghiên cứu, không phải ranh giới hành chính.”         |
| **Anomaly**           | “Cao hơn mức lịch sử cùng kỳ” kèm baseline/years; không dùng “cảnh báo cháy”. |

# 7. Component Checklist

- AppShell + Header; AreaSelector; TimeSelector; GranularityToggle; ResetFilters.

- ActivityCalendar + Legend + Tooltip; FireGridMap + CellDetailsDrawer.

- HistoricalTrendChart + YearPartialBadge; DataMethodologyPanel.

- Loading, Empty, Error + Retry; Responsive styling và keyboard-focus.

# 8. Demo Scenario (được chọn trước để QA)

Người dùng đóng vai cán bộ theo dõi hoạt động cháy: chọn vùng Tây Nguyên → chọn 2024 → xem các pentad nổi bật → đối chiếu cùng vùng theo chuỗi lịch sử → đọc mô tả tại sao dữ liệu giữa MODIS và VIIRS cần hài hòa. Demo dùng số thực trên giao diện; không chèn chỉ số minh họa vào dữ liệu.

Lưu ý: Đây là wireframe bằng chữ để nhóm dựng Figma/React; chưa phải thiết kế hình ảnh pixel-perfect hoặc kiểm thử người dùng.
