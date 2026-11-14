# Frontend Hỏa Lịch

Dùng Node.js 20.19 trở lên trong dòng 20, hoặc Node.js 22.12 trở lên, và npm. Chạy từ thư mục gốc của repo.

```sh
cd frontend
npm ci
npm run dev
```

Mở địa chỉ Vite in ra, mặc định là `http://localhost:5173`. Root React hiện hiển thị trang trống. Trong chế độ dev, Vite chuyển tiếp `/api` đến `http://localhost:8080`.

Chạy kiểm tra và build trong thư mục `frontend`.

```sh
npm run typecheck
npm run build
```

Bản build nằm trong `frontend/dist/`.
