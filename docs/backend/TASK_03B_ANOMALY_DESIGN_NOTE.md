# Ghi chú thiết kế: bất thường và so sánh lịch sử (đề xuất cho TASK 03B)

- Người soạn: HoangAnh250 (Data/ML)
- Ngày: 14/11/2026
- Trạng thái: **đề xuất** — anomaly vẫn đang hoãn theo Decision Log D03; tài liệu này là đầu vào để đội chốt `anomalyMethodVersion`
- Dữ liệu: snapshot pipeline 1.0, đọc qua artifact TASK 03A (`derived/`, spec `1.0.0`)
- Mọi số ví dụ được tính thật trên artifact, đọc giống Java (manifest + map little-endian), vùng TayNguyen (122 cell)

## 1. Luồng dữ liệu

```
Pipeline Python (offline) → snapshot 1.0 → exporter → derived/ (4 nhị phân + manifest)
Spring Boot startup: validate (03A) → nạp mảng → dựng prefix sum theo area
Request → service (03B): tính công thức bên dưới → DTO/controller (03C)
```

- Không database. Prefix sum `P[d] = Σ_{0..d} area(d)` cho 6 đơn vị (ToanQuoc + 5 vùng) dựng lúc khởi động → tổng mọi khoảng `[a, b]` = `P[b] − P[a−1]` (O(1)).
- Cell hoặc bbox tùy ý: cộng các cell khi có request (≤ 587 cell × 9.509 ngày, vài mili-giây) hoặc cache.

## 2. Khung công thức chung

1. **Giá trị kỳ:** `X = Σ_cell Σ_day snpp_eq[day][cell]` (cộng bằng `double`).
2. **Tập tham chiếu:** `R = { X(cùng kỳ, năm y) | y ∈ [baselineStart, baselineEnd], y ≠ năm mục tiêu, kỳ phủ đủ ngày }`. Mặc định 2003–2025. "Cùng kỳ" = cùng tháng, cùng pentad, cùng cửa sổ quanh ngày-trong-năm, hoặc cùng khoảng ngày (year-to-date).
3. **Thống kê nền:** `n`, `median`, `p10`, `p90`, `MAD = median(|R − median|)`.
4. **Chỉ số:**

| Chỉ số | Công thức |
|---|---|
| `delta` | `X − median` |
| `deltaPct` | `(X / median − 1) × 100`; `null` nếu `median = 0` |
| `percentile` | `100 × (#{r < X} + 0,5 × #{r = X}) / n` |
| `robustZ` | `(X − median) / (1,4826 × MAD)`; `null` nếu `MAD = 0` |
| `rank` | thứ hạng của `X` trong `R ∪ {X}` (1 = cao nhất) |

5. **Phân loại:**

| Điều kiện | `classification` |
|---|---|
| `n < 5` | `INSUFFICIENT_BASELINE` |
| kỳ có cell-day source code 1 (11/2000–7/2002) | `NOT_ASSESSED` |
| `X > max(p90, 1)` | `HIGH` — "cao hơn ngưỡng lịch sử cùng kỳ" |
| `X < p10` | `LOW` |
| còn lại | `TYPICAL` |

Tùy chọn cho kỳ ước lượng từ Aqua (source code 2): mức `POSSIBLY_HIGH` khi `X > p90` nhưng cận dưới 90% (từ `uncertainty_table.csv`) không vượt — cùng logic cờ hai mức đã kiểm định ở pipeline 1.3.

## 3. Theo cấp thời gian (ví dụ TayNguyen, số thật)

| Cấp | Cách tính | Ví dụ |
|---|---|---|
| Tháng | cùng tháng các năm (n = 22) | 03/2024: 3.880 vs median 8.951 (−56,7%; percentile 9,1) → `LOW` |
| Pentad | cùng pentad | P15/2024 (11–15/03): 552 vs 1.427 (−61%; thấp nhất 23 năm) → `LOW` |
| Ngày | **không gắn nhãn ngày lẻ**: dùng tổng 7 ngày quanh ngày đó so với cùng cửa sổ các năm | 15/03/2024: ngày lẻ 161 (p10–p90 của cửa sổ ±7 ngày: 54–710, quá rộng); 7 ngày = 1.129 vs 2.419 (−53%; percentile 18) → `TYPICAL` |
| Year-to-date | 01/01 → `dataThrough` cùng khoảng các năm | 2026 đến 13/11: 15.199; −43% so với median nhưng **+31,9% so với cùng kỳ 2025** |
| Năm | tổng năm đủ 12 tháng; % so với median; hạng; % so với năm trước | 2015: +33% (hạng 4/23); 2025: −58,7% (hạng 23/23) |
| Tọa độ/bbox | lat/lon → cell 0,25° hoặc tập cell; cùng công thức; vùng quá ít hoạt động cần ngưỡng tối thiểu (pipeline 1.3 dùng 200 phát hiện/năm) | — |

## 4. Quyết định cần đội chốt

1. **Khoảng baseline:** TayNguyen giảm mạnh gần đây (2023–2025 hạng 19–23/23) nên baseline 2003–2025 làm các năm gần đây gần như luôn `LOW`. Đề xuất tham số `baselineStartYear/EndYear` và hiển thị song song "toàn giai đoạn" và "10 năm gần nhất".
2. **Baseline trộn thời kỳ cảm biến:** 2003–2011 là ước lượng Aqua, từ 2012 là S-NPP; TayNguyen trước 2012 có thể cao 6–10% → kéo baseline lên.
3. **Không gắn nhãn ngày lẻ:** chỉ 7 ngày/pentad/tháng trở lên; dữ liệu ngày không có khoảng bất định.
4. **Gắn cờ do ngẫu nhiên:** với ngưỡng p90, khoảng 10% kỳ bình thường vẫn `HIGH` → nhãn trung tính, không "cảnh báo".
5. **Gate D03:** chốt `anomalyMethodVersion` (đề xuất `p90_loo_2003_2025`), số mẫu tối thiểu (5), câu chữ UI.

## 5. API đề xuất (bổ sung Contract v0.3)

```
GET /api/v1/anomaly?areaType=&areaId=
    &granularity=day7|pentad|month|ytd|year
    &date=YYYY-MM-DD | year=&period=
    &baselineStartYear=2003&baselineEndYear=2025
```

Response: `value`, `baseline {method, n, median, p10, p90, startYear, endYear, excludesTargetYear}`, `delta`, `deltaPct`, `percentile`, `robustZ`, `rank`, `classification`, `origin` (Contract §3.5), `warnings` lấy từ `warningCatalog` của manifest.

## 6. Cần từ repository (TASK 03A)

- Area index: cell → vùng chẩn đoán, danh sách cell của ToanQuoc và 5 vùng.
- Chuỗi tổng ngày + prefix sum theo area và đếm source code theo ngày (để tính `origin`).
- Truy vấn khoảng ngày không tạo object theo từng cell.
