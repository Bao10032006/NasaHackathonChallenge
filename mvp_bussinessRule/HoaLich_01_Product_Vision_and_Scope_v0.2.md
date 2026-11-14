---
subtitle: Product Vision & Scope
title: HỎA LỊCH
version: v0.2
updated: 2026-11-14
language: vi
---

**PRODUCT REQUIREMENTS · DOCUMENT 01 · v0.2**

# 1. Mục đích và thay đổi của phiên bản

Tài liệu xác định tầm nhìn, phạm vi MVP và cách Hỏa Lịch đáp ứng bài toán “Harmonization of MODIS and VIIRS Hotspots”. Phiên bản v0.2 kế thừa v0.1 và bổ sung yêu cầu rút ra từ phần giới thiệu challenge: sản phẩm phải thể hiện được cả giá trị của harmonization lẫn khả năng khám phá calendar, xu hướng, mùa vụ và điều kiện khác thường theo khu vực.

Các thay đổi chính so với v0.1:

- Làm rõ hai phần của challenge: harmonization dữ liệu và web application.
- Đưa so sánh cùng kỳ lịch sử và seasonality vào luồng demo bắt buộc.
- Giữ nhãn anomaly ở mức Should cho đến khi quy tắc thống kê được chốt.
- Đưa Day View vào phạm vi nghiên cứu có điều kiện, không cam kết trong MVP hiện tại.
- Đưa minh chứng trước/sau harmonization thành nội dung Must của demo.

# 2. Product Vision

Hỏa Lịch là nền tảng web trực quan hóa và phân tích lịch sử hoạt động cháy tại Việt Nam, sử dụng dữ liệu NASA FIRMS từ MODIS và VIIRS đã được hài hòa thành một chuỗi lịch sử nhất quán hơn.

Nền tảng giúp người dùng chọn khu vực và thời gian, xem lịch hoạt động cháy, khám phá xu hướng và mùa vụ, so sánh một kỳ với lịch sử cùng kỳ, đồng thời hiểu vì sao dữ liệu từ các cảm biến không thể so sánh trực tiếp khi chưa harmonization.

# 3. Challenge Alignment

## 3.1. Phần 1 — Harmonization

MODIS và VIIRS có độ phân giải, độ nhạy và lịch quan sát khác nhau. Hỏa Lịch sử dụng pipeline Python chạy offline để tạo chỉ số `snpp_eq` — số phát hiện ban ngày, đã lọc nguồn tĩnh, tương đương S-NPP.

Harmonization không có nghĩa một hotspot MODIS và một hotspot VIIRS trở thành cùng một điểm cháy. Kết quả là thước đo tổng hợp giúp cải thiện khả năng so sánh hoạt động cháy qua các giai đoạn và cảm biến, trong phạm vi sai số và giới hạn đã công bố.

## 3.2. Phần 2 — Burning Activity Calendar Web Application

Ứng dụng sử dụng các artifact đã xử lý để người dùng:

- Chọn một khu vực được dataset hỗ trợ.
- Chọn năm và kỳ tháng hoặc pentad.
- Xem calendar, bản đồ lưới và chuỗi xu hướng lịch sử.
- Nhận biết mẫu hình mùa vụ và so sánh kỳ được chọn với lịch sử cùng kỳ.
- Xem cách harmonization thay đổi cách đọc chuỗi lịch sử.
- Xem nhãn anomaly khi và chỉ khi phương pháp thống kê đã được chốt và đủ dữ liệu nền.

# 4. Target Users

| Nhóm | Đối tượng | Nhu cầu chính |
|---|---|---|
| Primary | Cán bộ quản lý rừng, môi trường; người lập kế hoạch theo dõi | Nhận biết khu vực, mùa và kỳ lịch sử đáng chú ý để ưu tiên tìm hiểu thêm. |
| Secondary | Nhà nghiên cứu, sinh viên và người quan tâm | Khám phá xu hướng, mùa vụ, dữ liệu harmonized và giới hạn phương pháp. |

Các nhóm người dùng là giả định sản phẩm ban đầu, chưa được xác nhận bằng nghiên cứu người dùng chính thức.

# 5. Value Proposition

- **Comparable historical series:** nối chuỗi MODIS–VIIRS bằng một chỉ số có định nghĩa nhất quán hơn.
- **Burning activity calendar:** chuyển dữ liệu dài hạn thành lịch tháng/pentad dễ khám phá.
- **Seasonal context:** cho biết kỳ nào thường có hoạt động cao trong lịch sử của cùng khu vực.
- **Historical comparison:** cho biết kỳ được chọn cao/thấp hơn baseline cùng kỳ, không suy diễn thành dự báo.
- **Transparent methodology:** giải thích nguồn, cách harmonization, độ bất định và giới hạn sử dụng.

# 6. Product Scope

## 6.1. Must — MVP và luồng demo cốt lõi

- Chọn `ToanQuoc`, 5 vùng chẩn đoán hoặc ô lưới 0,25° được hỗ trợ.
- Lọc theo năm và granularity `month` hoặc `pentad`.
- Calendar, bản đồ lưới và biểu đồ xu hướng sử dụng cùng filter state.
- Thể hiện seasonality và so sánh kỳ được chọn với baseline lịch sử cùng kỳ.
- Phân biệt rõ `missing`, giá trị `0`, dữ liệu partial và dữ liệu ước lượng.
- Trình bày nguồn NASA FIRMS, định nghĩa `snpp_eq`, giới hạn dữ liệu và minh chứng trước/sau harmonization đã kiểm định.

## 6.2. Should — sau luồng cốt lõi

- Gắn nhãn anomaly sau khi chốt baseline, ngưỡng và số năm tối thiểu.
- Click ô lưới để xem chi tiết, kỳ thời gian, giá trị và ngữ cảnh dữ liệu.

## 6.3. Could / Discovery

- Xuất CSV.
- Day View nếu data review xác nhận ý nghĩa và độ tin cậy của chuỗi ngày.
- Khu vực tùy chỉnh hoặc ranh giới hành chính khi có dữ liệu ánh xạ phù hợp.

## 6.4. Out of Scope — MVP

- Cảnh báo cháy thời gian thực hoặc thay thế hệ thống giám sát chính thức.
- Dự báo cháy, fire weather hoặc hướng lan truyền bằng AI.
- Khẳng định số vụ cháy, diện tích cháy hay rủi ro tương lai từ `snpp_eq`.
- Trình bày vùng chẩn đoán như ranh giới tỉnh/huyện.
- Cho phép người dùng retrain mô hình harmonization trong web app.

# 7. Core User Journey

Mở Hỏa Lịch → đọc định nghĩa chỉ số → chọn khu vực → chọn năm và tháng/pentad → xem calendar và bản đồ → xem seasonality → so sánh kỳ được chọn với lịch sử cùng kỳ → xem xu hướng nhiều năm → mở phần “Harmonization” để hiểu dữ liệu và giới hạn.

Nhãn anomaly và Day View chỉ xuất hiện khi readiness gate tương ứng đã được thông qua.

# 8. Data Interpretation Guardrails

- `snpp_eq` là số phát hiện tương đương S-NPP, không phải số vụ cháy.
- Dữ liệu lịch sử không tự động thể hiện cảnh báo hoặc nguy cơ tương lai.
- `missing` không đồng nghĩa `0`; năm chưa đủ kỳ phải có nhãn `partial`.
- So sánh lịch sử phải dùng đúng khu vực và đúng kỳ mùa vụ.
- Baseline phải công bố khoảng năm, phương pháp tổng hợp và số năm hợp lệ.
- Day View, nếu được bổ sung, phải phân biệt giá trị quan sát và giá trị được phân bổ/ước lượng.

# 9. Success Criteria

- Người dùng hoàn thành luồng chọn vùng/thời gian → calendar/map → seasonality/comparison → trends.
- Mọi chỉ số có tên, đơn vị, nguồn, data version và trạng thái coverage nhất quán.
- Demo dùng dữ liệu thật và cho thấy một ví dụ trước/sau harmonization đã kiểm tra.
- So sánh cùng kỳ hiển thị baseline và số năm tham chiếu; không gắn nhãn anomaly khi chưa đủ điều kiện.
- Không có giao diện nào diễn giải `snpp_eq` thành số vụ cháy hoặc cảnh báo thời gian thực.

# 10. Quyết định còn mở

- Công thức baseline seasonality và tập năm tham chiếu mặc định.
- Quy tắc, ngưỡng và ngôn ngữ hiển thị anomaly.
- Readiness của Day View và contract dữ liệu ngày.
- Nhu cầu ranh giới hành chính/khu vực tùy chỉnh sau MVP.

