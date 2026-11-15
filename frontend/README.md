# Frontend Hỏa Lịch

Dùng Node.js 20.19 trở lên trong dòng 20, hoặc Node.js 22.12 trở lên, và npm. Khởi động Spring Boot bằng JDK 21 từ bản backend của nhóm trên `main`. Chạy lệnh sau trong thư mục `backend` của bản đó.

```powershell
.\mvnw.cmd spring-boot:run
```

Khi backend đã chạy tại `http://localhost:8080`, mở một terminal ở repo frontend và chạy:

```sh
cd frontend
npm ci
npm run dev
```

Mở địa chỉ Vite in ra, mặc định là `http://localhost:5173`. Màn Khám phá mở với bản đồ toàn quốc và bộ lọc năm/tháng. Chọn vùng có sẵn, bấm một ô hoặc khoanh vùng để xem tóm tắt và biểu đồ 12 tháng. Chọn tháng trong vùng để mở lịch ngày.

`npm run dev` chuyển tiếp `/api/v1` sang Spring Boot trên cổng 8080. Khi triển khai, phục vụ frontend và `/api/v1` dưới cùng origin hoặc cấu hình proxy tương ứng.

Luồng kiểm tra từ Document 08 dùng năm 2024 và khung Tây Nguyên `107,12 → 108,13`. Khung có 13 ô, tháng 2 nổi bật và ngày 18/03 có giá trị 53.

Trên backend TASK 03B2, phân tích lịch sử hiển thị mức tham chiếu từ `/calendar`. Xu hướng nhiều năm và mùa vụ cần `/trends` và `/seasonality`. Panel chi tiết lấy giá trị và loại nguồn gốc của ô từ `/map/cells`, kèm cơ cấu nguồn theo ngày từ `/daily` trong lúc chờ endpoint chi tiết ô theo kỳ.

Nền bản đồ dùng [Natural Earth Admin 0 Countries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/) v5.1.2. Các ô và giá trị đến từ API đang được chọn.

## Lịch đốt, nền địa hình và dấu mốc cảm biến

- **Lịch đốt 73 kỳ 5 ngày** (`src/explore/FireCalendar.tsx`): gọi `/calendar?granularity=pentad&includeBaseline=true` cho vùng đang chọn, kể cả toàn quốc. Cột là năm đang xem, vạch ngang là mức điển hình (trung vị của baseline). Bấm một kỳ để bản đồ chuyển sang kỳ đó. Thành phần này chỉ mô tả giá trị và chênh lệch cùng kỳ, không phân loại bất thường.
- **Lớp nền bản đồ**: ba lựa chọn. `Ảnh vệ tinh` (Esri World Imagery kèm tên địa danh, như trước; cũng là ảnh nền mặc định trên NASA FIRMS). `Địa hình` dùng Esri World Topographic Map bản raster; NASA FIRMS cũng ghi nguồn lớp Topographic của họ là Esri. `Nền tối` không tải ảnh nào. Cả hai lớp ảnh đều của Esri, không phải dữ liệu NASA. Nếu ảnh không tải được, bản đồ giữ nền tối và hiện ghi chú. Các ô ảnh chồng nhau 0,75 điểm ảnh để không lộ đường nối.
- **Phóng to, thu nhỏ**: cuộn chuột (giữ nguyên điểm dưới con trỏ), chụm hai ngón trên màn hình cảm ứng, chụm trên bàn rê (Ctrl + cuộn), và hai nút `+` `−` như trước. Ở mức phóng nhỏ nhất hoặc lớn nhất, cú cuộn trả về cho trang; cú cuộn bắt đầu ngoài bản đồ tiếp tục cuộn trang trong 0,4 giây để bản đồ không giữ chân người đọc.
- **Khoanh vùng trên bản đồ**: nút `Khoanh vùng` nay có ngay trên thanh công cụ của bản đồ (cùng chức năng với nút ở thanh lọc): kéo một khung chữ nhật, các ô có tâm nằm trong khung thành vùng phân tích.
- **Dấu mốc cảm biến** trong biểu đồ "cùng tháng qua các năm": điểm có `origin = MODEL_REDISTRIBUTED` vẽ rỗng, và một vạch đứng đánh dấu năm đầu tiên có quan sát VIIRS.

Chạy kiểm tra và build trong thư mục `frontend`.

```sh
npm run typecheck
npm run build
```

Bản build nằm trong `frontend/dist/`.
