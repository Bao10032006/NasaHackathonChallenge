---
subtitle: Product Vision & Scope
title: HỎA LỊCH
version: v0.4-proposed
updated: 2026-11-14
language: vi
status: frontend-aligned proposal; backend approval pending
---

**PRODUCT REQUIREMENTS · DOCUMENT 01 · v0.4 PROPOSED**

# 1. Mục đích và quan hệ phiên bản

v0.4 giữ v0.3 làm mốc đã dùng cho TASK 03A và mở rộng luồng demo theo review frontend ngày 14/11/2026. Tài liệu này không sửa ngược Artifact Spec 1.0.0 và không mặc nhiên thay đổi code backend đang triển khai theo v0.3.

Thay đổi chính:

- Đưa chọn ngày và lịch ngày theo tháng vào luồng Must.
- Cho phép khoanh bounding box ở bất kỳ vị trí nào trên toàn bộ phạm vi 587 cell Việt Nam và dùng chung ở map, calendar, daily, trends và seasonality.
- Thêm bản đồ tổng hợp cả năm và thẻ tóm tắt theo filter hiện tại.
- Quy định đối chiếu hai bản đồ bằng hai request có cùng spatial selection.
- Chuyển raw-versus-harmonized comparison thành Optional; phần nguồn và cách đọc dữ liệu vẫn là Must.
- Tiếp tục hoãn seasonal aggregate, anomaly, CSV và raw detection points.

# 2. Product Vision

Hỏa Lịch là nền tảng web trực quan hóa và phân tích lịch sử hoạt động cháy tại Việt Nam bằng chuỗi NASA FIRMS đã hài hòa về thước đo `snpp_eq`. Người dùng có thể khoanh một phạm vi lưới, chuyển giữa năm, tháng và ngày, đọc bản đồ cùng lịch, xem xu hướng lịch sử và đối chiếu cùng kỳ mà vẫn nhận biết rõ giá trị quan sát, quy đổi và ước lượng.

`snpp_eq` là số phát hiện ban ngày tương đương S-NPP, không phải số vụ cháy, diện tích cháy, rủi ro hoặc dự báo.

# 3. Challenge Alignment

## 3.1. Harmonization

Pipeline Python offline nối các giai đoạn Terra, Aqua, S-NPP và NOAA-20 thành chuỗi có khả năng so sánh tốt hơn. Web app chỉ đọc artifact đã phát hành; không retrain hoặc tái harmonize trong request.

Harmonization không biến các phát hiện từ nhiều vệ tinh thành cùng một điểm cháy. Giá trị ngày có thể là quan sát S-NPP trực tiếp, NOAA-20 đã quy đổi hoặc giá trị mô hình phân bổ lại.

## 3.2. Burning Activity Calendar Web Application

Ứng dụng cho phép:

- Chọn vùng có sẵn, một cell hoặc khoanh bounding box trên bản đồ.
- Xem bản đồ theo năm, tháng, pentad hoặc một ngày.
- Xem đường 12 tháng và thẻ tóm tắt cho năm đang chọn.
- Mở lịch 28–31 ngày của một tháng và bấm ngày để lọc bản đồ.
- Xem cùng một tháng qua nhiều năm và mẫu hình lịch sử điển hình.
- Đối chiếu cùng vùng/cùng tháng ở hai năm bằng hai bản đồ.
- Đọc nguồn, provenance, coverage và giới hạn khoa học.

# 4. Target Users

- Primary: cán bộ quản lý rừng/môi trường và người lập kế hoạch theo dõi lịch sử.
- Secondary: nhà nghiên cứu, sinh viên và người quan tâm đến dữ liệu NASA FIRMS.

Đây là giả định sản phẩm ban đầu, chưa thay thế nghiên cứu người dùng chính thức.

# 5. Value Proposition

- Chuỗi lịch sử có định nghĩa nhất quán hơn qua các thế hệ cảm biến.
- Một filter spatial dùng chung từ tổng quan năm đến chi tiết ngày.
- Calendar và bản đồ khớp trên cùng tập cell.
- Baseline lịch sử minh bạch về năm tham chiếu và số mẫu.
- Provenance không đánh đồng quan sát trực tiếp với ước lượng mô hình.

# 6. Product Scope

## 6.1. Must — luồng demo v0.4

- Chọn `ToanQuoc`, 5 vùng chẩn đoán, một cell hoặc bounding box.
- Bounding box chọn cell theo tâm nằm trong hoặc trên biên khung trên toàn bộ lưới quốc gia; khung có thể chứa cell của một hoặc nhiều vùng chẩn đoán.
- Bản đồ theo năm, tháng, pentad và ngày; mỗi item là cell 0,25°, không phải raw hotspot.
- Calendar 12 tháng và lịch 28–31 ngày của tháng đã chọn.
- Thẻ tóm tắt: tổng kỳ, coverage và peak hợp lệ theo quy tắc đã chốt.
- Trends cùng tháng/pentad qua nhiều năm và seasonality 12 tháng/73 pentad.
- Đối chiếu hai bản đồ cùng spatial selection và cùng tháng ở hai năm.
- Cell-period details cho source composition khi người dùng bấm cell.
- Phân biệt `0`, `MISSING`, `OUTSIDE_DATASET_RANGE`, partial và lỗi API.
- Trình bày nguồn, metric, data/model version và giới hạn.

## 6.2. Should

- Rank/percentile lịch sử nếu method và copywriting được chốt.
- Anomaly sau khi có method version, threshold và validation.
- Raw-versus-harmonized comparison như nội dung methodology tùy chọn.

## 6.3. Could / Discovery

- Export CSV.
- Lưu custom area thành ID server-side.
- Tổng hợp theo mùa sau khi định nghĩa tập tháng và mùa vắt năm.

## 6.4. Out of Scope

- Raw detection point kèm giờ/vệ tinh vì snapshot bàn giao không chứa contract truy vấn đó.
- Cảnh báo thời gian thực, dự báo cháy, fire weather, burned area hoặc hướng lan truyền.
- Gọi vùng chẩn đoán là địa giới hành chính.
- Retrain harmonization trong web app.

# 7. Core User Journey

Mở Explore → đọc metric notice → khoanh bất kỳ vùng nào trong phạm vi lưới Việt Nam → xem bản đồ cả năm và đường 12 tháng → mở một tháng → xem lịch ngày → chọn một ngày để đồng bộ `/daily` và map → mở chi tiết nguồn của một cell → đối chiếu cùng tháng ở hai năm → xem trends/seasonality → đọc nguồn và giới hạn. Tây Nguyên chỉ là ví dụ regression trong Document 08.

# 8. Data Interpretation Guardrails

- Cell marker biểu diễn tâm ô lưới 0,25°, không phải vị trí một vụ cháy.
- `0` là dữ liệu hợp lệ. Ngày ngoài dataset có `value=null`, không bao giờ là `0`.
- Trong snapshot v1, ngày nằm trong range có daily harmonized value; `sourceInputValid=false` không đồng nghĩa missing.
- Kỳ partial chỉ tổng hợp phần giao với dataset range và phải công bố coverage.
- Comparison chỉ tính chênh lệch khi hai response cùng version, metric, tập cell và khoảng thời gian có thể so sánh.
- Daily origin và warning phải hiển thị gần giá trị.

# 9. Success Criteria

- Cùng bounding box và `dataVersion` luôn resolve cùng tập `cellId` ở mọi endpoint.
- Tổng ngày trên calendar khớp `/daily` và map date trên cùng tập cell.
- Tổng tháng/năm và peak dùng đúng coverage/status; tie lấy mốc sớm nhất.
- Hai map comparison ghép ổn định bằng `cellId`; không tính delta cho cell/kỳ không tương thích.
- Demo có ví dụ full, partial và outside-range bằng dữ liệu thật.
- Không có UI nào diễn giải `snpp_eq` thành số vụ cháy hoặc dùng `0` thay missing.

# 10. Quyết định hoãn

- Định nghĩa mùa và seasonal aggregate.
- Percentile/rank ngoài median baseline.
- Anomaly classification.
- Persisted custom area, export và raw detection layer.
