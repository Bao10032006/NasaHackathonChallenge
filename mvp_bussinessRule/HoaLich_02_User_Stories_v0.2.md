---
subtitle: User Stories & Acceptance Criteria
title: HỎA LỊCH
version: v0.2
updated: 2026-11-14
language: vi
---

**PRODUCT REQUIREMENTS · DOCUMENT 02 · v0.2**

# 1. Mục đích và quy ước

Tài liệu chuyển Product Vision v0.2 thành backlog có thể thiết kế, triển khai và kiểm thử. Must là yêu cầu cho luồng demo cốt lõi; Should chỉ bật khi dependency khoa học/kỹ thuật được chốt; Could là mở rộng sau MVP hoặc discovery.

# 2. User Story Backlog

| ID | User Story | Ưu tiên |
|---|---|---|
| US01 | Chọn khu vực phân tích | Must |
| US02 | Lọc thời gian được hỗ trợ | Must |
| US03 | Xem calendar và seasonality | Must |
| US04 | Xem bản đồ hoạt động cháy | Must |
| US05 | Xem xu hướng và so sánh lịch sử cùng kỳ | Must |
| US06 | Nhận biết giai đoạn bất thường | Should |
| US07 | Hiểu nguồn dữ liệu và harmonization | Must |
| US08 | Xem chi tiết ô lưới/khu vực | Should |
| US09 | Xuất dữ liệu CSV | Could |
| US10 | Khám phá hoạt động theo ngày cụ thể | Could / Discovery |

# 3. Detailed User Stories

## US01. Chọn khu vực phân tích | Must

Là người dùng, tôi muốn chọn một khu vực được dataset hỗ trợ để các thành phần phân tích sử dụng cùng phạm vi.

**Acceptance Criteria**

- Hỗ trợ `ToanQuoc`, 5 vùng chẩn đoán và các cell 0,25° hợp lệ.
- Khi đổi khu vực, calendar, map, seasonality, comparison và trends cập nhật đồng bộ.
- Không gọi vùng chẩn đoán là tỉnh/huyện; không có dữ liệu phải hiển thị empty state thay vì `0`.

## US02. Lọc thời gian được hỗ trợ | Must

Là người dùng, tôi muốn chọn năm và tháng/pentad để xem đúng kỳ quan tâm.

**Acceptance Criteria**

- Chỉ cho phép năm và kỳ nằm trong metadata của snapshot.
- Granularity MVP là `month` hoặc `pentad`; UI không hiển thị Day View mặc định.
- Kỳ/năm chưa đầy đủ có nhãn `partial` và không được so như năm đủ kỳ.
- Filter state có thể reset và được dùng nhất quán ở mọi panel.

## US03. Xem calendar và seasonality | Must

Là người quản lý rừng, tôi muốn xem calendar tháng/pentad và mẫu hình lịch sử của cùng khu vực để nhận biết hoạt động thường tập trung vào thời điểm nào trong năm.

**Acceptance Criteria**

- Calendar hiển thị `snpp_eq`, trạng thái dữ liệu, thang màu, tooltip/click và đơn vị.
- Có ngữ cảnh seasonality theo cùng period qua nhiều năm: baseline, khoảng năm và số năm hợp lệ.
- Giai đoạn cao theo lịch sử được mô tả là “hoạt động lịch sử cao”, không phải cảnh báo hoặc dự báo.
- Missing, zero và partial được phân biệt trong dữ liệu và giao diện.

## US04. Xem bản đồ hoạt động cháy | Must

Là người dùng, tôi muốn xem phân bố hoạt động cháy trên lưới Việt Nam trong kỳ đã chọn.

**Acceptance Criteria**

- Map dùng cùng khu vực, năm và period với calendar.
- Mỗi cell có bounds, giá trị/trạng thái và chú giải; không vẽ tọa độ hotspot giả cho giá trị ước lượng.
- Chỉ hiển thị độ chính xác địa lý ở cấp dataset hỗ trợ.

## US05. Xem xu hướng và so sánh lịch sử cùng kỳ | Must

Là người phân tích, tôi muốn xem chuỗi nhiều năm và so kỳ được chọn với lịch sử cùng kỳ để hiểu mức độ cao/thấp trong bối cảnh.

**Acceptance Criteria**

- Chuỗi xu hướng dùng cùng metric, area và period; có coverage/partial cho từng điểm.
- Phần comparison trả giá trị kỳ được chọn, baseline, chênh lệch, khoảng năm và số mẫu hợp lệ.
- Baseline chỉ dùng các kỳ tương ứng và bỏ các điểm không đủ dữ liệu theo quy tắc đã công bố.
- Comparison mô tả chênh lệch thống kê; không tự động gọi là anomaly hoặc nguy cơ cháy.

## US06. Nhận biết giai đoạn bất thường | Should

Là người phân tích, tôi muốn biết kỳ được chọn có vượt ngưỡng lịch sử cùng mùa hay không để ưu tiên tìm hiểu thêm.

**Acceptance Criteria**

- Chỉ bật sau khi chốt baseline, ngưỡng, tập năm tham chiếu và số năm tối thiểu.
- Payload/UI công bố method, threshold, sample size và trạng thái `insufficient_baseline`.
- Năm mục tiêu không được tự động đưa vào baseline nếu quy tắc chưa nói rõ.
- Không dùng từ “cảnh báo cháy”, “nguy cơ” hoặc “dự báo”.

## US07. Hiểu nguồn dữ liệu và harmonization | Must

Là người dùng, tôi muốn hiểu nguồn MODIS/VIIRS, cách harmonization và giới hạn để diễn giải đúng kết quả.

**Acceptance Criteria**

- Giải thích NASA FIRMS, khác biệt cảm biến, `snpp_eq`, lưới, time granularity và data version.
- Có ít nhất một so sánh raw versus harmonized từ artifact đã kiểm định.
- Nêu rõ harmonization không làm các hotspot trở thành cùng một điểm cháy.
- Nêu rõ sản phẩm là phân tích lịch sử, không phải real-time alert hoặc fire forecasting.

## US08. Xem chi tiết ô lưới/khu vực | Should

Là người phân tích, tôi muốn chọn cell/khu vực để xem kỳ, giá trị, trạng thái và ngữ cảnh dữ liệu.

**Acceptance Criteria**

- Panel hiển thị cell/area ID, bounds nếu có, metric, period, value/status và data version.
- Không gán provenance chi tiết hơn artifact nguồn cho phép.
- Không có dữ liệu phải hiển thị rõ, không thay bằng `0`.

## US09. Xuất dữ liệu CSV | Could

Là nhà nghiên cứu, tôi muốn tải tập dữ liệu phù hợp với filter hiện tại.

**Acceptance Criteria**

- CSV khớp giá trị hiển thị, có metric/unit, period, status, version và ghi chú nguồn.
- Missing giữ là missing; không biến thành `0`.

## US10. Khám phá hoạt động theo ngày cụ thể | Could / Discovery

Là người dùng, tôi muốn chọn một ngày cụ thể và xem hoạt động ngày đó trong bối cảnh lịch sử, nếu dữ liệu có thể hỗ trợ một cách trung thực.

**Acceptance Criteria để chuyển sang Ready**

- Data team xác nhận định nghĩa giá trị ngày, cách tạo, coverage, uncertainty và mức kiểm định.
- API/UI phân biệt quan sát trực tiếp với giá trị được phân bổ hoặc ước lượng.
- Có quy tắc so sánh cùng ngày hoặc cùng cửa sổ mùa vụ qua các năm, kể cả ngày nhuận.
- Có test đối chiếu với artifact ngày; chưa đạt các điều kiện này thì không đưa `day` vào API/UI production.

# 4. Prioritization và Dependencies

- **Must:** US01–US05 và US07. Đây là luồng demo trả lời trực tiếp bài toán challenge.
- **Should:** US06 và US08. US06 phụ thuộc quyết định anomaly; US08 phụ thuộc metadata cấp cell.
- **Could:** US09. Không được chặn luồng demo.
- **Discovery:** US10. Phụ thuộc data review riêng và API contract mới.

# 5. Decisions to Confirm

- Baseline seasonality: khoảng năm, median/mean/percentile và cách loại kỳ partial.
- Anomaly: method, threshold, minimum sample size và ngôn ngữ giao diện.
- Day View readiness và ý nghĩa khoa học của giá trị ngày.
- Tên hiển thị chính thức cho baseline, comparison và harmonized metric.
- Snapshot dữ liệu dùng cho demo và `dataThrough` chính thức.

