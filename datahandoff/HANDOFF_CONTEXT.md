# Ngữ cảnh bàn giao — chuẩn hóa dữ liệu Hỏa Lịch

Ngày đóng gói: 14/11/2026.

## Yêu cầu và quyết định đã thống nhất

Đội sáu người thực hiện ứng dụng lịch hoạt động cháy trong khoảng 30 giờ. Phần dữ liệu cần nối MODIS và VIIRS thành chuỗi thống nhất. Người dùng muốn số đếm được quy đổi về S-NPP, đồng thời giữ nguyên các phép đo gốc để phân tích; không lấy trung bình FRP, độ sáng, thời gian hoặc confidence trong file bàn giao chính.

Bốn bộ FIRMS gồm MODIS (Terra/Aqua), S-NPP, NOAA-20 và NOAA-21. Thước đo sản phẩm hiện tại là số phát hiện ban ngày đã lọc nguồn tĩnh tương đương S-NPP, không phải occupancy ô 1 km–ngày từng đề xuất ban đầu.

Mô hình v1 là blend 50/50 của tỷ số theo ô và hurdle theo ô–mùa có sàn ở Aqua=0. Hiệu chuẩn Aqua→S-NPP trên 02/2012–12/2021, lưới 0,25° × tháng; phân bổ xuống ngày rồi pentad. Terra nối qua Aqua. NOAA-20 chia 1,0106. NOAA-21 hỗ trợ đối chiếu/dò gap, chưa là nhánh nguồn trong chuỗi cuối.

## Trạng thái đã hoàn thành

- Có raw JSON cho bốn bộ, tổng 2.150.162 bản ghi trước lọc.
- Có pipeline và artifacts v1 do người dùng cung cấp. Script verify_outputs.py trong ZIP v1 đã chạy: tất cả PASS về các phép kiểm nhất quán được định nghĩa trong script.
- Đã chạy chọn k_cell bằng nested validation theo năm. Kết quả đề xuất 100, MAE giảm khoảng 0,067% so với 60, độ nhạy thấp trong vùng 40–200.
- **Chưa áp dụng k_cell=100 vào pipeline sản phẩm.** Default hiện vẫn 60; ZIP v1 và các JSON sản phẩm dựa trên kết quả 60.
- Pipeline được sửa phép chia ở fit_cell_ratio và fit_hurdle để hỗ trợ k_cell=0 khi denominator=0. Script tuning kiểm tra hệ số mặc định không đổi so với mã gốc trong ZIP v1.
- Đã xuất JSON chính: artifacts/harmonized_with_detections.json, 183.731 ô–tháng, chứa 1.839.788 bản ghi ban ngày sau lọc. Mọi trường bên trong detections giữ nguyên raw. Tổng snpp_eq=1.774.716,01.
- JSON đã được đọc kiểm tra theo từng bản ghi; số ô–tháng, số detections và tổng snpp_eq khớp kết quả xuất.

## Đọc JSON đúng cách

snpp_eq là số đếm hài hòa của ô–tháng. detections chứa quan sát gốc của tất cả vệ tinh trong ô–tháng sau lọc, nên không cộng chúng để thay snpp_eq. Danh sách trống nhưng snpp_eq dương có thể do dự báo sàn/nối chuỗi; không được tạo FRP hoặc tọa độ giả cho phần dự báo này.

source trong bảng tháng v1 là nhãn nguồn chiếm đa số toàn miền trong kỳ; truy vết đúng từng ô–ngày cần cube_daily_day_veg.npz trong ZIP v1.

## Điểm còn mở cần xử lý trước phát hành khoa học mới

1. Muốn áp dụng k_cell=100: truyền nhất quán qua tất cả fit/validation/final model, cập nhật metadata, sinh lại chuỗi và bất định. Không chỉ đổi số trong JSON hoặc summary.
2. NOAA-21 chưa tham gia vá chuỗi cuối. Nếu thêm, cần kiểm định nguồn và lưu provenance.
3. Fallback Aqua trong mã có thể chạy sau 2022 dù định hướng tránh giai đoạn quỹ đạo trôi; cần giới hạn/cảnh báo.
4. Cờ valid/exposure là suy luận thống kê từ phát hiện, không phải cloud/coverage mask đầy đủ.
5. Khoảng v1 là phân vị sai số thực nghiệm, chưa phải bảo đảm conformal/MAPIE. Cận bằng nhau ở nguồn quan sát/quy đổi không có nghĩa không có sai số.
6. Tuning giữ cố định static mask và outage flags v1 dùng cả lịch sử; không gọi nested CV đó là kiểm định độc lập toàn bộ tiền xử lý.
7. Năm 2000, 2012 đầu kỳ, 2026 cuối kỳ cần nhãn partial; FRP và độ sáng chưa được hiệu chuẩn xuyên cảm biến.
8. Export chính đọc các JSON trong Data/ và áp mặt nạ v1. Nó không tự dedupe khi thêm file raw trùng; cần nâng cấp nếu thay bộ raw hoặc tải nhiều bản chồng lấn.

## Tài liệu ưu tiên

Đọc HUONG_DAN_CHUAN_HOA_MODIS_VIIRS.md → hoalich_README.md → K_VALIDATION_REPORT.md → mã pipeline/export. TASK4_ML_RESEARCH.md và tài liệu nghiên cứu dài là bối cảnh lịch sử; khi mâu thuẫn, kiểm mã và artifacts hiện tại. Hai báo cáo nhanh dữ liệu thật là bản sớm, có con số khác README v1 do định nghĩa lọc thay đổi.

Script export_harmonized_json.py là phiên bản xuất thống kê trung bình trước yêu cầu cuối. Chỉ dùng để tham khảo lịch sử. **Script chính theo yêu cầu hiện tại là export_harmonized_with_detections.py.**
