# Hỏa Lịch: bộ dữ liệu sạch và mã hiệu chuẩn (bản 1, 14/11/2026)

Bộ này biến 4 tệp FIRMS của đội (MODIS C6.1, VIIRS S-NPP, NOAA-20, NOAA-21; toàn quốc Việt Nam, 11/2000 đến 13/11/2026) thành bảng lưới sạch, mô hình hiệu chuẩn Aqua → S-NPP đã kiểm định, và chuỗi hài hòa 2000–2026 theo ô × tháng và ô × pentad. Mọi tệp trong gói đều do `hoalich_pipeline.py` sinh ra từ 4 tệp zip gốc.

## Chạy lại

```
python hoalich_pipeline.py --raw <thư mục chứa 4 tệp zip FIRMS> --out <thư mục kết quả>
python verify_outputs.py <thư mục kết quả>
```

Cần Python 3.9 trở lên, `numpy`, `pandas`, khoảng 4 GB RAM trống; chạy mất chừng nửa phút. Thêm `--save-points` để ghi cả bảng điểm đã chuẩn hóa (`points_clean.csv.gz`, 2,15 triệu dòng).

## Định nghĩa

- **Đơn vị chuẩn:** số phát hiện ban ngày, đã lọc nguồn tĩnh, tương đương một VIIRS quỹ đạo 13:30 (S-NPP). Cột `snpp_eq`.
- **Ngày:** theo `acq_date` của FIRMS (UTC). Với phát hiện ban ngày ở Việt Nam, ngày UTC trùng ngày địa phương.
- **Lưới:** 0,25°. Mã ô `cy_cx` với `cy = floor(vĩ độ / 0,25)`, `cx = floor(kinh độ / 0,25)`; 587 ô có dữ liệu.
- **Pentad:** 1 đến 73 theo ngày trong năm, mỗi pentad 5 ngày; pentad 73 gồm cả ngày 366 của năm nhuận.
- **Nguồn tĩnh:** ô 0,01° từng có phát hiện `type` 2 hoặc 3 trong phần archive (3.344 ô). Mọi điểm rơi vào các ô này đều bị loại, kể cả phần NRT vốn không có `type`. Tỉ lệ bị loại ban ngày: Terra 9,5%, Aqua 2,7%, S-NPP 1,9%.
- **Độ tin cậy:** giữ mọi mức. Mức thấp chiếm 4–5% ở MODIS và khoảng 9% ở VIIRS; bỏ đi không làm kiểm định tốt hơn (sai số năm bỏ-một-năm 3,3% so với 3,2%). Cột `n_low` cho phép tự thử.
- **Vùng chẩn đoán:** năm khung chữ nhật (`DBSCL`, `TayNguyen`, `TayBac`, `DBSH`, `Khac`), không phải ranh giới hành chính. Khung `DBSCL` (8,5–11,0°B, 104,4–106,9°Đ) gồm cả một phần TP.HCM.

## Các tệp

| Tệp | Nội dung | Dùng cho |
|---|---|---|
| `tables/grid_025_month.csv` | ô × năm × tháng × vệ tinh × ngày/đêm: `n` (đã lọc nguồn tĩnh), `n_low`, `n_static`, `frp_sum`; chỉ các dòng khác 0 | vai 2, 3 |
| `tables/grid_025_pentad.csv` | như trên theo pentad | vai 2, 3 |
| `tables/model_025_month.csv` | bảng dày (có cả số 0): số đếm ban ngày của 5 vệ tinh theo ô × tháng, kèm `expo_aqua`, `expo_snpp` | vai 4 |
| `tables/cube_daily_day_veg.npz` | ma trận ngày × ô cho 5 vệ tinh, cờ hợp lệ theo ô-ngày, chuỗi hài hòa theo ngày và mã nguồn | vai 4 |
| `tables/cells_025.csv` | danh sách ô, tọa độ tâm và mép, vùng chẩn đoán | mọi vai |
| `tables/static_mask_001.csv` | mặt nạ nguồn tĩnh 0,01° | vai 2, 3 |
| `tables/data_gaps.csv`, `exposure_month.csv`, `gap_filled_months.csv` | đợt mất dữ liệu, tỉ lệ ngày hợp lệ, các tháng có vá | vai 2, 3 |
| `tables/calib_coeffs_025.csv` | hệ số theo ô: tỉ số dự phòng, tỉ số theo mùa, mức sàn theo tháng | vai 4 |
| `tables/harmonized_025_month.csv` | chuỗi hài hòa ô × tháng: `snpp_eq`, `lo90`, `hi90`, `src` | vai 4, 5 |
| `tables/harmonized_cells_pentad.npz` | khối (năm, 73 pentad, ô) của `snpp_eq`, kèm `src_code` | vai 4, 6 |
| `tables/harmonized_regions_pentad.csv` | lịch đốt pentad cho 5 vùng và toàn quốc, có khoảng 90% | vai 3, 5 |
| `tables/harmonized_national_year.csv` | tổng năm: hài hòa, hai kịch bản đối chứng, số thô, ghép thô | deck |
| `tables/uncertainty_table.csv` | phân vị 5–50–95% của (thực đo + 0,5)/(dự đoán + 0,5) theo mức đếm, cho ô, khối 3×3 ô và vùng | vai 4, 5 |
| `tables/validation_*.csv` | kiểm định: hai chiều, cuốn chiếu, bỏ-một-năm, pentad, độ phủ | vai 4, deck |
| `evidence/*.csv` | giờ bay qua theo năm, số đếm theo năm, tỉ số theo vùng × tháng, chỉ báo chế độ cháy, độ khớp ba VIIRS | vai 3 |
| `web_cells_pentad.json` | đề xuất schema cho web: ô, năm, khối pentad, mã nguồn, bảng bất định | vai 5, 6 |
| `summary.json` | mọi con số tổng hợp, kết quả kiểm định, cổng 2 | deck, vai 6 |

Mã nguồn trong `src` và `src_code`: 1 `terra_noi_chuoi` (11/2000–7/2002), 2 `aqua_hieu_chuan` (8/2002–19/1/2012 và các ngày vá), 3 `snpp` (thực đo), 4 `noaa20_quy_doi` (NOAA-20 chia 1,0106, dùng khi S-NPP mất dữ liệu và từ 2/11/2026).

Đọc nhanh bằng Python:

```python
import numpy as np, pandas as pd
z = np.load("tables/harmonized_cells_pentad.npz")
cube, years, cell = z["snpp_eq"], z["years"], z["cell"]        # cube[năm, pentad-1, ô]
cells = pd.read_csv("tables/cells_025.csv")
aoi = ((cells.lat > 9) & (cells.lat < 10.5) & (cells.lon > 105) & (cells.lon < 106.5)).values
lich = np.nansum(cube[:, :, aoi], axis=2)                       # (năm, 73): lịch đốt của vùng chọn
```

Hàm `calendar_stats` và `shortest_window` trong `hoalich_pipeline.py` tính khí hậu pentad, cờ bất thường (vượt phân vị 90 của các năm khác) và cửa sổ đốt nguy cấp (chuỗi pentad liên tiếp ngắn nhất chứa 50% hoặc 80% tổng năm).

## Mô hình

Hiệu chuẩn ở mức ô × tháng trên giai đoạn 2/2012–12/2021 (quỹ đạo Aqua ổn định), chỉ dùng các ô-tháng mà cả Aqua lẫn S-NPP đều đủ dữ liệu (65.557 ô-tháng).

- **Tỉ số theo ô** (phương án lùi, `--model cell`): `S-NPP = r[ô] × Aqua`. Tỉ số co về tỉ số vùng lân cận 5×5 ô rồi về tỉ số toàn cục.
- **Hurdle** (`--model hurdle`): ô-tháng có Aqua > 0 dùng `r[ô, mùa] × Aqua`; ô-tháng Aqua = 0 dùng mức sàn `g[ô, tháng]` (trung bình S-NPP khi Aqua không thấy gì). Hai mùa: tháng 1–5 và 6–12.
- **Lai** (mặc định, `--model blend`): trung bình của hai mô hình trên. Tỉ số theo ô ngầm cho rằng phần cháy Aqua không thấy tăng giảm đúng theo mức cháy; hurdle cho rằng phần đó cố định theo khí hậu. Thực tế nằm giữa, và trung bình cho sai lệch nhỏ nhất theo cả hai chiều kiểm định.
- **Xuống pentad:** tổng tháng được chia cho từng ngày theo trọng số `Aqua của ngày + κ × hồ sơ khí hậu S-NPP của ô` (κ = 3), rồi cộng thành pentad. Không hiệu chuẩn thẳng ở pentad vì quá thưa.
- **Trước Aqua (11/2000–7/2002):** Terra được đổi sang tương đương Aqua bằng cùng kiểu mô hình học trên 2003–2007, rồi mới áp mô hình chính. Đoạn này bất định rộng.
- **Bất định:** khoảng 90% lấy từ phân vị sai số kiểm định theo mức đếm (`uncertainty_table.csv`); áp cho tổng của vùng chọn bằng bảng cấp `vung` hoặc `khoi3x3`.

## Kiểm định (ô × tháng, hai chiều: học 2017–2021 đoán 2012–2016, và ngược lại)

| Mô hình | Lệch toàn quốc | KGE | Lệch ĐBSCL | Lệch Tây Nguyên | Vùng xấu nhất |
|---|---|---|---|---|---|
| Tỉ số toàn cục | +2,8% / −2,8% | 0,970 / 0,929 | −24,6% / −21,3% | −11,3% / −22,8% | 49% / 41% |
| Tỉ số theo tháng | +3,1% / −2,6% | 0,938 / 0,964 | −23,7% / −20,1% | −10,0% / −22,2% | 44% / 36% |
| Tỉ số theo ô | +3,1% / −2,6% | 0,963 / 0,936 | −6,8% / +4,6% | +8,9% / −8,4% | 8,9% / 8,4% |
| Hurdle | −0,3% / +2,5% | 0,990 / 0,957 | −7,8% / +10,4% | +6,3% / −3,1% | 12,1% / 10,4% |
| **Lai (mặc định)** | **+1,4% / −0,0%** | **0,983 / 0,952** | **−7,3% / +7,5%** | **+7,6% / −5,7%** | **7,6% / 7,5%** |

- **Bước nhảy 2012:** S-NPP 2013–2015 so với Aqua 2009–2011 là 6,01 lần; sau hài hòa còn 1,04 lần; riêng Aqua cùng hai giai đoạn là 1,06 lần.
- **Bỏ từng năm ra kiểm:** sai lệch tổng năm toàn quốc từ −5,1% đến +6,0%, căn trung bình bình phương 3,2%. Theo vùng, sai lệch một năm có thể tới ±15% (ĐBSCL) và hơn nữa ở ĐB sông Hồng, nơi số đếm nhỏ.
- **Cuốn chiếu:** đoán 2013–2014 từ các năm sau cho lệch +5,5% đến +6,1%. Vì vậy giai đoạn trước 2012 có khả năng bị ước lượng cao khoảng 5%.
- **Pentad (κ = 3):** KGE chuỗi pentad toàn quốc 0,97 / 0,92; ĐBSCL 0,89 / 0,91; Tây Nguyên 0,89 / 0,86. Cửa sổ chứa 50% tổng năm trùng 80% (chỉ số Jaccard); đỉnh mùa lệch trung vị 0 pentad.
- **Độ phủ của khoảng 90% (kiểm chéo hai chiều):** ô-tháng 89,7% / 89,8%; khối-tháng 89,5% / 88,7%; vùng-tháng 83,6% / 89,2%; vùng-pentad 87,7% / 91,0%; ô-pentad 89,6% / 90,1% nhưng chỉ 75–79% ở ô đang cháy.
- **Terra → Aqua:** lệch toàn quốc +4,9% / +1,9%, vùng xấu nhất 14–16%.
- **Ba VIIRS:** NOAA-20/S-NPP = 1,0106; NOAA-21/S-NPP = 0,9633 (ban ngày, đã lọc nguồn tĩnh, trên các ô-ngày cả hai cùng hợp lệ).

Cấu hình mặc định được chọn sau khi xem chính các phép kiểm hai chiều này, nên con số của nó có thể hơi lạc quan. Kết quả bỏ-một-năm và cuốn chiếu là ước lượng thận trọng hơn.

## Mất dữ liệu đã phát hiện

- **Toàn quốc (18 đợt):** Terra 27/5/2001 (6 ngày), 14/6/2001 (21), 18/10/2001 (13), 20/3/2002 (9), 16/12/2003 (9), 19/2/2016 (9), 10/10/2022 (14); Aqua 18/8/2020 (16), 1/4/2022 (16); S-NPP 27/7/2022 (15), 30/5/2024 (5), 10/7/2024 (6), 24/7/2024 (6), 3/11/2024 (3), 10/3/2026 (3), 28/4/2026 (3), 11/7/2026 (6); NOAA-20 19/7/2023 (4).
- **Cục bộ (105 ngày-dải):** VIIRS thiếu một lượt bay trên một dải vĩ độ trong khi vệ tinh khác vẫn thấy cháy. Riêng S-NPP năm 2012 có 17 ngày-dải, tập trung tháng 2–3 (ví dụ 11/2/2012 ở Tây Nguyên: Aqua 105 điểm, S-NPP 0).
- Cách dò: xác suất thực nghiệm của việc "không thấy gì" theo số phát hiện của vệ tinh tham chiếu cùng ngày. Cách này không coi đợt mưa lũ 13–22/10/2020, khi cả ba vệ tinh đều gần như không thấy cháy, là mất dữ liệu.
- Các ô-ngày S-NPP thiếu được vá bằng NOAA-20 quy đổi (từ 2018) hoặc ước lượng từ Aqua (2012–2017); xem `gap_filled_months.csv`.

## Số đối chiếu (Cổng 1)

`verify_outputs.py` kiểm tự động. Các con số phải ra đúng với bản tải FIRMS ngày 13/11/2026:

- Tổng 2.150.162 điểm: Terra 140.824; Aqua 302.513; S-NPP 1.018.991; NOAA-20 491.632; NOAA-21 196.202. Sau lọc nguồn tĩnh còn 2.043.505.
- Ghép thô mọi vệ tinh, 2012–2014 so với 2009–2011: 5,53 lần.
- Tỉ số S-NPP/Aqua trên các ô-tháng hiệu chuẩn: toàn quốc 5,75; ĐBSCL 7,51; Tây Nguyên 6,89; Tây Bắc 4,49; ĐB sông Hồng 3,97.
- ĐBSCL: tháng 3 chiếm 40,4% và tháng 4 chiếm 24,8% số phát hiện S-NPP cả năm; cửa sổ chứa 50% tổng năm là pentad 11–18 (20/2–31/3), đỉnh ở pentad 15 (12–16/3).

Một số con số khác với bản phân tích nhanh sáng 14/11 vì định nghĩa đã chặt hơn (chỉ ban ngày, đã lọc nguồn tĩnh, đã loại ô-ngày mất dữ liệu): mặt nạ nguồn tĩnh 3.344 ô thay cho 2.792 (bản sáng chỉ đếm `type` 2); tỉ số ĐBSCL 7,51 thay cho 7,0; NOAA-20/S-NPP 1,011 thay cho 1,018; tháng 3–4 ở ĐBSCL chiếm 65% thay cho 63%.

## Giới hạn

- Lịch chỉ phản ánh khung giờ bay qua 13:30; cháy ngoài khung giờ này không được đếm.
- Tỉ số S-NPP/Aqua thay đổi theo chế độ cháy. Ở Tây Nguyên, tỉ lệ điểm Aqua có FRP trên 30 MW giảm từ khoảng 0,38 (2003–2012) xuống 0,24–0,28 (2017–2021) và tỉ số tăng từ 6,2–6,6 lên 6,9–7,7; xem `evidence/regime_indicators_region_year.csv`.
- Không dùng Aqua và Terra sau 2022 để nối chuỗi vì giờ bay qua đã trôi.
- Mất dữ liệu một phần trong ngày (không mất trọn lượt bay) không dò được.
- Đoạn Terra 11/2000–7/2002 chỉ nên hiển thị kèm cảnh báo.
- Tháng 11/2026 và pentad 64 của năm 2026 (12–16/11) chưa đủ ngày; web nên ẩn hoặc đánh dấu.
- Mới chạy trên Python 3.13, pandas 3.0 và numpy 2.5; chưa thử các bản cũ hơn.
- Chưa có lớp phủ đất; vùng chẩn đoán là khung chữ nhật.
