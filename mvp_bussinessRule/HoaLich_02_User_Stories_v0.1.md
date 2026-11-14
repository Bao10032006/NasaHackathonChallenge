---
subtitle: User Stories & Acceptance Criteria
title: HỎA LỊCH
source_docx: HoaLich_02_User_Stories_v0.1.docx
format: github-flavored-markdown
---

**PRODUCT REQUIREMENTS · DOCUMENT 02**

| **Phiên bản** | v0.1 – Bản thảo để nhóm rà soát        |
|---------------|----------------------------------------|
| **Ngày**      | 14/11/2026                             |
| **Dự án**     | NASA Space Apps Challenge 2026         |
| **Cơ sở**     | Product Vision & Scope v0.1            |
| **Phạm vi**   | MVP – Phân tích lịch sử hoạt động cháy |

# 1. Purpose & Conventions

Tài liệu chuyển Product Vision thành các nhu cầu sử dụng cụ thể để nhóm thiết kế giao diện, API, kiểm thử và xác định phạm vi MVP. Các User Stories thể hiện nhu cầu giả định; chưa phải kết quả khảo sát người dùng.

**Mức ưu tiên:** Must = cần có cho luồng demo cốt lõi; Should = nên có nếu đủ nguồn lực; Could = mở rộng sau MVP.

# 2. User Story Backlog

| **ID**   | **User Story**                        | **Ưu tiên** | **Vai trò**                         |
|----------|---------------------------------------|-------------|-------------------------------------|
| **US01** | Chọn khu vực phân tích                | Must        | Người quản lý rừng / nhà nghiên cứu |
| **US02** | Lọc thời gian                         | Must        | Tất cả người dùng                   |
| **US03** | Xem lịch hoạt động cháy               | Must        | Người quản lý rừng / nhà nghiên cứu |
| **US04** | Xem bản đồ hoạt động cháy             | Must        | Tất cả người dùng                   |
| **US05** | So sánh hoạt động cháy theo thời gian | Must        | Người quản lý rừng / nhà nghiên cứu |
| **US06** | Nhận biết giai đoạn bất thường        | Should      | Người phân tích dữ liệu             |
| **US07** | Xem nguồn dữ liệu và phương pháp      | Must        | Tất cả người dùng                   |
| **US08** | Xem chi tiết ô lưới / khu vực         | Should      | Người phân tích dữ liệu             |
| **US09** | Xuất dữ liệu CSV                      | Could       | Nhà nghiên cứu / sinh viên          |

# 3. Detailed User Stories

## US01. Chọn khu vực phân tích \| Must

**User Story.** Là người quản lý rừng, tôi muốn chọn một khu vực được hệ thống hỗ trợ để xem lịch sử hoạt động cháy tại khu vực đó.

**Acceptance Criteria**

- Danh sách/vùng chọn chỉ bao gồm những khu vực có dữ liệu hoặc ô lưới hợp lệ trong bản phát hành.

- Khi đổi khu vực, lịch, bản đồ và biểu đồ (nếu đang mở) sử dụng cùng bộ lọc mới.

- Nếu không có bản ghi, giao diện hiển thị trạng thái “Không có dữ liệu” thay vì tự động gán giá trị 0.

## US02. Lọc thời gian \| Must

**User Story.** Là người dùng, tôi muốn chọn năm, tháng hoặc khoảng thời gian phù hợp để xem hoạt động cháy trong giai đoạn quan tâm.

**Acceptance Criteria**

- Chỉ cho phép chọn các mốc thời gian nằm trong phạm vi dữ liệu hiện có.

- Khi thay đổi thời gian, toàn bộ thành phần dữ liệu cập nhật đồng bộ.

- Nếu giai đoạn chưa đầy đủ (ví dụ năm hiện hành), màn hình hiển thị nhãn “Dữ liệu chưa đủ kỳ”.

## US03. Xem lịch hoạt động cháy \| Must

**User Story.** Là người quản lý rừng, tôi muốn xem lịch hoạt động cháy theo tháng hoặc pentad để nhận biết tính mùa vụ của khu vực.

**Acceptance Criteria**

- Các khoảng thời gian có giá trị được biểu diễn bằng màu/nhãn theo một thang đo có chú giải.

- Người dùng có thể xem giá trị, khoảng thời gian và đơn vị khi chọn hoặc di chuột vào một ô lịch.

- Không dùng nhãn “số vụ cháy”; dùng “mức/số phát hiện hoạt động cháy đã hài hòa” hoặc tên chỉ số thống nhất.

## US04. Xem bản đồ hoạt động cháy \| Must

**User Story.** Là người dùng, tôi muốn xem phân bố hoạt động cháy trên bản đồ Việt Nam để nhận biết sự khác biệt theo khu vực.

**Acceptance Criteria**

- Bản đồ phản ánh chính bộ lọc khu vực và thời gian đang sử dụng.

- Màu sắc có chú giải và được gắn với giá trị đã hài hòa ở cấp độ ô lưới/vùng được dữ liệu hỗ trợ.

- Phân biệt điểm phát hiện gốc với giá trị ước lượng theo ô lưới; không vẽ tọa độ giả cho giá trị ước lượng.

## US05. So sánh hoạt động cháy theo thời gian \| Must

**User Story.** Là người phân tích, tôi muốn so sánh các năm hoặc các giai đoạn để hiểu xu hướng lịch sử trong cùng khu vực.

**Acceptance Criteria**

- Biểu đồ hiển thị cùng một chỉ số đã hài hòa, có tên, đơn vị và phạm vi thời gian rõ ràng.

- Nếu so sánh năm chưa đủ dữ liệu, hệ thống cảnh báo hoặc chỉ so sánh phần thời gian tương ứng.

- Các khoảng thiếu dữ liệu được thể hiện là thiếu dữ liệu, không bị trình bày như giá trị bằng 0.

## US06. Nhận biết giai đoạn bất thường \| Should

**User Story.** Là người quản lý rừng, tôi muốn biết giai đoạn được chọn cao/thấp hơn mức lịch sử cùng mùa để ưu tiên tìm hiểu thêm.

**Acceptance Criteria**

- Chỉ dùng dữ liệu đã hài hòa và so sánh đúng kỳ mùa vụ tương ứng của cùng khu vực.

- Giao diện trình bày rõ giai đoạn tham chiếu, thước đo nền (cần chốt: trung bình/trung vị) và số năm dùng so sánh.

- Nếu thiếu dữ liệu nền, hệ thống ghi “Không đủ dữ liệu để đánh giá bất thường”; không suy diễn thành dự báo nguy cơ cháy.

## US07. Xem nguồn dữ liệu và phương pháp \| Must

**User Story.** Là người nghiên cứu, tôi muốn xem nguồn MODIS/VIIRS, cách hài hòa dữ liệu và giới hạn của kết quả để diễn giải đúng các chỉ số.

**Acceptance Criteria**

- Có mục giải thích nguồn NASA FIRMS, giai đoạn dữ liệu, cấp độ tổng hợp và mục đích harmonization.

- Nêu rõ số phát hiện tương đương không phải số đám cháy thực tế và không phải cảnh báo thời gian thực.

- Có mô tả tình trạng thiếu dữ liệu/chưa đủ năm và nguồn số liệu hoặc phiên bản pipeline đang dùng.

## US08. Xem chi tiết ô lưới / khu vực \| Should

**User Story.** Là nhà phân tích, tôi muốn chọn một ô lưới/khu vực để xem chỉ số của giai đoạn tương ứng và ngữ cảnh về dữ liệu.

**Acceptance Criteria**

- Chọn ô lưới/khu vực mở bảng thông tin có mốc thời gian, giá trị và nguồn/loại chỉ số nếu có.

- Khi không có dữ liệu cho ô đang chọn, hiển thị thông báo rõ ràng.

- Không khẳng định độ chính xác địa lý cao hơn cấp ô lưới mà dữ liệu hỗ trợ.

## US09. Xuất dữ liệu CSV \| Could

**User Story.** Là nhà nghiên cứu, tôi muốn tải bảng dữ liệu đã lọc về CSV để dùng cho phân tích và báo cáo riêng.

**Acceptance Criteria**

- File CSV chỉ chứa tập dữ liệu phù hợp với bộ lọc hiện tại.

- Có tiêu đề cột, tên chỉ số, đơn vị, giai đoạn và phiên bản dữ liệu hoặc ghi chú nguồn.

- Xuất đúng giá trị được hiển thị trên biểu đồ; không biến giá trị thiếu thành 0.

# 4. MVP Prioritization & Dependencies

| **Nhóm ưu tiên** | **User Stories**                   | **Phụ thuộc / ghi chú**                                                                    |
|------------------|------------------------------------|--------------------------------------------------------------------------------------------|
| **Must**         | US01, US02, US03, US04, US05, US07 | Cần dữ liệu thời gian/ô lưới đã xử lý; thống nhất thuật ngữ và cách thể hiện missing data. |
| **Should**       | US06, US08                         | US06 cần chốt cách tính baseline; US08 cần dữ liệu ở cấp ô lưới và metadata phù hợp.       |
| **Could**        | US09                               | Phụ thuộc API truy vấn, định nghĩa cột và giới hạn kích thước xuất dữ liệu.                |

# 5. Decisions to Confirm

- Xác nhận nhóm người dùng ưu tiên bằng trao đổi/phỏng vấn ngắn hoặc khảo sát.

- Chốt cách xác định “bất thường”: baseline là trung bình hay trung vị, tập năm tham chiếu và ngưỡng đánh dấu.

- Chốt đơn vị chọn vùng (vùng lớn, ô lưới 0,25°, hay ranh giới hành chính có dữ liệu đối chiếu).

- Chốt tên hiển thị chính thức của chỉ số harmonization và cách thể hiện giá trị ước lượng / dữ liệu thiếu.

- Chốt tập dữ liệu, thời điểm cập nhật, và xử lý riêng phần dữ liệu năm 2026 chưa đầy đủ.

Lưu ý: Bản v0.1 là backlog đề xuất dựa trên Product Vision. Nhóm nên rà soát Acceptance Criteria với dữ liệu thực tế và ưu tiên làm demo trước khi triển khai đủ toàn bộ Should/Could.
