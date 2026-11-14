---
subtitle: Functional & Non-functional Requirements
title: HỎA LỊCH
source_docx: HoaLich_03_Functional_Nonfunctional_Requirements_v0.1.docx
format: github-flavored-markdown
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 03**

| **Thông tin** | **Giá trị**                                                               |
|---------------|---------------------------------------------------------------------------|
| **Phiên bản** | v0.1 – Bản thiết kế để nhóm rà soát                                       |
| **Ngày**      | 14/11/2026                                                                |
| **Dự án**     | NASA Space Apps Challenge 2026                                            |
| **Căn cứ**    | Vision & Scope v0.1; User Stories v0.1; Hỏa Lịch harmonization handoff v1 |

# 1. Mục tiêu và quy ước

Đặc tả các yêu cầu triển khai MVP Hỏa Lịch. Các yêu cầu được truy vết theo US01–US09; mọi chỉ số là số phát hiện ban ngày đã lọc nguồn tĩnh, tương đương S-NPP (snpp_eq), không phải số vụ cháy, diện tích cháy hay dự báo rủi ro.

Must = phải hoàn thành để demo; Should = ưu tiên sau luồng cốt lõi; Could = tùy thời gian. Nguồn v1 là dữ liệu lịch sử đến 13/11/2026, với các khoảng đầu/cuối chuỗi chưa đủ kỳ.

# 2. Functional Requirements

| **ID**   | **Ưu tiên / US** | **Chức năng**            | **Yêu cầu có thể kiểm thử**                                                                                                                                             |
|----------|------------------|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **FR01** | Must / US01      | Chọn phạm vi             | Cho phép chọn ToanQuoc, 5 vùng chẩn đoán (DBSCL, TayNguyen, TayBac, DBSH, Khac) hoặc một ô 0,25° có trong cells_025.csv. Không mặc định xem đó là ranh giới hành chính. |
| **FR02** | Must / US02      | Lọc thời gian            | Cho phép chọn năm, tháng hoặc pentad trong các kỳ có dữ liệu; áp dụng đồng bộ trên lịch, bản đồ và xu hướng. Khóa kỳ ngoài phạm vi dữ liệu.                             |
| **FR03** | Must / US03      | Lịch hoạt động cháy      | Hiển thị heatmap theo tháng hoặc pentad, chú giải thang màu, giá trị snpp_eq và trạng thái thiếu dữ liệu; có tooltip/click cho mỗi kỳ.                                  |
| **FR04** | Must / US04      | Bản đồ ô lưới            | Hiển thị giá trị snpp_eq tổng hợp theo ô 0,25°; thay đổi cùng bộ lọc. Không tạo điểm tọa độ giả từ dự báo.                                                              |
| **FR05** | Must / US05      | So sánh lịch sử          | Biểu đồ xu hướng theo thời gian dùng cùng một chỉ số; so sánh kỳ tương ứng khi năm chưa hoàn chỉnh và ghi cảnh báo thiếu kỳ.                                            |
| **FR06** | Must / US07      | Nguồn & giới hạn         | Giải thích FIRMS, MODIS–VIIRS, k_cell=60, định nghĩa snpp_eq, ô 0,25°, pentad và các giới hạn: missing != 0, không cảnh báo thời gian thực.                             |
| **FR07** | Must / US01–US05 | Đồng bộ trạng thái       | Một filter state duy nhất quản lý khu vực, năm, tháng/pentad; URL hoặc state thể hiện filter và cho phép reset; loading/empty/error có thông báo riêng.                 |
| **FR08** | Should / US06    | Chỉ báo bất thường       | So cùng khu vực và kỳ mùa vụ; đề xuất baseline là trung vị các năm đủ kỳ, chỉ hiển thị khi số năm đủ ngưỡng. Quy tắc và ngưỡng cần được nhóm chốt trước khi bật.        |
| **FR09** | Should / US08    | Chi tiết ô lưới          | Click ô lưới để xem mã ô, tâm ô, kỳ thời gian, snpp_eq và ghi chú cấp độ dữ liệu; không dùng source tổng hợp tháng như nguồn chính xác theo ô–ngày.                     |
| **FR10** | Could / US09     | Xuất CSV                 | Xuất số liệu đã lọc có unit, nguồn, version, trạng thái thiếu dữ liệu; giá trị CSV khớp biểu đồ cùng bộ lọc.                                                            |
| **FR11** | Should / US07    | Minh chứng harmonization | Thêm màn giải thích trước/sau từ bộ thống kê đối chứng được kiểm tra; không ghép raw từ nhiều vệ tinh như số đếm tương đương.                                           |

# 3. Data & Business Rules

- BR01 — snpp_eq là giá trị thập phân có thể do mô hình ước lượng; hiển thị đơn vị “số phát hiện tương đương S-NPP”, không đổi thành số vụ cháy.

- BR02 — null/không có bản ghi = không đủ dữ liệu hoặc kỳ không có giá trị hợp lệ; không tự động coi là zero. Giá trị 0 có nguồn trong dữ liệu phải giữ bằng 0.

- BR03 — năm 2000, 2012 chuyển tiếp và 2026 cần thông tin partial/transition thích hợp; tránh so toàn năm 2026 với năm đủ 12 tháng.

- BR04 — 5 vùng chẩn đoán là khung phân tích; khi hiển thị “vùng”, phải ghi rõ không tương đương ranh giới tỉnh/huyện.

- BR05 — nếu các nguồn ngày có S-NPP hợp lệ, pipeline ưu tiên S-NPP; các nguồn khác là fallback, không cộng thô nhiều vệ tinh.

- BR06 — nhãn source tháng của bản v1 không chứng minh nguồn cảm biến riêng từng ô/ngày; provenance chi tiết cần cube_daily_day_veg.npz.

- BR07 — kỳ pentad 1..73, mỗi kỳ 5 ngày theo thứ tự ngày-trong-năm, kỳ 73 gồm cả ngày 366 năm nhuận. Ngày quan sát từ FIRMS là UTC.

- BR08 — chưa chuẩn hóa FRP, brightness, confidence xuyên cảm biến; không trộn chúng vào cùng thước đo snpp_eq.

# 4. Non-functional Requirements

| **ID**    | **Nhóm**         | **Mục tiêu chấp nhận đề xuất**                                                                                                 |
|-----------|------------------|--------------------------------------------------------------------------------------------------------------------------------|
| **NFR01** | Hiệu năng        | API trả JSON thống kê nhẹ p95 ≤ 2 giây ở bộ dữ liệu tiền xử lý, máy demo và 5 request đồng thời; đo thực tế trước khi công bố. |
| **NFR02** | Khả dụng         | Luồng chính hoạt động ở Chrome/Edge mới trên desktop 1366px và mobile ≥ 375px; không có cuộn ngang ngoài các bảng cố ý scroll. |
| **NFR03** | Tính nhất quán   | Tổng năm/vùng/ô kiểm tra khớp bảng nguồn trong sai số làm tròn 0,01; phân biệt missing và zero ở mọi tầng.                     |
| **NFR04** | Giải thích       | Mọi biểu đồ có tiêu đề, đơn vị, phạm vi thời gian, chú giải màu và ghi chú năm chưa đủ dữ liệu.                                |
| **NFR05** | Độ bền           | Backend có log lỗi và fallback thông báo rõ khi thiếu nguồn dữ liệu; không để biểu đồ hiển thị như 0 khi API lỗi.              |
| **NFR06** | Bảo mật MVP      | Public read-only API; validate area ID, time range; giới hạn query/rate và không đưa dữ liệu nhạy cảm/API keys vào frontend.   |
| **NFR07** | Khả năng tái lập | Công bố dataVersion, model k_cell=60, kỳ cuối dữ liệu, hash hoặc manifest; không sửa trực tiếp số liệu nguồn.                  |
| **NFR08** | Tiếp cận         | Không truyền đạt mức cháy chỉ bằng màu; có số/nhãn và hỗ trợ điều hướng bàn phím cho bộ lọc.                                   |

# 5. Definition of Done cho các FR Must

- Có dữ liệu thật trên cả lịch và bản đồ, không dùng số minh họa làm sản phẩm.

- Các bộ lọc đổi đồng bộ, có empty/error/loading, xử lý năm 2026 chưa đầy đủ.

- API và UI cùng đơn vị snpp_eq, dữ liệu so sánh có thể đối chiếu về CSV/JSON gốc.

- Có tài liệu/tooltip giải thích harmonization, phạm vi áp dụng và độ bất định.

- Có ít nhất một demo xuyên suốt và bộ test smoke cho US01–US05, US07.

Lưu ý: Ngưỡng NFR, thuật toán anomaly và xử lý phạm vi hành chính là đề xuất thiết kế, chưa phải kiểm định thực địa hay cam kết hiệu năng.
