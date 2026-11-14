# Review spec v0.3 và điều chỉnh TASK 03A

- Người review: HoangAnh250 (P4 — ML / dữ liệu)
- Ngày: 14/11/2026
- Cơ sở: commit `8f4cce3` (API Contract v0.3, OpenAPI v0.3, Technical Design v0.3, Decision Log v0.3, TASK 02B)
- Dữ liệu: snapshot **pipeline 1.0** trong `backend/hoalich_data_v1/hoalich_data_v1/` (quyết định MVP của đội)
- Trạng thái: đề xuất, chờ đồng đội review trước khi chốt v0.3

## 1. Kết luận

Đề nghị **phê duyệt v0.3** với ba sửa đổi chặn (B1–B3) đã thực hiện trong nhánh này. Anomaly, CSV export và cell detail tiếp tục hoãn như đề xuất của TASK 02B.

## 2. Kiểm chứng contract trên snapshot 1.0

Mọi khẳng định dữ liệu của Contract v0.3 §2 được kiểm lại độc lập (Python 3.15, numpy 2.5.4, pandas 3.1.1; đọc NPZ với `allow_pickle=False`):

| Khẳng định | Kết quả |
|---|---|
| SHA-256 `cube_daily_day_veg.npz` = `CE62F017…0B93` | Khớp |
| 9.509 ngày liên tục 2000-11-01 → 2026-11-13, shape `[9509, 587]`, source code 1–4, không NaN, không âm | Khớp |
| Thứ tự cell khớp `cells_025.csv` | Khớp (so bằng `lat`/`lon`; mảng `cell` của NPZ 1.0 là pickle nên không đọc) |
| `src_code=3` bằng đúng S-NPP | Khớp |
| `src_code=4` = NOAA-20 / 1.0106 | Khớp |
| Tổng ngày khớp 183.731 dòng `harmonized_025_month.csv` | Lệch lớn nhất 0,005 |
| Ví dụ `/daily` TayNguyen 2005-03-25 | `171.635599`, 122 cell, AQUA, input 21 — khớp từng chữ số |

Kiểm thêm cho TASK 03A:

| Phép kiểm | Kết quả snapshot 1.0 |
|---|---|
| Tổng ngày → vùng-pentad (`harmonized_regions_pentad.csv`) | Lệch lớn nhất 0,005 |
| Tổng ngày → cell-pentad (`web_cells_pentad.json`, lưu 1 chữ số thập phân) | Lệch lớn nhất 0,05 (đúng mức làm tròn) |
| `null` trong `web_cells_pentad.json` | 0 trong range, 41.090 ngoài range |
| Source code theo thời gian | Không có `1` từ 2002-08; không có `3|4` trước 2012-01-20 |
| Cell-day có giá trị 0 | 3.172.368 / 5.581.783 (giá trị thật, không phải missing) |
| Aqua dự phòng (`src_code=2`) sau khi có S-NPP | 2012: 27 ngày (vá gap S-NPP, đúng thiết kế); 2017: 2 ngày; 2026: 1 ngày (328 cell-day, sau quỹ đạo trôi) |
| Seasonality TayNguyen pentad 15, 2003–2025 | `n=23`, mean `1672.6`, median `1373.0` |

## 3. Ba lỗi chặn và cách sửa trong nhánh này

| # | Vấn đề | Sửa |
|---|---|---|
| B1 | `sourceComposition`: Markdown dùng `sourceInputValidCellCount`, OpenAPI dùng `sourceValidCellCount` (có `additionalProperties: false`) | Thống nhất `sourceInputValidCellCount` trong OpenAPI (schema + example). Decision D10 |
| B2 | Calendar/trends/map month-pentad mất phân biệt ước lượng/quan sát (Vision v0.2 §6.1 Must) | Thêm `origin` theo period, tính từ daily cube (Contract §3.5; OpenAPI `CalendarValue`, `TrendPoint`, `MapCellValue`). Decision D11 |
| B3 | Ví dụ `/seasonality` dùng số không có trong dữ liệu nhưng không ghi là minh họa | Thay bằng số thật TayNguyen pentad 15 và ghi rõ nguồn |

Sửa kèm theo (không chặn):

- Warning mới `AQUA_FALLBACK_AFTER_ORBIT_DRIFT` (Decision D12).
- Làm rõ daily: trong range luôn `AVAILABLE`, `partial=false`, input count/validity theo đúng vệ tinh của source code.
- Lưu ý baseline 2003–2025 trộn giai đoạn Aqua ước lượng và S-NPP đo; pentad 73 có 6 ngày ở năm nhuận.

## 4. Phạm vi TASK 03A sau điều chỉnh

Chi tiết trong Technical Design v0.3 §6A. Tóm tắt:

1. Đọc NPZ không pickle; thứ tự cell theo `lat`/`lon`.
2. Input count và cờ hợp lệ theo đúng vệ tinh của source code; đổi tên file `daily-source-input-valid.bitset`.
3. Manifest là nguồn duy nhất cho version, `dataThrough`, limitations, ma trận partial/transition và `capabilities`.
4. Kiểm schema theo cột bắt buộc; artifact của các bản pipeline sau là tùy chọn → đổi snapshot không sửa code Java.
5. Kiểm định bổ sung (pentad, null, source theo thời gian, zero thật, Aqua dự phòng) và sample regression bằng số thật.
6. Repository: truy vấn daily theo khoảng ngày (cho `origin`), dựng sẵn chuỗi 6 đơn vị × năm × pentad/tháng.
7. Môi trường Python ghim phiên bản cho script xuất; `.gitattributes` để hash không đổi trên Windows.

Không thuộc 03A: anomaly, export, đổi sang dữ liệu pipeline khác.

## 5. Còn để TASK 03B/sau v0.3 (không chặn phê duyệt)

- Lịch năm × tháng 2000 → nay: cho phép `/trends` month/pentad không truyền `period` để trả cả ma trận (additive).
- Thêm `p10`/`p90` vào `SeasonalityPeriod` để UI hiển thị "trên mức thường gặp" khi anomaly còn hoãn.
- Cửa sổ hoạt động cao (50%/80%) cho seasonality.
- Problem Details `type` đang dùng domain `https://hoalich.vn/...`; nếu đội không sở hữu domain thì đổi sang `about:blank` hoặc URN.

## 6. Cần đồng đội xác nhận

1. D10 tên trường và D11 `origin` theo period (ảnh hưởng frontend).
2. Quy tắc `origin` khi tổng period bằng 0 (lấy origin của đa số cell-day).
3. Ngưỡng sai số theo độ làm tròn artifact (0,01 / 0,05) cho test 03A.
4. Phân công owner snapshot (D06) chạy script xuất.
