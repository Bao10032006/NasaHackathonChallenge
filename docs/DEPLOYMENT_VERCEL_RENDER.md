# Deploy Hỏa Lịch lên Vercel và Render

Tài liệu này triển khai kiến trúc:

- frontend React/Vite trên Vercel;
- backend Spring Boot Java 21 trên Render;
- snapshot dataset được đóng gói read-only trong Docker image của backend.

Không cần PostgreSQL, Redis hoặc persistent disk.

## 1. Cấu hình đã có trong repository

- `frontend/vercel.json`: build Vite bằng `npm ci` và `npm run build`;
- `frontend/src/explore/api.ts`: đọc public backend origin từ `VITE_API_BASE_URL`;
- `backend/Dockerfile`: multi-stage build bằng Java 21, chỉ chạy JRE ở runtime;
- `render.yaml`: Render Blueprint cho backend;
- `server.port=${PORT:8080}`: dùng port do Render cấp và giữ 8080 khi chạy local;
- dataset root trong container: `/app/hoalich_data_v1/hoalich_data_v1`.

## 2. Thứ tự triển khai

### Bước 1 — Push cấu hình deploy lên GitHub

Vercel và Render đều build từ repository Git. Các file deploy phải được review, commit và push trước khi tạo service.

### Bước 2 — Tạo backend trên Render

1. Đăng nhập Render.
2. Chọn **New → Blueprint**.
3. Kết nối repository GitHub của Hỏa Lịch.
4. Render đọc `render.yaml` ở repository root.
5. Blueprint cấu hình sẵn `HOALICH_ALLOWED_ORIGINS` cho production origins hiện tại:

   ```text
   https://hoa-lich.vercel.app,https://hoalichvn.me,https://www.hoalichvn.me
   ```

   Nếu đổi project hoặc custom domain, cập nhật giá trị này trong Render Environment hoặc `render.yaml`. Không thêm dấu `/` ở cuối.

6. Xác nhận tạo service `hoalich-backend`.
7. Chờ Docker build và health check `/api/v1/metadata` thành công.
8. Ghi lại Render origin, ví dụ:

   ```text
   https://hoalich-backend.onrender.com
   ```

Kiểm tra trực tiếp:

```text
https://<render-service>.onrender.com/api/v1/metadata
```

Endpoint phải trả JSON có `meta.dataVersion`, `meta.modelVersion` và `dateRange`.

## 3. Tạo frontend trên Vercel

1. Đăng nhập Vercel và chọn **Add New → Project**.
2. Import cùng repository GitHub.
3. Chọn **Root Directory** là `frontend`.
4. Framework Preset chọn **Vite** nếu Vercel chưa tự nhận diện.
5. Trong **Environment Variables**, thêm:

   ```text
   VITE_API_BASE_URL=https://<render-service>.onrender.com
   ```

   Giá trị chỉ gồm origin, không thêm `/api` hoặc `/api/v1`, không thêm `/` cuối.

6. Áp dụng biến cho Production. Có thể áp dụng thêm Preview nếu muốn preview gọi cùng backend.
7. Deploy và ghi lại production origin, ví dụ:

   ```text
   https://hoa-lich.vercel.app
   ```

`VITE_API_BASE_URL` là public build-time configuration, không phải secret.

## 4. Đồng bộ CORS trên Render

Sau khi biết domain Vercel chính xác:

1. Mở Render service → **Environment**.
2. Đặt `HOALICH_ALLOWED_ORIGINS` bằng production origin Vercel chính xác:

   ```text
   https://hoa-lich.vercel.app
   ```

3. Nếu có nhiều origin cố định, phân cách bằng dấu phẩy.
4. Save và deploy lại backend.

Không dùng wildcard `*` cho production. Preview URL của Vercel thay đổi theo deployment; chỉ thêm preview origin cụ thể khi cần kiểm thử preview.

## 5. Smoke test sau deploy

Mở frontend production và kiểm tra:

1. metadata và danh sách vùng tải thành công;
2. bản đồ toàn quốc hiển thị;
3. bbox `west=107,south=12,east=108,north=13` chọn 13 cell;
4. năm 2024 có tổng xấp xỉ `2182.780156`;
5. tháng 03/2024 có tổng `450`;
6. ngày 18/03/2024 có tổng `53`;
7. trends, seasonality và cell-period details trả dữ liệu;
8. trình duyệt không có CORS error hoặc mixed-content error.

Kiểm tra API trực tiếp nếu UI báo lỗi:

```text
https://<render-service>.onrender.com/api/v1/metadata
https://<render-service>.onrender.com/api/v1/map/cells?west=107&south=12&east=108&north=13&year=2024
```

## 6. Chạy local sau thay đổi deploy

Không đặt `VITE_API_BASE_URL` khi muốn dùng Vite proxy local.

Backend:

```powershell
Set-Location backend
$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\mvnw.cmd spring-boot:run
```

Frontend ở terminal khác:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Mở `http://localhost:5173`.

## 7. Lưu ý Render Free

Render Free có thể spin down sau thời gian không có request. Request đầu tiên trước demo có thể phải chờ service khởi động lại. Với buổi demo quan trọng:

- mở backend metadata và frontend trước khi trình bày;
- không đợi đến đúng lúc demo mới gửi request đầu tiên;
- cân nhắc nâng Render backend lên paid instance nếu cần tránh cold start.

Dataset chỉ được đọc từ Docker image. Ephemeral filesystem của Render không làm mất dataset sau restart vì image luôn chứa snapshot gốc.

## 8. Troubleshooting nhanh

### Render báo không tìm thấy port

Kiểm tra log có `Tomcat started on port <PORT>`. Application đã đọc `server.port=${PORT:8080}`.

### Render health check thất bại

Kiểm tra:

- Docker build có copy dataset;
- manifest/checksum validation có thành công;
- service có đủ memory;
- `/api/v1/metadata` có trả HTTP 200.

### Vercel mở được nhưng API lỗi

Kiểm tra:

- `VITE_API_BASE_URL` đúng Render HTTPS origin;
- đã redeploy Vercel sau khi đổi environment variable;
- `HOALICH_ALLOWED_ORIGINS` đúng Vercel production origin;
- không thêm `/api/v1` hai lần.

### Local frontend gọi nhầm production

Xóa `VITE_API_BASE_URL` khỏi local `.env`, khởi động lại Vite và để proxy `/api` gọi `localhost:8080`.
