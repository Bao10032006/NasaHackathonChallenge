# Quy tắc phân tích bất thường và so sánh — Hỏa Lịch

| Mục | Giá trị |
|---|---|
| Phiên bản | `analytics_rules_v0.2-draft` (thay v0.1 cùng ngày) |
| Ngày lập | 15/11/2026 |
| Trạng thái | Đề xuất nghiên cứu. Anomaly vẫn hoãn theo Decision Log D03. Không sửa dữ liệu gốc, không thay pipeline đang chạy. |
| Đi kèm | `DATA_CONTRACT_ANALYTICS.md` (**DC**), `PRODUCT_PLAN_THEO_DOI_CHAY.md` (**PP**), `ANALYTICS_RULES_CONFIG.json` (**CFG**) |
| Tái lập số liệu | `scripts/*.py`; kết quả gốc trong `ket_qua/`. Mọi con số trong tài liệu đều do các script này tính, trừ khi ghi “giả định” |

> Hỏa Lịch mô tả hoạt động đốt đã được vệ tinh phát hiện.
> - Không phải cảnh báo cháy đã xác nhận.
> - Không phải dự báo.
> - Không phải số đám cháy, cũng không phải diện tích cháy.
>
> Mọi nhãn trong tài liệu là nhãn thống kê so với lịch sử của chính dữ liệu. Ngưỡng là quy tắc dự án, không phải ngưỡng xác nhận cháy.

---

## Phần I. Hiện trạng

### 1.1. Phiên bản pipeline đang dùng

Không lấy phiên bản mới nhất trong thư mục làm phiên bản đang chạy.

| Bản | Vị trí | Vai trò | Ghi chú |
|---|---|---|---|
| **1.0** | `BE-NASAWEBAPP/backend/hoalich_data_v1` | **Đang dùng** cho backend MVP (D13; artifact TASK 03A `derived/`, `pipelineVersion = 1.0`) | Bản sao ở thư mục gốc workspace giống hệt, chỉ khác ký tự xuống dòng |
| 1.0 (handoff) | `HoaLich_harmonization_handoff_v1/` | Không dùng | Cũng ghi `VERSION = "1.0"` nhưng **khác mã nguồn**: có thêm phép chia an toàn khi `k_cell = 0` |
| 1.3 | `HoaLich_v1.3/` | Bản đã kiểm toán, sau MVP | Có lớp lịch đốt và cờ bất thường hai mức; `validation_anomaly.csv` |
| 1.4 | `HoaLich_v1.4/` | Thử nghiệm | |
| 1.6 | **Không có mã trong workspace** | Chỉ có **tệp điểm** `HoaLich_v1.6_points_clean.csv.gz` và nhật ký làm sạch | Mã nằm trên máy trưởng nhóm |

Hệ quả:

- Nhánh B (xu hướng) dùng **1.0**.
- Nhánh A (detection/cụm/sự kiện) dùng **tệp điểm 1.6**.
- Hai nguồn cùng gốc FIRMS tải ngày 13/11/2026. Số điểm ban ngày ngoài mặt nạ tĩnh của từng vệ tinh khớp giữa nhật ký 1.6 và `annual_counts_day_veg.csv` của 1.0. Ví dụ S-NPP năm 2024 là 50.991 ở cả hai nơi.
- Dù vậy, đây vẫn là **hai phiên bản xử lý khác nhau**. Mọi response phải ghi cả `pipelineVersion` và `pointsVersion`.

### 1.2. Dữ liệu và trường thực có

**FIRMS gốc** (4 tệp zip JSON, archive + NRT):

| Trường | Đơn vị / miền | MODIS C6.1 | VIIRS C2 |
|---|---|---|---|
| `latitude`, `longitude` | độ, WGS84; **tâm pixel**, không phải vị trí đám cháy | có | có |
| `acq_date`, `acq_time` | UTC; `acq_time` dạng chuỗi `HHMM` | có | có |
| `brightness` | K. MODIS: kênh 21/22 (~4 µm). VIIRS: kênh I4 (~3,7 µm) | có | có |
| `bright_t31` | K. MODIS: kênh 31 (~11 µm). VIIRS: kênh I5 (~11,45 µm) | có | có |
| `frp` | MW; công suất tức thời của pixel | có | có |
| `scan`, `track` | km; kích thước pixel theo hai trục | có | có |
| `confidence` | MODIS 0–100. VIIRS `l`/`n`/`h` | có | có |
| `type` | 0 thực vật giả định, 1 núi lửa, 2 nguồn tĩnh trên đất, 3 ngoài khơi | **chỉ archive** | **chỉ archive** |
| `daynight` | `D`/`N` | có | có |
| `version` | `6.03`, `6.1NRT` / `2`, `2.0NRT` | có | có |
| Mã lượt bay / granule, cờ QF (ví dụ `QF_I4`), mây, lớp phủ đất, góc nhìn | — | **không có** | **không có** |

Nguồn mô tả trường: [FIRMS active fire attributes](https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs), [MODIS C6/C6.1 User Guide](https://modis-fire.umd.edu/files/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf), [VIIRS C2 375 m User Guide v1.2](https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf).

Nguồn của NOAA cho cùng sản phẩm VIIRS 375 m: [NOAA STAR Active Fires](https://star.nesdis.noaa.gov/jpss/fires.php), [I-band Active Fires ATBD](https://star.nesdis.noaa.gov/jpss/documents/ATBD/ATBD_Iband_ActiveFires_v1.0.pdf).

[README của FIRMS](https://firms.modaps.eosdis.nasa.gov/download/Readme.txt) ghi rằng dữ liệu NRT được thay bằng dữ liệu chất lượng chuẩn khi có, khoảng 3 tháng sau.

**Phạm vi thời gian theo tệp gốc** (UTC; đo trên tệp điểm v1.6, gồm cả ngày và đêm):

| Vệ tinh (tệp FIRMS) | Archive | NRT | Số điểm archive / NRT |
|---|---|---|---|
| Terra (M-C61) | 01/11/2000 03:23 → 30/08/2026 01:34 | 02/09/2026 01:49 → 11/11/2026 01:34 | 140.283 / 541 |
| Aqua (M-C61) | 04/07/2002 06:04 → 29/08/2026 08:04 | 01/09/2026 08:22 → 13/11/2026 08:39 | 301.262 / 1.251 |
| S-NPP (SV-C2) | 20/01/2012 05:42 → 31/07/2026 18:39 | 01/08/2026 05:48 → 01/11/2026 19:38 (vệ tinh ngừng) | 1.012.704 / 6.287 |
| NOAA-20 (J1V-C2) | 01/04/2018 06:02 → 31/07/2026 18:58 | 01/08/2026 06:08 → 13/11/2026 07:01 | 484.432 / 7.200 |
| NOAA-21 (J2V-C2) | 01/03/2023 05:30 → 31/07/2026 18:04 | 01/08/2026 06:54 → 13/11/2026 06:03 | 189.324 / 6.878 |

**Tệp điểm v1.6** (2.150.162 dòng; 01/11/2000 03:23 → 13/11/2026 08:39 UTC):

- Có thêm `dt` (UTC), `lst` (giờ mặt trời địa phương), `conf` (3 mức; MODIS cắt tại 30 và 80), `conf_modis`, `static` (thuộc mặt nạ nguồn tĩnh 0,01°), `cell` (0,25°), `year`, `month`, `pentad`, `src` (archive/nrt).
- Thời gian có độ phân giải **phút** (giây luôn là 0).
- Không có ô trống ở `frp`, `bright`, `conf`.
- `type = −1` ở toàn bộ 22.157 điểm NRT (01/08 – 13/11/2026).
- `type = 1`: 0 điểm. `type = 2`: 57.294. `type = 3`: 932.

**Snapshot 1.0** (`derived/`, 9.509 ngày × 587 ô, ngày theo **UTC**):

- `daily-values.f32`: `snpp_eq`.
- `daily-source.u8`: mã nguồn 1–4.
- `daily-input-count.i16`: số detection ban ngày ngoài mặt nạ tĩnh của vệ tinh nguồn.
- `daily-source-input-valid.u8`.

Mã nguồn theo manifest:

| Mã | Nguồn | Ý nghĩa | Khoảng ngày |
|---|---|---|---|
| 1 | Terra | Mô hình phân bổ | 11/2000 – 7/2002 |
| 2 | Aqua | Mô hình phân bổ | 8/2002 – 06/11/2026; sau 2012 chỉ để vá |
| 3 | S-NPP | Quan sát trực tiếp | 20/01/2012 – 01/11/2026 |
| 4 | NOAA-20 | Quy đổi, chia 1,0106 | 06/05/2018 – 13/11/2026; để vá và sau khi S-NPP ngừng |

Bảng phụ:

- `harmonized_025_month.csv`: ô × tháng, có `lo90`/`hi90` cho giai đoạn ước lượng.
- `harmonized_regions_pentad.csv`: vùng × pentad, có `lo90`/`hi90`.
- `uncertainty_table.csv`, `data_gaps.csv` (123 đợt mất dữ liệu).

Độ phân giải tổng hợp:

- Không gian: ô 0,25° (diện tích 709,3 – 764,0 km²).
- Thời gian: ngày, pentad (73 pentad; pentad 73 có 6 ngày ở năm nhuận), tháng, năm.
- Kiểm định và khoảng bất định chỉ có ở cấp **tháng/pentad**.

### 1.3. Tính năng: đã có / tính được ngay / cần thêm dữ liệu

| Tính năng | Trạng thái | Căn cứ |
|---|---|---|
| Lịch, bản đồ, chuỗi `snpp_eq` theo vùng/ô/khung | **Đã có** (backend 03B2, frontend trên nhánh `frontend/*`) | Contract v0.4 |
| Median lịch sử cùng kỳ (`includeBaseline`) | **Đã có** trong contract | D02/D24 |
| Bất thường theo thứ hạng (tháng, pentad, năm, YTD, 7 ngày) cho vùng | **Tính được ngay** | Phần IV |
| So sánh tháng/mùa/năm/vùng | **Tính được ngay** | Phần V |
| Chỉ số mùa (bắt đầu/giữa/kết thúc/độ dài/tập trung) | **Tính được ngay** (`ket_qua/season_metrics.csv`) | AN-05 |
| Điểm chuyển chế độ, độ dốc xu hướng | **Tính được ngay** (hồi cứu) | AN-06 |
| Cụm, sự kiện ước tính đến 07/2026 | **Tính được ngay** (chạy 83 giây) | EV-01 … EV-05 |
| Thống kê FRP/brightness theo cảm biến | **Tính được ngay** | Phần III-B |
| FRP cao bất thường; khu vực hiếm lịch sử | **Cần tính thêm** (đã có thử nghiệm) | AN-03, AN-04 |
| Sự kiện NRT 08–11/2026 | **Cần dữ liệu** (`type`) hoặc quyết định suy từ mặt nạ | EV-01 |
| Phân biệt 0 do không cháy với 0 do mây | **Cần dữ liệu** (mây / quan sát hợp lệ) | DQ-01 |
| FRE (năng lượng) | **Cần dữ liệu** (lấy mẫu dày, ví dụ địa tĩnh) và phương pháp | FRP-04 |
| Đơn vị hành chính | **Cần dữ liệu** (ranh giới chính thức) | SP-04 |
| “Cháy rừng” | **Cần dữ liệu** (lớp phủ rừng) | — |
| Độ chính xác xác nhận cháy | **Cần dữ liệu đối chứng độc lập** | Phần VIII |

---

## Phần II. Định nghĩa và nguyên tắc bắt buộc

### 2.1. Thuật ngữ

| Thuật ngữ | Định nghĩa trong Hỏa Lịch | Không được hiểu là |
|---|---|---|
| Detection | Một pixel được thuật toán vệ tinh gắn cờ có lửa tại một lượt quan sát; tọa độ là tâm pixel | Một đám cháy |
| Nhóm quan sát | Detection cùng vệ tinh, trong một cửa sổ ≤ 10 phút (đại diện cho lượt bay) | Lượt bay đã xác thực |
| Cụm phát hiện | Thành phần liên thông của detection cách nhau ≤ 1 km trong cùng nhóm quan sát | Một đám cháy |
| Sự kiện cháy ước tính | Chuỗi cụm liên kết theo ≤ 24 giờ và ≤ 1 km | Đám cháy đã xác nhận; thời điểm bắt đầu hay tắt |
| Cell | Ô thống kê 0,25° | Vùng bị cháy |
| `snpp_eq` | Số detection ban ngày quy về thang S-NPP | Số đám cháy, diện tích |
| FRP | Công suất bức xạ tức thời của pixel (MW) | Năng lượng; cường độ cháy so được giữa cảm biến |
| Brightness | Nhiệt độ sáng của một kênh đo (K) | Nhiệt độ ngọn lửa; đại lượng chung của MODIS và VIIRS |

### 2.2. Danh sách cấm, có mã để kiểm tra trong code review

| Mã | Cấm |
|---|---|
| P01 | Gọi detection, `snpp_eq` hay `event_id` là số đám cháy |
| P02 | Gọi `type = 0` là cháy rừng đã xác nhận |
| P03 | Coi ngày không có detection là ngày chắc chắn không cháy |
| P04 | Cộng FRP qua nhiều thời điểm rồi gọi là năng lượng |
| P05 | So brightness MODIS với VIIRS như cùng một kênh |
| P06 | Kết luận xu hướng dài hạn từ số detection thô khi số vệ tinh thay đổi |
| P07 | Dùng dữ liệu sau thời điểm t để tạo baseline cho một cảnh báo tại t (chế độ vận hành) |
| P08 | Coi giá trị ngày phân bổ từ tháng (mã nguồn 1, 2) là quan sát thực |
| P09 | Lấy toàn bộ `snpp_eq` của ô làm giá trị chính xác của một vùng nhỏ bên trong ô |
| P10 | Gọi khoảng của dự án là “khoảng tin cậy 95%”. Khoảng hiện có là **khoảng 90% thực nghiệm** từ sai số kiểm định |
| P11 | Thêm epsilon vào mẫu số để tạo % tăng |
| P12 | Gộp bất thường dữ liệu vào bất thường cháy |

### 2.3. Hai nhánh không trộn chỉ số

| Thuộc tính | Nhánh A — detection/cụm/sự kiện | Nhánh B — xu hướng `snpp_eq` |
|---|---|---|
| Nguồn | Tệp điểm v1.6 | Snapshot 1.0 |
| `type` | Bắt buộc `= 0`; thiếu thì loại (mặc định) | Không lọc theo `type`; dùng mặt nạ tĩnh 0,01° (dựng từ `type` 2/3) |
| Confidence | MODIS ≥ 30; VIIRS `n`, `h` | **Giữ cả mức thấp** (8,1% tập lõi) |
| FRP | ≥ 5 MW | **Không lọc** |
| Ngày/đêm | Cả hai | **Chỉ ban ngày** |
| Mặt nạ nguồn tĩnh | Chưa áp (Q2) | Có |
| Vệ tinh | Tất cả, giữ nguyên | Quy về thang S-NPP |

Hệ quả đo được:

- Năm 2024, khu Tây Bắc, ngày 05/03: lõi `snpp_eq` có 1.484 detection ban ngày ngoài mặt nạ tĩnh, còn nhánh A chỉ có 889 detection đạt bộ lọc.
- Toàn kỳ: nhánh A giữ 1.161.304 / 2.150.162 detection; 14.703 trong số đó nằm trong mặt nạ tĩnh mà nhánh B đã loại.

Vì bộ lọc khác nhau, không lấy tỉ số giữa hai nhánh làm “tỉ lệ cháy thật”. Không hiển thị chúng trên cùng một trục.

---

## Phần III. Đơn vị không gian, thời gian và danh mục chỉ số

### 3.1. Đơn vị không gian

| ID | Đơn vị | Nhánh A (detection, cụm, sự kiện) | Nhánh B (`snpp_eq`) | Trạng thái |
|---|---|---|---|---|
| SP-01 | Cell 0,25° | **Chính xác** theo tâm pixel. Sự kiện thuộc ô nếu có ≥ 1 detection trong ô | **Chính xác** (đơn vị gốc) | Dùng ngay |
| SP-02 | Điểm + bán kính | **Chính xác theo tâm pixel** (Haversine). Pixel có kích thước (`scan × track`; MODIS ≥ 1 km, VIIRS ≥ 0,375 km), nên detection sát biên được gắn `NEAR_BOUNDARY` khi khoảng cách tới biên < max(`scan`, `track`)/2 | **Chỉ gần đúng.** Trả `snpp_eq` của các ô có tâm trong vòng tròn, kèm `polygonCoverage` = diện tích(vùng ∩ các ô)/diện tích(vùng) và `cellCoverage` = diện tích(vùng ∩ các ô)/diện tích(các ô). Không nhân tỉ lệ diện tích để “cắt” ô (P09). Nếu không có tâm ô nào trong vùng: `NO_CELLS_IN_BOUNDS`, chỉ còn nhánh A | Dùng ngay (A); B gần đúng |
| SP-03 | Polygon người dùng vẽ | Như SP-02 (point-in-polygon) | Như SP-02. Bbox là trường hợp riêng đã có trong v0.4 | Dùng ngay với bbox; polygon tự do cần thêm API |
| SP-04 | Đơn vị hành chính | Cần ranh giới chính thức | Cần ranh giới. Vùng chẩn đoán **không** phải hành chính | Cần dữ liệu |

### 3.2. Thời gian

| ID | Quy tắc |
|---|---|
| TM-01 | **Lưu UTC.** `observedUtc = acq_date + acq_time`, với `acq_time` đệm đủ 4 chữ số (`"0323"` → 03:23). |
| TM-02 | **Ngày địa phương** = ngày của (`observedUtc` + 7 giờ), múi Asia/Ho_Chi_Minh, không có giờ mùa hè. Đo trên tệp điểm: detection ban ngày có giờ UTC từ 01 đến 09, nên ngày địa phương **trùng** ngày UTC ở 100%. Detection ban đêm có giờ UTC từ 12 đến 21, nên **89,5%** rơi sang ngày địa phương hôm sau. `lst` là giờ mặt trời, **không** dùng làm ngày dân sự. |
| TM-03 | Snapshot 1.0 dùng ngày UTC (`timeZone = UTC`). Vì lõi chỉ có ban ngày, ngày UTC trùng ngày địa phương. Nhánh A có ban đêm nên phải hiển thị theo ngày địa phương và ghi rõ. |
| TM-04 | Pentad: 73 kỳ 5 ngày theo ngày trong năm. Pentad 73 có 6 ngày ở năm nhuận, nên so pentad 73 bằng **trung bình mỗi ngày**. Cửa sổ ngày quanh 29/02 ánh xạ sang 28/02 ở năm không nhuận. |
| TM-05 | Kỳ chưa hoàn tất chỉ so với **cùng khoảng ngày** của lịch sử (ví dụ 01–13/11). |
| TM-06 | Mùa: **năm-mùa** của mỗi vùng bắt đầu ở tháng ngay sau tháng có trung vị hoạt động thấp nhất 2003–2025. Kết quả tính: Tây Nguyên 12, Tây Bắc 9, ĐBSCL 11, ĐBSH 9, Khác 11, Toàn quốc 11. Năm-mùa vắt qua hai năm dân lịch và được đặt tên `2024-2025`. Đây là **giả định dữ liệu**, không phải mùa khí hậu; cho phép cấu hình (CFG `seasons`). Không dùng chung một mùa cho cả nước. |
| TM-07 | Khoảng tùy chọn: mọi khoảng `[start, end]`. So lịch sử bằng cùng tháng-ngày đầu/cuối của các năm khác (TM-04 cho 29/02). |

### 3.3. Danh mục chỉ số

Cột **Không gian** ghi: C = chính xác cho cell, P = chính xác cho điểm/polygon theo tâm pixel, ≈ = chỉ gần đúng cho điểm/polygon.

#### A. Mức hoạt động

| ID | Chỉ số | Nhánh | Đơn vị | Không gian | Trạng thái |
|---|---|---|---|---|---|
| A01 | Số detection thô theo vệ tinh × D/N × archive/NRT | A | detection | C, P | Dùng ngay. Không dùng cho xu hướng (P06) |
| A02 | Số detection đạt từng bộ lọc (`type`, confidence, FRP), đếm riêng từng lý do | A | detection | C, P | Dùng ngay |
| A03 | Số ngày có ≥ 1 detection (ngày địa phương), theo một vệ tinh | A | ngày | C, P | Dùng ngay |
| A04 | Số nhóm quan sát có detection | A | nhóm | C, P | Dùng ngay |
| A05 | Số cụm; số sự kiện; sự kiện mới (lần đầu quan sát trong kỳ); sự kiện tiếp diễn; sự kiện chưa rõ liên kết | A | cụm / sự kiện | C, P | Dùng ngay; không so giữa các năm trừ EV-05 |
| A06 | `snpp_eq` theo ngày (chỉ mã 3, 4 là quan sát), pentad, tháng, mùa, năm, khoảng tùy chọn | B | `snpp_eq` | C, ≈ | Dùng ngay |

#### B. Tín hiệu nhiệt

| ID | Chỉ số | Quy tắc | Trạng thái |
|---|---|---|---|
| FRP-01 | FRP lớn nhất, kèm thời điểm, vệ tinh, confidence | Theo **từng cảm biến**; luôn trả kèm confidence (xem S7) | Dùng ngay |
| FRP-02 | Trung vị, p90, p99 FRP theo vệ tinh × D/N | Không gộp MODIS với VIIRS. Thực đo (ngoài mặt nạ tĩnh): S-NPP D 5,5 / 16,7 / 64,7 MW; Aqua D 17,1 / 62,2 / 221,0 MW | Dùng ngay |
| FRP-03 | Tổng FRP của **một** nhóm quan sát (MW tức thời) | Chỉ trong một vệ tinh, một nhóm. Cần loại trùng do chồng pixel ở mép quét (đặc biệt MODIS). Quy tắc loại trùng chưa chốt | Cần tính thêm |
| FRP-04 | FRE (MJ) | Chỉ khi tích phân FRP theo thời gian với tần suất lấy mẫu đủ dày ([Wooster và cộng sự 2005](https://doi.org/10.1029/2005JD006318)). Vệ tinh cực quỹ đạo chỉ cho vài lượt mỗi ngày | Cần dữ liệu |
| FRP-05 | Tỉ lệ detection đạt FRP ≥ 5 MW | Theo cảm biến. Aqua 98,1%; Terra 95,5%; S-NPP 48,8%; NOAA-20 46,9%; NOAA-21 56,5% | Dùng ngay |
| BT-01 | Phân bố brightness theo vệ tinh × D/N | Ví dụ S-NPP D p50 = 337,3 K, Aqua D p50 = 321,3 K: **khác kênh**, không so trực tiếp (P05). `< 250 K` là giá trị hỏng → `NOT_EVALUATED`; `367 K` là trần đo → `AT_SENSOR_CEILING` | Dùng ngay |
| BT-02 | Tỉ lệ vượt ngưỡng brightness tuyệt đối | Ngưỡng MODIS 360 K (D) / 320 K (N) theo [Giglio và cộng sự 2016](https://doi.org/10.1016/j.rse.2016.02.054); VIIRS 320 K (N), chỉ phần nhiệt độ, theo [Schroeder và cộng sự 2014](https://doi.org/10.1016/j.rse.2013.12.008). Là **cờ mô tả**, không phải bộ lọc xác nhận | Dùng ngay |

Không ghi đè giá trị gốc. Mọi giá trị tổng hợp nằm ở bảng riêng.

#### C. Phân bố không gian

| ID | Chỉ số | Công thức | Trạng thái |
|---|---|---|---|
| SPC-01 | Số ô có hoạt động | Nhánh A: số ô có ≥ 1 detection của **một vệ tinh**. Không dùng “ô có `snpp_eq` > 0”, vì ở giai đoạn ước lượng mô hình rải giá trị cả sang ô không có detection (S9) | Dùng ngay |
| SPC-02 | Mức tập trung | Phần của tổng `snpp_eq` năm nằm trong 10% ô cao nhất (59 ô). Thực đo 2005: 43,9%; 2015: 41,4%; 2024: 43,4%; 2025: 43,3% | Dùng ngay |
| SPC-03 | Thay đổi phân bố giữa hai kỳ | Khoảng cách biến thiên toàn phần `TV = ½ Σ_c |s_A(c) − s_B(c)|`, với `s(c)` là tỉ phần của ô | Tính được; chưa có ngưỡng |
| SPC-04 | Vị trí hiếm lịch sử | AN-04 | Cần tính thêm |
| SPC-05 | “Diện tích ô có phát hiện” | Tổng diện tích các ô có hoạt động. **Không phải diện tích cháy**; phải ghi rõ trên UI | Dùng ngay, kèm câu chữ |

#### D. Chất lượng dữ liệu

| ID | Chỉ số | Nguồn | Trạng thái |
|---|---|---|---|
| DQ-A | Tỉ phần ô-ngày theo mã nguồn 1–4 (trực tiếp / quy đổi / ước lượng) | `daily-source.u8` | Dùng ngay |
| DQ-B | Archive/NRT, phiên bản xử lý (`version`) | Tệp điểm | Dùng ngay |
| DQ-C | Ngày/đêm | Tệp điểm | Dùng ngay |
| DQ-D | Thiếu trường (`type`, confidence, FRP) | Tệp điểm | Dùng ngay |
| DQ-E | Mức đầy đủ quan sát theo vệ tinh × ngày × dải vĩ độ | `data_gaps.csv`. **Không** suy từ số detection | Dùng ngay (mất dữ liệu đã biết); mây thì cần dữ liệu |
| DQ-F | Thay đổi nguồn hoặc phiên bản trong kỳ | Mã nguồn, `version`, ngày phóng/ngừng vệ tinh | Dùng ngay |

---

## Phần IV. Baseline lịch sử

### 4.1. Hai chế độ

| Chế độ | Dùng cho | Tập tham chiếu | Ghi chú |
|---|---|---|---|
| `RETROSPECTIVE` (hồi cứu) | Mô tả lịch sử: “năm 2015 cao so với các năm khác” | Mọi năm trong cửa sổ, **trừ** năm mục tiêu (loại năm mục tiêu) | Có thể dùng năm sau t. **Không được** gọi là cảnh báo |
| `OPERATIONAL` (vận hành) | Mọi “cảnh báo” / “mức chú ý” | Chỉ năm < năm mục tiêu. Trong năm mục tiêu, chỉ dữ liệu ≤ ngày đánh giá | P07 |

Mọi response mang `mode`.

### 4.2. Quy tắc baseline theo cấp thời gian

| ID | Cấp | Cửa sổ tham chiếu | Lịch sử | Cố định / cuốn chiếu | `n` tối thiểu để gắn nhãn | Số quan sát hợp lệ tối thiểu (kỳ đích và **mỗi** năm tham chiếu) | Nguồn được dùng |
|---|---|---|---|---|---|---|---|
| BL-DAY7 | Ngày | Tổng 7 ngày (ngày chọn ± 3) so với cùng cửa sổ các năm | **Từ 2012** (giai đoạn S-NPP) | Mở rộng (vận hành) hoặc cố định trừ năm đích (hồi cứu) | 9 → chế độ vận hành gắn nhãn được từ 2021 | Đủ 7/7 ngày `AVAILABLE` với mã 3 hoặc 4; năm có ngày mã 1/2 trong cửa sổ bị loại | Chỉ mã 3, 4 (P08) |
| BL-PENTAD | Pentad | Cùng pentad | 2003–2025 | Như trên | 9 | Đủ 5/5 ngày (6/6 với pentad 73 năm nhuận; so trung bình ngày) | 2, 3, 4 (mã 2 có khoảng 90%) |
| BL-MONTH | Tháng | Cùng tháng | `FULL` 2003–2025 và `RECENT` 2017–2025 | `FULL`/`RECENT` cố định; vận hành mở rộng | 9 | Đủ mọi ngày của tháng (`coverage.partial = false`) | 2, 3, 4 |
| BL-SEASON | Năm-mùa | Cùng năm-mùa (TM-06) | Từ mùa 2003-2004 | Mở rộng | 9 | Đủ mọi ngày của năm-mùa | 2, 3, 4 |
| BL-YEAR | Năm | Các năm hoàn chỉnh | 2003–2025 | Cố định; vận hành mở rộng | 9 | Đủ 365/366 ngày | 2, 3, 4 |
| BL-PARTIAL | Kỳ đang diễn ra / YTD | Cùng khoảng ngày (TM-05) | Như cấp tương ứng | Như cấp tương ứng | 9 | Đủ mọi ngày của **cùng khoảng ngày** | Như trên |
| BL-A | Chỉ số nhánh A (đếm detection, sự kiện, FRP) | Như cấp tương ứng, **một vệ tinh** | Từ năm đầu của vệ tinh | Mở rộng | 9 | Không có ngày `OUTAGE` của vệ tinh trong dải vĩ độ của vùng; năm có ngày `OUTAGE` trong kỳ bị loại | Tệp điểm |

“Số quan sát hợp lệ” nghĩa là ngày có trạng thái quan sát biết được. Không có dữ liệu mây, nên đây là điều kiện **cần**, không phải đủ.

Quy tắc chung:

- Loại khỏi tập tham chiếu: kỳ `MISSING`, kỳ `partial`, kỳ có mã nguồn 1. **Giữ giá trị 0 hợp lệ.**
- Chuyển đổi cảm biến: nhánh B đã hài hòa, nhưng tập tham chiếu trộn giai đoạn ước lượng Aqua với giai đoạn S-NPP. Luôn kèm cảnh báo `BASELINE_MIXES_SENSOR_ERAS` (đã có trong manifest).
- Aqua trôi quỹ đạo: sau 2022 Aqua chỉ dùng để vá (D12), không làm nguồn chính.
- Đổi pipeline: baseline gắn với `dataVersion`. Đổi snapshot thì tính lại toàn bộ; không trộn baseline của hai snapshot.
- `n` không đủ → `INSUFFICIENT_BASELINE`. **Không** tự tạo ngưỡng.

### 4.3. Bằng chứng chọn cửa sổ: dữ liệu có bước gãy năm 2017

Kiểm định Pettitt [(Pettitt 1979)](https://doi.org/10.2307/2346729) trên tổng năm 2003–2025:

| Vùng | Năm đầu của chế độ mới | p xấp xỉ |
|---|---|---|
| Toàn quốc | 2017 | 0,001 |
| Tây Nguyên | 2017 | 0,001 |
| Tây Bắc | 2016 | 0,002 |
| Khác | 2017 | 0,015 |
| ĐBSH | 2019 | 0,061 |
| ĐBSCL | 2012 | 0,083 |

Kiểm định này giả định các năm độc lập, nên p chỉ là xấp xỉ.

Trung vị năm theo giai đoạn (toàn quốc): 2003–2011 là 85.687; 2012–2016 là 76.199; 2017–2025 là 49.752. Từ 2016 sang 2017, số detection thô ban ngày giảm ở **từng cảm biến riêng**: S-NPP −45%, Aqua −45%, Terra −38%. Vậy đây không phải lỗi ghép chuỗi. Nguyên nhân chưa xác định.

Tỉ lệ nhãn theo quy tắc AN-01 (`α = 0,10`), vùng × tháng:

| Chế độ, cửa sổ | Năm mục tiêu | HIGH | LOW | Ghi chú |
|---|---|---:|---:|---|
| Hồi cứu `FULL` 2003–2025 | 2003–2011 | 8,8% | 5,7% | |
| Hồi cứu `FULL` | 2012–2016 | 12,8% | 6,4% | |
| Hồi cứu `FULL` | 2017–2025 | 6,3% | 12,2% | Lệch về LOW sau bước gãy |
| Vận hành, mở rộng 2003 → y−1 | 2012–2016 | 14,7% | 9,7% | |
| Vận hành | 2017–2025 | 5,4% | 14,0% | |
| Vận hành | 2026 (tháng 1–10) | 16,7% | 13,3% | 60 cặp vùng-tháng |
| `RECENT` 2017–2025 | 2026 (tháng 1–10) | 16,7% | 10,0% | n = 9 |

Kỳ vọng khi không có gì bất thường là 8,7% mỗi phía (n = 22) và 10% (n = 9).

Quy tắc chốt đề xuất:

- Hiển thị song song `FULL` và `RECENT`.
- Khi hai cửa sổ cho nhãn khác nhau, gắn cảnh báo `BASELINES_DISAGREE`.
- Mốc 2017 có kiểm định Pettitt hỗ trợ cho toàn quốc, Tây Nguyên và Khác. Ở ĐBSCL và ĐBSH điểm gãy **không rõ** (p > 0,05).

---

## Phần V. Đánh giá phương pháp

| Phương pháp | Đánh giá trên dữ liệu này | Quyết định |
|---|---|---|
| Phân vị lịch sử p10/p90 (nội suy) | Mô phỏng 200.000 lần với các năm hoán đổi được: P(HIGH) = 23,3% với n = 5; 13,4% với n = 22. Thực tế đo được 13,5% HIGH, tức gần đúng mức ngẫu nhiên. Đổi sang kiểu không nội suy chỉ còn 13,0% ([Hyndman & Fan 1996](https://doi.org/10.1080/00031305.1996.10473566)) | **Không dùng** để gắn nhãn |
| Thứ hạng với `α` | P(HIGH) = j/(n+1) ≤ α khi các năm hoán đổi được. Mô phỏng: 10,1% (n = 9), 8,6% (n = 22). Cùng tính chất thứ hạng làm nền cho conformal prediction ([Angelopoulos & Bates](https://arxiv.org/abs/2107.07511)) | **Dùng** (AN-01, AN-02) |
| Chênh lệch tuyệt đối so với median | Luôn tính được | Mô tả |
| Chênh lệch tương đối | Cấp ô: median = 0 ở 24,0% trường hợp; với X > 0, 13,6% không xác định | Chỉ khi median ≥ `M_min` (chưa chốt) |
| Robust z (MAD) | MAD = 0 ở 24,0% trường hợp cấp ô; phân bố lệch phải ([Leys và cộng sự 2013](https://doi.org/10.1016/j.jesp.2013.03.013)) | Mô tả; `null` khi MAD = 0; không gắn nhãn |
| Poisson cho số detection | Phương sai/trung bình số detection S-NPP mỗi ngày tháng 3: Tây Nguyên 123,7; Tây Bắc 262,3; ĐBSCL 75,6. Quá phân tán | **Loại** |
| Negative Binomial | Phù hợp cho số đếm quá phân tán ([Lindén & Mäntyniemi 2011](https://doi.org/10.1890/10-1831.1)), nhưng `snpp_eq` không phải số nguyên | Cần tính thêm, chỉ cho nhánh A một vệ tinh |
| Khoảng dự báo kiểm định theo thời gian | Khoảng thứ hạng [thứ j nhỏ nhất, thứ j lớn nhất] có độ phủ danh nghĩa 1 − 2j/(n+1). Chạy lùi ([rolling-origin](https://otexts.com/fpp3/tscv.html), [Tashman 2000](https://doi.org/10.1016/S0169-2070(00)00065-0)) cho thấy độ phủ lệch theo giai đoạn (bảng 4.3) | Báo cáo độ phủ theo giai đoạn |
| Điều chỉnh mùa | Phép “cùng kỳ” đã khử mùa. So với tháng trước phải so với tỉ lệ chuyển tháng lịch sử (CMP-01) | Dùng |
| Duy trì qua nhiều kỳ | Cần k trên m kỳ liên tiếp; chưa có căn cứ chọn k, m | Tham số `null` |
| Kiểm soát so sánh bội | 587 ô × 1 ngày, với j/(n+1) = 2/23, cho khoảng 51 ô gắn cờ do ngẫu nhiên mỗi ngày. Với p xếp hạng nhỏ nhất 1/(n+1) = 0,043 (n = 22), thủ tục [Benjamini–Hochberg](https://doi.org/10.1111/j.2517-6161.1995.tb02031.x) q = 0,10 chỉ loại được giả thuyết khi ≥ 255 ô cùng đạt p nhỏ nhất | **Không** phát danh sách cảnh báo từng ô mỗi ngày; chỉ gắn nhãn cấp vùng |
| Xu hướng | Độ dốc Theil–Sen ([Sen 1968](https://doi.org/10.1080/01621459.1968.10480934)). Mann–Kendall phải hiệu chỉnh tự tương quan ([Hamed & Rao 1998](https://doi.org/10.1016/S0022-1694(97)00125-X)) | Dùng (CMP-08) |

---

## Phần VI. Hợp đồng quy tắc

Mỗi quy tắc có đủ 17 trường theo mục 8 của yêu cầu, cộng trường “Được / không được kết luận” (mục 7).

- Ngưỡng đọc từ **CFG**, không hard-code.
- Ghi `null` khi ngưỡng chưa có căn cứ.
- Trạng thái: **Dùng ngay** / **Cần tính thêm** / **Cần dữ liệu** / **Đã có**.

> Ngưỡng thống kê (ngưỡng thứ hạng, p90, p95, p99…) là **quy tắc của dự án**, không phải ngưỡng xác nhận cháy.
> Một giá trị vượt p95 nghĩa là cao hơn khoảng 95% giá trị tham chiếu. Nó **không** có nghĩa là xác suất có cháy là 95%.

### Nhánh A — detection, cụm, sự kiện

#### EV-01

| Trường | Nội dung |
|---|---|
| rule_id | `EV-01` |
| Tên và mục đích | Bộ lọc detection cho lớp sự kiện: chọn detection “cháy thực vật đạt bộ lọc FRP ≥ 5 MW” theo [quy tắc gốc](../QUY_TAC_NHAN_DIEN_SU_KIEN_CHAY.md) §1. |
| Đơn vị phân tích | Detection |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`); trường `type`, `conf`, `conf_modis`, `frp`, `sat`. |
| Bộ lọc | MODIS: `type = 0` VÀ `conf_modis ≥ 30` VÀ `frp ≥ 5`. VIIRS: `type = 0` VÀ `conf ∈ {n, h}` VÀ `frp ≥ 5`. |
| Công thức / pseudocode | `passed = type == 0 and frp >= 5 and (conf_modis >= 30 if MODIS else conf in {n,h})`. Ghi **mọi** lý do không đạt vào `filterReasons[]`; không xóa bản ghi. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | FRP 5 MW: tiền lệ [Afi và cộng sự 2026](https://jurnal.polibatam.ac.id/index.php/JAIC/article/download/12686/3628) (Riau, không xác minh thực địa). Confidence: [MODIS User Guide](https://modis-fire.umd.edu/files/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf), [VIIRS User Guide](https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf). Tổ hợp là lựa chọn dự án. |
| Số mẫu tối thiểu | Không áp dụng |
| Điều kiện đủ dữ liệu | Có đủ `type`, confidence, FRP cho detection. |
| Thiếu dữ liệu và trường hợp biên | `type` thiếu (toàn bộ NRT) → `typeStatus = MISSING`, không đạt (trừ khi Q1 chọn suy từ mặt nạ). FRP thiếu → `NOT_EVALUATED` (hiện 0 trường hợp). Không điền 0. |
| Đầu ra | `filterPassed`, `filterReasons[]`, `typeStatus`. |
| Mức độ chắc chắn và hạn chế | Bộ lọc không xác nhận cháy. Tác động khác nhau theo cảm biến (FRP-05). |
| Được / không được kết luận | Được: “detection đạt bộ lọc của dự án”. Không được: gọi là cháy rừng, cháy đã xác nhận (P02). |
| Câu diễn giải UI | “Điểm phát hiện đạt bộ lọc của dự án (type 0, confidence, FRP ≥ 5 MW). Không phải đám cháy đã xác nhận.” |
| Ví dụ số | 1.161.304 / 2.150.162 đạt. Không đạt: FRP < 5: 880.394; confidence thấp: 160.859; `type = 2`: 57.294; `type` thiếu: 22.157. |
| Cách kiểm định | Độ nhạy FRP 0/5/10 MW với số sự kiện; đối chiếu tập cháy đã xác minh (cần dữ liệu). |
| Trạng thái | Dùng ngay (archive); NRT chờ Q1. |

#### EV-02

| Trường | Nội dung |
|---|---|
| rule_id | `EV-02` |
| Tên và mục đích | Nhóm quan sát: đại diện cho một lượt bay của một vệ tinh để gom cụm. |
| Đơn vị phân tích | Nhóm (vệ tinh × cửa sổ thời gian) |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`); `sat`, `dt`. |
| Bộ lọc | Detection đạt EV-01. |
| Công thức / pseudocode | Sắp theo `observedUtc` trong từng vệ tinh. `if t − t_start_of_group > W: open new group`. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | `W = 10` phút: lựa chọn dự án vì FIRMS không có mã granule. |
| Số mẫu tối thiểu | Không áp dụng |
| Điều kiện đủ dữ liệu | Có `observedUtc` đến phút. |
| Thiếu dữ liệu và trường hợp biên | Không có mã lượt bay → `groupingMethod = TIME_WINDOW_PROXY`. Lượt bay dài hơn W bị tách. |
| Đầu ra | `groupId`, `startUtc`, `endUtc`, `detectionCount`. |
| Mức độ chắc chắn và hạn chế | Gần đúng; không bảo đảm đúng lượt bay. |
| Được / không được kết luận | Được: số nhóm quan sát có phát hiện. Không được: coi nhóm là lượt bay đã xác thực. |
| Câu diễn giải UI | “Nhóm quan sát: các phát hiện cùng vệ tinh trong ≤ 10 phút (ước lượng lượt bay).” |
| Ví dụ số | Kích thước nhóm: p50 = 137, p90 = 901, max = 5.729 detection. S-NPP ngày 05/03/2024 có 4 nhóm (05:19, 06:59 UTC ban ngày; 17:50, 19:30 UTC ban đêm). |
| Cách kiểm định | So với mã granule khi có (U-4). Độ nhạy 5/10/20 phút: 53.781 / 52.749 / 51.302 sự kiện (2024). |
| Trạng thái | Dùng ngay. |

#### EV-03

| Trường | Nội dung |
|---|---|
| rule_id | `EV-03` |
| Tên và mục đích | Cụm phát hiện: gom detection gần nhau trong một nhóm quan sát. |
| Đơn vị phân tích | Cụm |
| Dữ liệu đầu vào | Nhóm từ EV-02. |
| Bộ lọc | Detection đạt EV-01. |
| Công thức / pseudocode | DBSCAN(eps, `min_samples = 1`, Haversine), tương đương thành phần liên thông của đồ thị “khoảng cách ≤ eps”. Hiện thực bằng lưới băm 0,01° + union-find. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | eps = 1 km: lựa chọn dự án, cấu hình **thử nghiệm**; không phải ngưỡng xác nhận cùng đám cháy. |
| Số mẫu tối thiểu | 1 detection |
| Điều kiện đủ dữ liệu | Tọa độ hợp lệ. |
| Thiếu dữ liệu và trường hợp biên | Cụm 1 điểm vẫn giữ (`detectionCount = 1`). |
| Đầu ra | `clusterId`, `groupId`, `detectionCount`. |
| Mức độ chắc chắn và hạn chế | 1 km là khoảng nối, không phải bán kính; cụm có thể dài nhiều km. Pixel MODIS > 1 km có thể bị tách. |
| Được / không được kết luận | Được: số cụm theo cấu hình. Không được: gọi cụm là một đám cháy. |
| Câu diễn giải UI | “Cụm phát hiện: các điểm cách nhau ≤ 1 km trong cùng lượt quan sát (cấu hình thử nghiệm).” |
| Ví dụ số | 800.554 cụm (mọi năm); 75,3% có 1 detection. |
| Cách kiểm định | Độ nhạy eps 0,5/1/2 km: 64.807 / 52.749 / 43.307 sự kiện (2024). |
| Trạng thái | Dùng ngay. |

#### EV-04

| Trường | Nội dung |
|---|---|
| rule_id | `EV-04` |
| Tên và mục đích | Liên kết cụm thành sự kiện cháy ước tính. |
| Đơn vị phân tích | Sự kiện |
| Dữ liệu đầu vào | Cụm từ EV-03, theo thời gian. |
| Bộ lọc | Như EV-01. |
| Công thức / pseudocode | Duyệt cụm theo thời gian. Ứng viên là sự kiện có `t − lastObserved ≤ G` và có detection của **cụm gần nhất** cách ≤ D. 1 ứng viên → gắn vào. 0 → tạo mới. ≥ 2 → `AMBIGUOUS`, tạo ID riêng, không gộp. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | G = 24 giờ; D = 1 km: lựa chọn dự án, thử nghiệm. `L_max` (chuỗi dài) = `null`. |
| Số mẫu tối thiểu | 1 cụm |
| Điều kiện đủ dữ liệu | Ngày nằm trong `eventDataThrough` của vệ tinh. |
| Thiếu dữ liệu và trường hợp biên | Mất quan sát giữa hai lần → sự kiện có thể bị tách; không kết luận cháy đã tắt. Sự kiện cắt ngang `eventDataThrough` → cờ `CROSSES_EVENT_DATA_THROUGH`. |
| Đầu ra | `eventId`, `linkStatus`, `firstObservedUtc`, `lastObservedUtc`, `observedSpanHours`, `detectionCount`, `satellites[]`, `flags[]`. |
| Mức độ chắc chắn và hạn chế | Mây làm tách sự kiện; cháy gần nhau bị gộp; 616 chuỗi > 7 ngày (đa số là nguồn nhiệt lặp tại chỗ). |
| Được / không được kết luận | Được: “X sự kiện ước tính theo `experimental_v1`, Y cụm chưa rõ”. Không được: gọi là X đám cháy; gọi lần đầu/cuối là lúc bắt đầu/tắt. |
| Câu diễn giải UI | “Sự kiện cháy ước tính: cụm phát hiện nối nhau trong ≤ 24 giờ và ≤ 1 km. Không phải đám cháy đã xác nhận.” |
| Ví dụ số | 706.206 sự kiện; 8.298 cụm `AMBIGUOUS` (1,04%); 70,0% có 1 detection; 88,9% chỉ được quan sát 1 lần. Ví dụ ô 55_429 ngày 01/03/2024: 5 detection, 3 vệ tinh, trong 51 phút. |
| Cách kiểm định | Độ nhạy G 12/24/48 giờ: 53.777 / 52.749 / 50.860 sự kiện (2024). Rà thủ công chuỗi dài. Đối chiếu cháy đã xác minh (cần dữ liệu). |
| Trạng thái | Dùng ngay; `L_max` cần kiểm định. |

#### EV-05

| Trường | Nội dung |
|---|---|
| rule_id | `EV-05` |
| Tên và mục đích | Chuỗi sự kiện một vệ tinh: chỉ số sự kiện duy nhất được so qua nhiều năm. |
| Đơn vị phân tích | Vùng × năm/tháng |
| Dữ liệu đầu vào | EV-01 … EV-04 chạy riêng cho **một** vệ tinh. |
| Bộ lọc | EV-01 + `dayNight = D`. |
| Công thức / pseudocode | `count(events where satellite == S and day)` cho mỗi kỳ; kèm `events per 1000 snpp_eq`. |
| Baseline | Các năm của cùng vệ tinh (S-NPP 2012–2025; Aqua đến 2021). |
| Ngưỡng và nguồn gốc | Không có ngưỡng nhãn. Hệ số NOAA-20/S-NPP = 1,054 (trung vị 2019–2025) chỉ là mô tả, `applied = false`. |
| Số mẫu tối thiểu | Năm đủ 12 tháng của vệ tinh đó |
| Điều kiện đủ dữ liệu | Vệ tinh hoạt động suốt kỳ; kỳ không vượt `eventDataThrough`. |
| Thiếu dữ liệu và trường hợp biên | Năm thiếu hoặc partial → không vẽ cột, ghi lý do. Aqua từ 2022 → cảnh báo `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`. |
| Đầu ra | `period`, `eventCount`, `eventCountStatus`, `snppEq`, `eventsPer1000SnppEq`. |
| Mức độ chắc chắn và hạn chế | Ổn định nội bộ (274–316 sự kiện / 1.000 `snpp_eq`); chưa kiểm chứng độc lập. |
| Được / không được kết luận | Được: so số sự kiện S-NPP giữa 2012 và 2025. Không được: so sự kiện đa vệ tinh giữa các năm (2011 → 2012 là ×2,80, trong khi `snpp_eq` chỉ ×1,14). |
| Câu diễn giải UI | “Số sự kiện ước tính chỉ từ S-NPP, ban ngày, để so sánh được giữa các năm.” |
| Ví dụ số | S-NPP: 2012 = 20.646; 2016 = 22.528; 2017 = 12.814; 2024 = 15.688; 2025 = 11.723. |
| Cách kiểm định | Tỉ số với `snpp_eq` ổn định theo năm; kiểm định hệ số nối NOAA-20. |
| Trạng thái | Dùng ngay (S-NPP). |

### Nhánh A — đếm

#### AC-01

| Trường | Nội dung |
|---|---|
| rule_id | `AC-01` |
| Tên và mục đích | Đếm detection thô và detection đạt từng bộ lọc. |
| Đơn vị phân tích | Ô, vùng, điểm/polygon × kỳ |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | Không lọc (thô); đếm riêng theo EV-01. |
| Công thức / pseudocode | `count` theo `satellite × dayNight × src`; với bộ lọc: đếm từng `filterReason`. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | Không áp dụng |
| Điều kiện đủ dữ liệu | Có detection hoặc biết trạng thái quan sát. |
| Thiếu dữ liệu và trường hợp biên | 0 detection + `OBSERVED_NO_KNOWN_GAP` → `AVAILABLE 0` kèm `NO_CLOUD_INFORMATION`. Vệ tinh `OUTAGE` → `MISSING`. |
| Đầu ra | `detectionsBySatDnSrc{}`, `filterReasonCounts{}`. |
| Mức độ chắc chắn và hạn chế | Đếm chính xác pixel; không phải đám cháy. |
| Được / không được kết luận | Được: so trong cùng vệ tinh và cùng kỳ. Không được: xu hướng dài hạn khi số vệ tinh đổi (P06). |
| Câu diễn giải UI | “Số pixel được phát hiện theo từng vệ tinh; không phải số đám cháy.” |
| Ví dụ số | Tây Bắc 05/03/2024, ban ngày: Terra 28, Aqua 78, S-NPP 513, NOAA-20 472, NOAA-21 394; 889 đạt bộ lọc EV-01. |
| Cách kiểm định | Đối chiếu tổng với nhật ký v1.6 (S-NPP 2024 ban ngày ngoài mặt nạ = 50.991 ở cả hai nguồn). |
| Trạng thái | Dùng ngay. |

#### AC-02

| Trường | Nội dung |
|---|---|
| rule_id | `AC-02` |
| Tên và mục đích | Số ngày có phát hiện: tách tần suất khỏi cường độ. |
| Đơn vị phân tích | Vùng × kỳ, theo một vệ tinh |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | Lõi (ngoài mặt nạ tĩnh, ban ngày) hoặc EV-01, ghi rõ. |
| Công thức / pseudocode | `count(distinct localDate where detections ≥ 1)`. |
| Baseline | Cùng kỳ các năm của cùng vệ tinh (khi so). |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | Kỳ đủ ngày |
| Điều kiện đủ dữ liệu | Biết ngày `OUTAGE` của vệ tinh. |
| Thiếu dữ liệu và trường hợp biên | Ngày `OUTAGE` bị loại khỏi mẫu số; trả `observedDays`. |
| Đầu ra | `detectionDays`, `observedDays`. |
| Mức độ chắc chắn và hạn chế | Phụ thuộc mây và tần suất lượt bay. |
| Được / không được kết luận | Được: “tăng số detection nhưng không tăng số ngày”. Không được: so giữa các vệ tinh. |
| Câu diễn giải UI | “Số ngày có ít nhất một phát hiện (một vệ tinh).” |
| Ví dụ số | S-NPP Tây Nguyên 2013: detection +27,2% nhưng số ngày +0,0% (288 ngày). |
| Cách kiểm định | Kiểm tra với lịch mất dữ liệu. |
| Trạng thái | Dùng ngay. |

#### AC-03

| Trường | Nội dung |
|---|---|
| rule_id | `AC-03` |
| Tên và mục đích | Số nhóm quan sát có phát hiện. |
| Đơn vị phân tích | Vùng × kỳ, theo vệ tinh |
| Dữ liệu đầu vào | EV-02 |
| Bộ lọc | Như AC-02 |
| Công thức / pseudocode | `count(groups with ≥ 1 detection in area)`. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | Không áp dụng |
| Điều kiện đủ dữ liệu | Như AC-02. |
| Thiếu dữ liệu và trường hợp biên | Như AC-02. |
| Đầu ra | `groupCount`. |
| Mức độ chắc chắn và hạn chế | Phụ thuộc EV-02 (gần đúng). |
| Được / không được kết luận | Được: so trong cùng vệ tinh. Không được: gọi là số lượt bay. |
| Câu diễn giải UI | “Số lượt quan sát (ước lượng) có phát hiện.” |
| Ví dụ số | S-NPP ngày 05/03/2024: 4 nhóm (2 ban ngày, 2 ban đêm). |
| Cách kiểm định | So với mã granule (U-4). |
| Trạng thái | Dùng ngay. |

### Tín hiệu nhiệt — FRP

#### FRP-01

| Trường | Nội dung |
|---|---|
| rule_id | `FRP-01` |
| Tên và mục đích | FRP lớn nhất của kỳ, kèm thời điểm, vệ tinh, confidence. |
| Đơn vị phân tích | Vùng × kỳ × vệ tinh |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`); `frp`. |
| Bộ lọc | Theo nhánh A đang chọn. |
| Công thức / pseudocode | `argmax(frp)` trong từng vệ tinh × D/N. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | 1 detection |
| Điều kiện đủ dữ liệu | FRP không thiếu. |
| Thiếu dữ liệu và trường hợp biên | Không có detection → `null`, không phải 0. |
| Đầu ra | `valueMw`, `satellite`, `observedUtc`, `confidence`, `dayNight`. |
| Mức độ chắc chắn và hạn chế | FRP là công suất **tức thời** của pixel; phụ thuộc góc nhìn và kích thước pixel. |
| Được / không được kết luận | Được: “pixel có FRP lớn nhất là …”. Không được: so giá trị MODIS với VIIRS; gọi là cường độ đám cháy. |
| Câu diễn giải UI | “FRP: công suất bức xạ tức thời của pixel (MW) lúc vệ tinh quan sát.” |
| Ví dụ số | Tây Bắc 05/03/2024: 561,8 MW, Aqua, 06:31 UTC, confidence `h`. |
| Cách kiểm định | Kiểm tra trùng với giá trị gốc. |
| Trạng thái | Dùng ngay. |

#### FRP-02

| Trường | Nội dung |
|---|---|
| rule_id | `FRP-02` |
| Tên và mục đích | Phân vị FRP theo vệ tinh × ngày/đêm. |
| Đơn vị phân tích | Vùng × kỳ × vệ tinh × D/N |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | Ngoài mặt nạ tĩnh (hoặc EV-01, ghi rõ). |
| Công thức / pseudocode | `quantile(frp, [0.5, 0.9, 0.99])`, **không gộp** cảm biến. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | Số detection tối thiểu để báo p99: `null` (chưa chốt); trả `n` kèm theo |
| Điều kiện đủ dữ liệu | n đủ cho phân vị (trả `n`). |
| Thiếu dữ liệu và trường hợp biên | n nhỏ → chỉ trả trung vị và `n`. |
| Đầu ra | `p50`, `p90`, `p99`, `n`. |
| Mức độ chắc chắn và hạn chế | Phân bố lệch phải; phụ thuộc cảm biến. |
| Được / không được kết luận | Được: so trong cùng vệ tinh, cùng D/N. Không được: so S-NPP với Aqua. |
| Câu diễn giải UI | “Phân bố FRP của từng vệ tinh; không so giữa vệ tinh vì kích thước pixel khác nhau.” |
| Ví dụ số | Ngoài mặt nạ: S-NPP D 5,5 / 16,7 / 64,7 MW; Aqua D 17,1 / 62,2 / 221,0 MW; S-NPP N 1,2 / 3,7 / 12,9 MW. |
| Cách kiểm định | Ổn định theo năm của cùng vệ tinh. |
| Trạng thái | Dùng ngay. |

#### FRP-03

| Trường | Nội dung |
|---|---|
| rule_id | `FRP-03` |
| Tên và mục đích | Tổng FRP của một nhóm quan sát (MW tức thời). |
| Đơn vị phân tích | Nhóm quan sát |
| Dữ liệu đầu vào | EV-02 |
| Bộ lọc | Một vệ tinh, một nhóm. |
| Công thức / pseudocode | `sum(frp)` trong nhóm sau khi loại trùng do chồng pixel ở mép quét. Quy tắc loại trùng = `null`. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có |
| Số mẫu tối thiểu | 1 detection |
| Điều kiện đủ dữ liệu | Nhóm hoàn chỉnh. |
| Thiếu dữ liệu và trường hợp biên | Chưa loại trùng → cờ `FRP_SUM_NOT_DEDUPLICATED`. |
| Đầu ra | `frpSumMw`, `deduplicated`. |
| Mức độ chắc chắn và hạn chế | Thấp cho tới khi có quy tắc loại trùng. |
| Được / không được kết luận | Được: tổng tức thời của một lượt. Không được: cộng qua nhiều lượt và gọi là năng lượng (P04). |
| Câu diễn giải UI | “Tổng FRP tức thời trong một lượt quan sát (chưa loại trùng).” |
| Ví dụ số | S-NPP 05/03/2024 toàn quốc: nhóm 05:19 UTC 311 detection, tổng 4.050,2 MW; nhóm 06:59 UTC 568 detection, 6.173,2 MW (chưa loại trùng). |
| Cách kiểm định | Kiểm tra pixel chồng ở mép quét MODIS/VIIRS. |
| Trạng thái | Cần tính thêm. |

#### FRP-04

| Trường | Nội dung |
|---|---|
| rule_id | `FRP-04` |
| Tên và mục đích | FRE (năng lượng bức xạ). |
| Đơn vị phân tích | Sự kiện hoặc vùng × kỳ |
| Dữ liệu đầu vào | Chuỗi FRP dày theo thời gian |
| Bộ lọc | — |
| Công thức / pseudocode | `FRE = ∫ FRP dt` với lấy mẫu đủ dày ([Wooster và cộng sự 2005](https://doi.org/10.1029/2005JD006318)). |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | — |
| Số mẫu tối thiểu | — |
| Điều kiện đủ dữ liệu | Không có với vệ tinh cực quỹ đạo (vài lượt/ngày, mây). |
| Thiếu dữ liệu và trường hợp biên | Luôn trả `NOT_AVAILABLE`. |
| Đầu ra | — |
| Mức độ chắc chắn và hạn chế | — |
| Được / không được kết luận | Không được tính hay gọi tên FRE với dữ liệu hiện có. |
| Câu diễn giải UI | Không hiển thị. |
| Ví dụ số | Không áp dụng. |
| Cách kiểm định | Cần dữ liệu địa tĩnh. |
| Trạng thái | Cần dữ liệu. |

#### FRP-05

| Trường | Nội dung |
|---|---|
| rule_id | `FRP-05` |
| Tên và mục đích | Tỉ lệ detection đạt FRP ≥ 5 MW. |
| Đơn vị phân tích | Vùng × kỳ × vệ tinh |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | Lõi hoặc toàn bộ, ghi rõ. |
| Công thức / pseudocode | `count(frp ≥ 5) / count(all)`. |
| Baseline | Cùng vệ tinh các năm (khi so). |
| Ngưỡng và nguồn gốc | 5 MW (EV-01). |
| Số mẫu tối thiểu | Không áp dụng |
| Điều kiện đủ dữ liệu | FRP đủ. |
| Thiếu dữ liệu và trường hợp biên | FRP thiếu → loại khỏi mẫu số, đếm riêng. |
| Đầu ra | `share`, `n`. |
| Mức độ chắc chắn và hạn chế | Phản ánh cảm biến nhiều hơn hoạt động cháy. |
| Được / không được kết luận | Được: giải thích vì sao bộ lọc đổi xu hướng. Không được: so tỉ lệ MODIS với VIIRS như chất lượng cháy. |
| Câu diễn giải UI | “Phần trăm điểm có FRP ≥ 5 MW; khác nhau mạnh giữa MODIS và VIIRS.” |
| Ví dụ số | Aqua 98,1%; Terra 95,5%; S-NPP 48,8%; NOAA-20 46,9%; NOAA-21 56,5%. S-NPP ban ngày: 0,577 (2012) → 0,512 (2025). |
| Cách kiểm định | Theo năm và vệ tinh. |
| Trạng thái | Dùng ngay. |

### Tín hiệu nhiệt — brightness

#### BT-01

| Trường | Nội dung |
|---|---|
| rule_id | `BT-01` |
| Tên và mục đích | Phân bố brightness theo vệ tinh × ngày/đêm. |
| Đơn vị phân tích | Vùng × kỳ × vệ tinh × D/N |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`); `bright` (kênh ~4 µm), `bright31` (~11 µm). |
| Bộ lọc | Như FRP-02. |
| Công thức / pseudocode | Phân vị; gắn `NOT_EVALUATED` nếu `< 250 K`; `AT_SENSOR_CEILING` nếu `= 367 K` (VIIRS). |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | 250 K và 367 K: đo từ dữ liệu (nhật ký v1.6). |
| Số mẫu tối thiểu | Không áp dụng |
| Điều kiện đủ dữ liệu | Có brightness. |
| Thiếu dữ liệu và trường hợp biên | Giá trị hỏng/trần → loại khỏi phân vị, đếm riêng. |
| Đầu ra | `p05`, `p50`, `p95`, `invalidCount`, `ceilingCount`. |
| Mức độ chắc chắn và hạn chế | Kênh MODIS và VIIRS khác nhau; không phải nhiệt độ ngọn lửa. |
| Được / không được kết luận | Được: so trong cùng vệ tinh. Không được: so MODIS với VIIRS (P05). |
| Câu diễn giải UI | “Nhiệt độ sáng của kênh đo (K), không phải nhiệt độ ngọn lửa.” |
| Ví dụ số | p50 ban ngày: S-NPP 337,3 K; Aqua 321,3 K (khác kênh). 468 điểm VIIRS < 250 K (FRP trung vị 95,4 MW). 7,45% điểm VIIRS đạt EV-01 ở trần 367 K. |
| Cách kiểm định | Theo cảm biến. |
| Trạng thái | Dùng ngay. |

#### BT-02

| Trường | Nội dung |
|---|---|
| rule_id | `BT-02` |
| Tên và mục đích | Cờ vượt ngưỡng brightness tuyệt đối (mô tả). |
| Đơn vị phân tích | Detection |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | — |
| Công thức / pseudocode | MODIS D > 360 K; MODIS N > 320 K; VIIRS N > 320 K (chỉ phần nhiệt độ); VIIRS D: không ngưỡng. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | [Giglio và cộng sự 2016](https://doi.org/10.1016/j.rse.2016.02.054); [Schroeder và cộng sự 2014](https://doi.org/10.1016/j.rse.2013.12.008). Là nhánh trong thuật toán, không tái hiện toàn bộ thuật toán. |
| Số mẫu tối thiểu | Không áp dụng |
| Điều kiện đủ dữ liệu | Biết D/N và brightness hợp lệ. |
| Thiếu dữ liệu và trường hợp biên | Thiếu `QF_I4` (VIIRS) → chỉ “phần nhiệt độ”. Giá trị hỏng → `NOT_EVALUATED`. |
| Đầu ra | `brightnessFlag`. |
| Mức độ chắc chắn và hạn chế | Không vượt ngưỡng vẫn có thể là lửa (kiểm tra nền lân cận). |
| Được / không được kết luận | Không được dùng làm bộ lọc xác nhận cháy. |
| Câu diễn giải UI | “Cờ nhiệt bổ sung, không bắt buộc.” |
| Ví dụ số | Tập đạt EV-01: vượt MODIS 10.277; VIIRS đêm chỉ phần nhiệt 9.613; không vượt 388.045; VIIRS ngày không ngưỡng 753.369. |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

### Phân bố không gian

#### SPC-01

| Trường | Nội dung |
|---|---|
| rule_id | `SPC-01` |
| Tên và mục đích | Số ô có hoạt động. |
| Đơn vị phân tích | Vùng × kỳ |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | Một vệ tinh; lõi hoặc EV-01. |
| Công thức / pseudocode | `count(distinct cellId with detections ≥ 1)`. |
| Baseline | Cùng kỳ các năm của cùng vệ tinh. |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | Không áp dụng |
| Điều kiện đủ dữ liệu | Như AC-02. |
| Thiếu dữ liệu và trường hợp biên | Không dùng “ô có `snpp_eq` > 0”, vì mô hình rải giá trị (S9). |
| Đầu ra | `activeCells`, `totalCells`. |
| Mức độ chắc chắn và hạn chế | Không phải diện tích cháy. |
| Được / không được kết luận | Được: so phạm vi không gian giữa các năm cùng vệ tinh. Không được: gọi là diện tích cháy. |
| Câu diễn giải UI | “Số ô 0,25° có ít nhất một phát hiện (một vệ tinh).” |
| Ví dụ số | S-NPP: 2016 có 541 ô; 2017 có 525; 2024 có 547; 2025 có 538. |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

#### SPC-02

| Trường | Nội dung |
|---|---|
| rule_id | `SPC-02` |
| Tên và mục đích | Mức tập trung không gian. |
| Đơn vị phân tích | Vùng × năm |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | Phần tổng `snpp_eq` năm nằm trong 10% ô cao nhất. |
| Baseline | Các năm khác (khi so). |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | Năm đủ |
| Điều kiện đủ dữ liệu | Năm đủ ngày. |
| Thiếu dữ liệu và trường hợp biên | Năm partial → không so. |
| Đầu ra | `top10Share`. |
| Mức độ chắc chắn và hạn chế | Mô tả. |
| Được / không được kết luận | Được: “hoạt động tập trung hơn/ít hơn”. Không được: suy nguyên nhân. |
| Câu diễn giải UI | “Phần hoạt động nằm trong 10% ô cao nhất.” |
| Ví dụ số | 2005: 43,9%; 2015: 41,4%; 2024: 43,4%; 2025: 43,3%. |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

#### SPC-03

| Trường | Nội dung |
|---|---|
| rule_id | `SPC-03` |
| Tên và mục đích | Thay đổi phân bố không gian giữa hai kỳ. |
| Đơn vị phân tích | Hai kỳ, cùng tập ô |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | `TV = ½ Σ_c |s_A(c) − s_B(c)|`, với `s(c)` là tỉ phần của ô trong tổng. |
| Baseline | Phân bố TV của các cặp năm liền nhau (bối cảnh). |
| Ngưỡng và nguồn gốc | Không có ngưỡng; `null`. |
| Số mẫu tối thiểu | Hai kỳ đủ |
| Điều kiện đủ dữ liệu | Cùng tập ô, cùng độ dài kỳ. |
| Thiếu dữ liệu và trường hợp biên | Tổng = 0 → `null`. |
| Đầu ra | `tv` (0–1). |
| Mức độ chắc chắn và hạn chế | Mô tả. |
| Được / không được kết luận | Được: “phân bố đổi nhiều hơn/ít hơn thường gặp”. Không được: gọi là dịch chuyển đám cháy. |
| Câu diễn giải UI | “Mức khác nhau của phân bố không gian (0 = giống hệt, 1 = không trùng).” |
| Ví dụ số | 2016 → 2017: 0,178; 2024 → 2025: 0,183; 2005 → 2024: 0,339; các cặp năm liền nhau 2012–2025: trung vị 0,167, tối đa 0,217. |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

### Bất thường hoạt động (nhánh B, trừ AN-03/AN-04)

#### AN-01

| Trường | Nội dung |
|---|---|
| rule_id | `AN-01` |
| Tên và mục đích | Hoạt động cao hơn hầu hết các năm cùng kỳ (HIGH). |
| Đơn vị phân tích | Toàn quốc, 5 vùng (ô/khung chờ `M_min`) × pentad/tháng/năm-mùa/năm/YTD/7 ngày |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`); khoảng 90% (`uncertainty_table.csv`) cho mã nguồn 2. |
| Bộ lọc | Nhánh B (ban ngày, ngoài mặt nạ tĩnh, mọi confidence, không lọc FRP). |
| Công thức / pseudocode | `X` = tổng kỳ; `R` theo BL-*; `j = floor(α(n+1))`; `j < 1 → INSUFFICIENT_BASELINE`; `X >` giá trị lớn thứ j → HIGH; mã 2: HIGH nếu `lo90 >` ngưỡng, ngược lại `POSSIBLY_HIGH`. |
| Baseline | BL-* theo cấp; `FULL` 2003–2025 và `RECENT` 2017–2025; chế độ `OPERATIONAL` (năm < y) cho mức chú ý. |
| Ngưỡng và nguồn gốc | α = 0,10: đề xuất, chưa hiệu chỉnh theo người dùng. Không dùng p90 nội suy (QT Phần V). |
| Số mẫu tối thiểu | n ≥ 9 (hệ quả của α) |
| Điều kiện đủ dữ liệu | Kỳ đích đủ ngày (hoặc cùng khoảng ngày); mỗi năm tham chiếu đủ ngày (BL §4.2). |
| Thiếu dữ liệu và trường hợp biên | Năm thiếu/partial/mã 1 bị loại khỏi `R`. Cấp ngày lẻ → `NOT_ASSESSED`. |
| Đầu ra | `classification`, `j`, `lowCut`, `highCut`, `n`, `median`, `delta`, `deltaPct`, `percentile`, `rank`, `mode`, `window`, `attentionLevel`. |
| Mức độ chắc chắn và hạn chế | Khoảng α kỳ bình thường vẫn mang nhãn; cửa sổ ảnh hưởng mạnh; không có mây. |
| Được / không được kết luận | Được: “cao hơn hầu hết các năm cùng kỳ”. Không được: “có cháy nguy hiểm”, “xác suất cháy 90%”. |
| Câu diễn giải UI | “Cao hơn hầu hết các năm cùng kỳ (2003–2025): hạng 1/24. Nhãn thống kê, không phải xác nhận cháy.” |
| Ví dụ số | Toàn quốc 10/2026 (vận hành): X = 2.614,3; median 837,0; ngưỡng cao 1.665,5; hạng 1/24 → HIGH; `RECENT` cũng HIGH (median 996,0) → mức 2. |
| Cách kiểm định | Mô phỏng hoán đổi được (P(HIGH) = 8,6% với n = 22); chạy lùi vận hành (bảng 4.3); Tách hiệu chỉnh 2003–2016 / đánh giá 2017–2025 (Phần VIII). |
| Trạng thái | Dùng ngay (vùng). |

#### AN-02

| Trường | Nội dung |
|---|---|
| rule_id | `AN-02` |
| Tên và mục đích | Hoạt động thấp hơn hầu hết các năm cùng kỳ (LOW). |
| Đơn vị phân tích | Như AN-01 |
| Dữ liệu đầu vào | Như AN-01 |
| Bộ lọc | Như AN-01 |
| Công thức / pseudocode | `X <` giá trị nhỏ thứ j → LOW; mã 2: LOW nếu `hi90 <` ngưỡng, ngược lại `POSSIBLY_LOW`. |
| Baseline | Như AN-01 |
| Ngưỡng và nguồn gốc | Như AN-01 |
| Số mẫu tối thiểu | n ≥ 9 |
| Điều kiện đủ dữ liệu | Như AN-01 |
| Thiếu dữ liệu và trường hợp biên | Như AN-01 |
| Đầu ra | Như AN-01 |
| Mức độ chắc chắn và hạn chế | Có thể do mây che, không quan sát được; điểm gãy 2017 làm năm gần đây lệch về LOW với `FULL`. |
| Được / không được kết luận | Được: “thấp hơn hầu hết các năm”. Không được: “an toàn”, “không cháy”. |
| Câu diễn giải UI | “Thấp hơn hầu hết các năm cùng kỳ. Không có dữ liệu mây; mức thấp có thể do không quan sát được.” |
| Ví dụ số | Tây Nguyên 03/2024: vận hành (2003–2023, n = 21, ngưỡng thấp 5.073,0) → LOW; hồi cứu (2003–2025 trừ 2024, n = 22, ngưỡng thấp 3.875,0) → TYPICAL. Toàn quốc 03/2026: `FULL` LOW, `RECENT` TYPICAL. |
| Cách kiểm định | Như AN-01. |
| Trạng thái | Dùng ngay (vùng). |

#### AN-03

| Trường | Nội dung |
|---|---|
| rule_id | `AN-03` |
| Tên và mục đích | FRP cao bất thường trong nhóm quan sát tương đồng. |
| Đơn vị phân tích | Detection |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | Ngoài mặt nạ tĩnh; cùng vệ tinh × D/N × vùng × tháng. |
| Công thức / pseudocode | `flag if frp > Q_q(group, years < y)`; luôn kèm confidence; `conf = l` → `LOW_CONFIDENCE_HIGH_FRP`. |
| Baseline | Phân bố FRP của cùng nhóm ở các năm trước (vận hành). |
| Ngưỡng và nguồn gốc | q = `null` (chưa hiệu chỉnh). |
| Số mẫu tối thiểu | Số detection nền tối thiểu = `null` (chưa chốt) |
| Điều kiện đủ dữ liệu | Nhóm có lịch sử đủ. |
| Thiếu dữ liệu và trường hợp biên | Nhóm mới hoặc lịch sử ít → `INSUFFICIENT_BASELINE`. |
| Đầu ra | `frpPercentileInGroup`, `flag`, `confidence`. |
| Mức độ chắc chắn và hạn chế | FRP phụ thuộc góc nhìn, kích thước pixel; nhiều detection mỗi ngày → cần kiểm soát so sánh bội. |
| Được / không được kết luận | Được: “FRP cao hơn hầu hết detection cùng nhóm”. Không được: “đám cháy lớn bất thường”. |
| Câu diễn giải UI | “Pixel có FRP cao so với các phát hiện cùng vệ tinh, cùng vùng, cùng tháng các năm trước.” |
| Ví dụ số | S-NPP ban ngày, Tây Nguyên, tháng 3, nền 2012–2023 (n = 97.950): p99 = 93,6 MW; p99,9 = 223,6 MW; 2024 có 0,21% vượt p99. Một detection 11/03/2013: 952,9 MW nhưng `conf = l`, 367 K. |
| Cách kiểm định | Tỉ lệ cờ theo năm; ổn định theo vệ tinh. |
| Trạng thái | Cần tính thêm. |

#### AN-04

| Trường | Nội dung |
|---|---|
| rule_id | `AN-04` |
| Tên và mục đích | Phát hiện tại khu vực hiếm có lịch sử. |
| Đơn vị phân tích | Detection hoặc ô lưới g° |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | Một vệ tinh; lõi. |
| Công thức / pseudocode | `new = gridCell(lat, lon, g) not in {grid cells with detections of same satellite in years < y}`. |
| Baseline | Mọi năm trước của cùng vệ tinh. |
| Ngưỡng và nguồn gốc | g = `null`. |
| Số mẫu tối thiểu | Số năm lịch sử tối thiểu: `null` (chưa chốt) |
| Điều kiện đủ dữ liệu | Vệ tinh có lịch sử. |
| Thiếu dữ liệu và trường hợp biên | Vệ tinh mới (NOAA-21 từ 2023) → `INSUFFICIENT_BASELINE`. |
| Đầu ra | `isNewLocation`, `gridDeg`. |
| Mức độ chắc chắn và hạn chế | Phụ thuộc mạnh vào g; sai số vị trí pixel; thay đổi sử dụng đất. |
| Được / không được kết luận | Được: “chưa từng có phát hiện ở ô lưới này (vệ tinh X)”. Không được: “cháy mới / cháy rừng mới”. |
| Câu diễn giải UI | “Vị trí chưa từng có phát hiện của vệ tinh này trong các năm trước.” |
| Ví dụ số | S-NPP ban ngày 2024 so với 2012–2023: lưới 0,01° → 8,2% detection ở ô mới; lưới 0,05° → 0,1%. |
| Cách kiểm định | Độ nhạy theo g; rà mẫu. |
| Trạng thái | Cần tính thêm. |

#### AN-05

| Trường | Nội dung |
|---|---|
| rule_id | `AN-05` |
| Tên và mục đích | Thời điểm và độ dài mùa hoạt động. |
| Đơn vị phân tích | Vùng × năm-mùa |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | Trong năm-mùa (TM-06): `onset`/`center`/`end` = ngày tỉ phần tích lũy đạt 10% / 50% / 90%; `duration = end − onset + 1`; `max30Share`. So bằng AN-01/02 với các mùa trước. |
| Baseline | BL-SEASON (các mùa trước; hồi cứu hoặc vận hành). |
| Ngưỡng và nguồn gốc | 10/50/90% và 30 ngày: lựa chọn dự án; α như AN-01. |
| Số mẫu tối thiểu | n ≥ 9 mùa |
| Điều kiện đủ dữ liệu | Năm-mùa trọn vẹn. |
| Thiếu dữ liệu và trường hợp biên | Mùa đang diễn ra → không tính `end`; mùa có tổng rất nhỏ → cờ `SEASON_METRICS_SENSITIVE_WHEN_TOTAL_LOW`. |
| Đầu ra | `onset`, `center`, `end`, `duration`, `max30Share`, nhãn từng chỉ số. |
| Mức độ chắc chắn và hạn chế | Mùa “dài” có thể chỉ là mùa “dẹt” khi tổng thấp. |
| Được / không được kết luận | Được: “mốc 90% đến muộn hơn hầu hết các mùa”. Không được: “mùa cháy bắt đầu ngày …”. |
| Câu diễn giải UI | “Ngày đạt 10% / 50% / 90% hoạt động của năm-mùa; không phải ngày bắt đầu/kết thúc mùa cháy thực tế.” |
| Ví dụ số | Tây Nguyên 2024-2025 so với 21 mùa trước: tổng 11.669,9 (median 27.561,9) → LOW; đỉnh 19/03 → TYPICAL; mốc 90% 02/08 → muộn (HIGH); độ dài 191 ngày → HIGH; `max30Share` 0,282 → LOW. |
| Cách kiểm định | Độ lệch chuẩn giữa các năm: Tây Nguyên `center` ±4,5 ngày; Tách hiệu chỉnh 2003–2016 / đánh giá 2017–2025. |
| Trạng thái | Dùng ngay. |

#### AN-06

| Trường | Nội dung |
|---|---|
| rule_id | `AN-06` |
| Tên và mục đích | Thay đổi kéo dài / chuyển chế độ. |
| Đơn vị phân tích | Vùng × chuỗi năm (hoặc cùng tháng qua năm) |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | Kiểm định [Pettitt](https://doi.org/10.2307/2346729) tìm điểm gãy; độ dốc [Theil–Sen](https://doi.org/10.1080/01621459.1968.10480934) trước và sau; Mann–Kendall hiệu chỉnh tự tương quan ([Hamed & Rao 1998](https://doi.org/10.1016/S0022-1694(97)00125-X)). |
| Baseline | Toàn chuỗi 2003–2025. |
| Ngưỡng và nguồn gốc | p < 0,05 để báo “điểm gãy rõ”: quy ước thống kê, không phải ngưỡng cháy. |
| Số mẫu tối thiểu | ≥ 10 năm |
| Điều kiện đủ dữ liệu | Năm đủ. |
| Thiếu dữ liệu và trường hợp biên | Năm partial bị loại. |
| Đầu ra | `changeYear`, `pApprox`, `slopeBefore`, `slopeAfter`. |
| Mức độ chắc chắn và hạn chế | Hồi cứu; giả định độc lập; p xấp xỉ. |
| Được / không được kết luận | Được: “chuỗi có điểm gãy quanh 2017”. Không được: nêu nguyên nhân. |
| Câu diễn giải UI | “Từ 2017 mức hoạt động ở mức thấp hơn rõ rệt so với trước (kiểm định Pettitt).” |
| Ví dụ số | Toàn quốc: gãy từ 2017 (p ≈ 0,001). Theil–Sen 2003–2025: −2.264/năm; 2017–2025: −1.027/năm. |
| Cách kiểm định | So nhiều vùng; kiểm tra cùng điểm gãy ở từng cảm biến thô. |
| Trạng thái | Dùng ngay (hồi cứu). |

#### AN-07

| Trường | Nội dung |
|---|---|
| rule_id | `AN-07` |
| Tên và mục đích | Duy trì: hoạt động cao kéo dài. |
| Đơn vị phân tích | Vùng × chuỗi kỳ |
| Dữ liệu đầu vào | AN-01 |
| Bộ lọc | Như AN-01 |
| Công thức / pseudocode | `level3 if count(level2 in last m periods) ≥ k`. |
| Baseline | Như AN-01 |
| Ngưỡng và nguồn gốc | k, m = `null`. |
| Số mẫu tối thiểu | m kỳ |
| Điều kiện đủ dữ liệu | m kỳ liên tiếp đều được đánh giá. |
| Thiếu dữ liệu và trường hợp biên | Kỳ không đánh giá được → ngắt chuỗi. |
| Đầu ra | `attentionLevel = 3`. |
| Mức độ chắc chắn và hạn chế | Chưa hiệu chỉnh. |
| Được / không được kết luận | Chưa dùng để kết luận. |
| Câu diễn giải UI | Chưa hiển thị. |
| Ví dụ số | Chưa có (chưa chọn k, m). |
| Cách kiểm định | Chạy lùi chọn k, m. |
| Trạng thái | Cần tính thêm. |

### Bất thường dữ liệu (tách khỏi bất thường cháy, P12)

#### DQ-01

| Trường | Nội dung |
|---|---|
| rule_id | `DQ-01` |
| Tên và mục đích | Mất quan sát (bất thường dữ liệu, không phải bất thường cháy). |
| Đơn vị phân tích | Vệ tinh × ngày × dải vĩ độ |
| Dữ liệu đầu vào | `data_gaps.csv` (123 đợt). |
| Bộ lọc | — |
| Công thức / pseudocode | `status = OUTAGE if date in gap(satellite, band)`. |
| Baseline | Thống kê lượt bay (pipeline). |
| Ngưỡng và nguồn gốc | Theo `log10_p` của pipeline; không đặt ngưỡng mới. |
| Số mẫu tối thiểu | — |
| Điều kiện đủ dữ liệu | — |
| Thiếu dữ liệu và trường hợp biên | Không có trong danh sách → `OBSERVED_NO_KNOWN_GAP` (không có nghĩa là quan sát đầy đủ). |
| Đầu ra | `observationStatus`. |
| Mức độ chắc chắn và hạn chế | Mây không có trong danh sách. |
| Được / không được kết luận | Được: “vệ tinh X không quan sát ngày …”. Không được: suy mức quan sát từ số detection. |
| Câu diễn giải UI | Biểu tượng chất lượng: “Vệ tinh không quan sát; giá trị được vá từ nguồn khác.” |
| Ví dụ số | S-NPP mất toàn quốc 11–16/07/2026; ngày 11/07: `snpp_eq` toàn quốc = 18,8, cả 587 ô mã 4 (NOAA-20). |
| Cách kiểm định | Đối chiếu danh sách granule chính thức (chưa làm). |
| Trạng thái | Dùng ngay. |

#### DQ-02

| Trường | Nội dung |
|---|---|
| rule_id | `DQ-02` |
| Tên và mục đích | Đổi nguồn vệ tinh hoặc phiên bản trong kỳ. |
| Đơn vị phân tích | Vùng × kỳ |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`); `version` (tệp điểm). |
| Bộ lọc | — |
| Công thức / pseudocode | `sourceCodeShare{1..4}`; cờ `SOURCE_SWITCH_IN_PERIOD` khi có > 1 mã; danh sách `version`. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có |
| Số mẫu tối thiểu | — |
| Điều kiện đủ dữ liệu | — |
| Thiếu dữ liệu và trường hợp biên | — |
| Đầu ra | `sourceCodeCellDays{}`, `versions[]`, `flags[]`. |
| Mức độ chắc chắn và hạn chế | Chính xác (đọc từ artifact). |
| Được / không được kết luận | Được: ghi chú nguồn. Không được: gộp vào nhãn hoạt động. |
| Câu diễn giải UI | “Kỳ này dùng nhiều nguồn: S-NPP trực tiếp và NOAA-20 quy đổi.” |
| Ví dụ số | 10/2026 toàn quốc: 17.351 ô-ngày mã 3 và 846 ô-ngày mã 4 (4,6%). |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

#### DQ-03

| Trường | Nội dung |
|---|---|
| rule_id | `DQ-03` |
| Tên và mục đích | Thiếu trường. |
| Đơn vị phân tích | Vùng × kỳ |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | — |
| Công thức / pseudocode | `count(type is null)`, `count(conf is null)`, `count(frp is null)`. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có |
| Số mẫu tối thiểu | — |
| Điều kiện đủ dữ liệu | — |
| Thiếu dữ liệu và trường hợp biên | — |
| Đầu ra | `missingFieldCounts{}`. |
| Mức độ chắc chắn và hạn chế | Chính xác. |
| Được / không được kết luận | Được: “X điểm thiếu type”. Không được: thay giá trị thiếu. |
| Câu diễn giải UI | “X điểm chưa có thông tin loại nguồn nhiệt (dữ liệu NRT).” |
| Ví dụ số | 22.157 điểm NRT thiếu `type` (01/08 – 13/11/2026). |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

#### DQ-04

| Trường | Nội dung |
|---|---|
| rule_id | `DQ-04` |
| Tên và mục đích | Tỉ số detection giữa hai vệ tinh cùng ngày lệch bất thường. |
| Đơn vị phân tích | Ngày |
| Dữ liệu đầu vào | Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`) |
| Bộ lọc | Lõi; ngày cả hai vệ tinh ≥ 100 detection. |
| Công thức / pseudocode | `r = N20/SNPP` theo ngày; so với phân bố lịch sử. |
| Baseline | 2019–2025. |
| Ngưỡng và nguồn gốc | `null` (chưa chốt). |
| Số mẫu tối thiểu | — |
| Điều kiện đủ dữ liệu | Cả hai vệ tinh hoạt động. |
| Thiếu dữ liệu và trường hợp biên | Một vệ tinh `OUTAGE` → không tính. |
| Đầu ra | `ratio`, `flag`. |
| Mức độ chắc chắn và hạn chế | Tỉ số ngày dao động rất rộng do khác giờ bay và mây; chỉ dùng để phát hiện lỗi lớn. |
| Được / không được kết luận | Được: “có thể có vấn đề dữ liệu”. Không được: kết luận về cháy. |
| Câu diễn giải UI | “Số phát hiện của hai vệ tinh lệch nhau bất thường ngày này (kiểm tra dữ liệu).” |
| Ví dụ số | 730 ngày (cả hai ≥ 100): p05 = 0,48; p50 = 1,02; p95 = 2,06; min 0,29; max 3,81. |
| Cách kiểm định | Đối chiếu ngày lệch lớn với thông báo sự cố vệ tinh. |
| Trạng thái | Cần tính thêm. |

### So sánh

#### CMP-01

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-01` |
| Tên và mục đích | Tháng này với tháng trước, có phân biệt thay đổi theo mùa. |
| Đơn vị phân tích | Vùng × cặp tháng liền nhau |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | `r = X_m / X_{m−1}`; so `r` với phân bố tỉ số của cùng cặp tháng các năm (thứ hạng, α). |
| Baseline | Cùng cặp tháng 2003–2025 (vận hành: năm < y). |
| Ngưỡng và nguồn gốc | α như AN-01. |
| Số mẫu tối thiểu | n ≥ 9 |
| Điều kiện đủ dữ liệu | Điều kiện chung: cùng phiên bản, cùng tập ô hoặc đã chuẩn hóa, cùng độ dài hiệu dụng, cả hai `AVAILABLE`, không có mã 1, cùng nhánh và bộ lọc. Không đạt → `differenceAvailable = false` + `reasons[]`. |
| Thiếu dữ liệu và trường hợp biên | `X_{m−1} = 0` → `r = null`; chỉ trả `delta`. |
| Đầu ra | `ratio`, `historicalMedianRatio`, `classification`, `delta`. |
| Mức độ chắc chắn và hạn chế | Phần lớn thay đổi giữa hai tháng là do mùa. |
| Được / không được kết luận | Được: “tăng nhiều hơn/ít hơn mức tăng mùa thường gặp”. Không được: gọi mức tăng mùa là bất thường. |
| Câu diễn giải UI | “Tăng ×2,54 so với tháng trước; mức tăng thường gặp của cặp tháng này là ×1,81.” |
| Ví dụ số | Toàn quốc 02 → 03/2026: 3.634,0 → 9.213,3 (×2,54); trung vị lịch sử ×1,81; ngưỡng 1,15 / 2,54 → TYPICAL (sát ngưỡng). Có `SEASONAL_CHANGE_EXPECTED`. |
| Cách kiểm định | Tách hiệu chỉnh 2003–2016 / đánh giá 2017–2025. |
| Trạng thái | Dùng ngay. |

#### CMP-02

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-02` |
| Tên và mục đích | Cùng tháng năm trước. |
| Đơn vị phân tích | Vùng × hai tháng cùng tên |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | `delta = B − A`; `deltaPct` khi `A ≥ M_min`; `log2(B/A)` so với phân bố biến động năm-năm. |
| Baseline | Phân bố |log₂| hai năm liền nhau (bối cảnh). |
| Ngưỡng và nguồn gốc | Không có ngưỡng ý nghĩa; bối cảnh p50/p75/p90 = 0,55 / 0,97 / 1,44. |
| Số mẫu tối thiểu | Hai kỳ đủ |
| Điều kiện đủ dữ liệu | Điều kiện chung: cùng phiên bản, cùng tập ô hoặc đã chuẩn hóa, cùng độ dài hiệu dụng, cả hai `AVAILABLE`, không có mã 1, cùng nhánh và bộ lọc. Không đạt → `differenceAvailable = false` + `reasons[]`. |
| Thiếu dữ liệu và trường hợp biên | A = 0 → `deltaPct = null`. |
| Đầu ra | `delta`, `deltaPct`, `log2Ratio`, `warnings`. |
| Mức độ chắc chắn và hạn chế | Bối cảnh mô tả, không phải kiểm định. |
| Được / không được kết luận | Được: “thay đổi nằm trong / vượt biến động thường gặp”. Không được: “giảm có ý nghĩa thống kê”. |
| Câu diễn giải UI | “Thấp hơn 22% so với cùng tháng năm trước; nằm trong biến động thường gặp.” |
| Ví dụ số | Tây Nguyên 03/2024 → 03/2025: 3.880,0 → 3.034,0 (−21,8%; \|log₂\| = 0,35). |
| Cách kiểm định | Phân bố |log₂| theo vùng và mùa. |
| Trạng thái | Dùng ngay. |

#### CMP-03

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-03` |
| Tên và mục đích | Tháng so với phân bố cùng tháng nhiều năm. |
| Đơn vị phân tích | Như AN-01 |
| Dữ liệu đầu vào | Như AN-01 |
| Bộ lọc | Như AN-01 |
| Công thức / pseudocode | = AN-01 / AN-02 (cấp tháng). |
| Baseline | BL-MONTH |
| Ngưỡng và nguồn gốc | α |
| Số mẫu tối thiểu | n ≥ 9 |
| Điều kiện đủ dữ liệu | Như AN-01 |
| Thiếu dữ liệu và trường hợp biên | Như AN-01 |
| Đầu ra | Như AN-01 |
| Mức độ chắc chắn và hạn chế | Như AN-01 |
| Được / không được kết luận | Như AN-01 / AN-02. |
| Câu diễn giải UI | “Hạng x/n trong các năm cùng tháng.” |
| Ví dụ số | Toàn quốc 03/2026: hạng 24/24 (`FULL`). |
| Cách kiểm định | Như AN-01. |
| Trạng thái | Dùng ngay. |

#### CMP-04

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-04` |
| Tên và mục đích | Tháng (hoặc năm) đang diễn ra so với cùng số ngày lịch sử. |
| Đơn vị phân tích | Vùng × khoảng ngày |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | `X = Σ days 1..d of current period`; `R = {same day span in other years}`; rồi AN-01. |
| Baseline | BL-PARTIAL |
| Ngưỡng và nguồn gốc | α |
| Số mẫu tối thiểu | n ≥ 9 |
| Điều kiện đủ dữ liệu | Cùng khoảng ngày cho mọi năm. |
| Thiếu dữ liệu và trường hợp biên | Khoảng chứa 29/02 → TM-04. |
| Đầu ra | Như AN-01 + `daySpan`. |
| Mức độ chắc chắn và hạn chế | Kỳ ngắn dao động mạnh hơn. |
| Được / không được kết luận | Được: so cùng khoảng ngày. Không được: so phần đã qua với cả tháng (sai −71% trong ví dụ). |
| Câu diễn giải UI | “01–13/11: so với cùng 13 ngày các năm trước.” |
| Ví dụ số | Toàn quốc 01–13/11/2026 = 398,5; cùng khoảng 2003–2025 median 493,0; ngưỡng 138,0 / 1.088,0 → TYPICAL. Cả tháng 11 có median 1.398,0. |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

#### CMP-05

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-05` |
| Tên và mục đích | Cùng mùa giữa các năm (tổng năm-mùa). |
| Đơn vị phân tích | Vùng × năm-mùa |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | Tổng năm-mùa; AN-01/02. |
| Baseline | BL-SEASON |
| Ngưỡng và nguồn gốc | α |
| Số mẫu tối thiểu | n ≥ 9 mùa |
| Điều kiện đủ dữ liệu | Năm-mùa trọn vẹn. |
| Thiếu dữ liệu và trường hợp biên | Mùa đang diễn ra → CMP-04. |
| Đầu ra | Như AN-01. |
| Mức độ chắc chắn và hạn chế | Định nghĩa mùa là giả định dữ liệu (TM-06). |
| Được / không được kết luận | Được: “mùa này thấp/cao hơn hầu hết các mùa”. Không được: gọi là “mùa cháy” khí hậu. |
| Câu diễn giải UI | “Tổng hoạt động năm-mùa 12/2024 – 11/2025 so với các mùa trước.” |
| Ví dụ số | Tây Nguyên 2024-2025: 11.669,9 so với median 27.561,9 → LOW (n = 21). |
| Cách kiểm định | Độ nhạy theo tháng bắt đầu mùa. |
| Trạng thái | Dùng ngay. |

#### CMP-06

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-06` |
| Tên và mục đích | Thời điểm bắt đầu / đỉnh / kết thúc và độ dài mùa. |
| Đơn vị phân tích | Như AN-05 |
| Dữ liệu đầu vào | Như AN-05 |
| Bộ lọc | Như AN-05 |
| Công thức / pseudocode | = AN-05. |
| Baseline | BL-SEASON |
| Ngưỡng và nguồn gốc | Như AN-05 |
| Số mẫu tối thiểu | n ≥ 9 |
| Điều kiện đủ dữ liệu | Như AN-05 |
| Thiếu dữ liệu và trường hợp biên | Như AN-05 |
| Đầu ra | Như AN-05 |
| Mức độ chắc chắn và hạn chế | Như AN-05 |
| Được / không được kết luận | Không được gọi ngày detection đầu tiên hay mốc 10% là ngày bắt đầu mùa cháy thực tế. |
| Câu diễn giải UI | Như AN-05. |
| Ví dụ số | Như AN-05. |
| Cách kiểm định | Như AN-05. |
| Trạng thái | Dùng ngay. |

#### CMP-07

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-07` |
| Tên và mục đích | Mức tập trung hoạt động trong mùa. |
| Đơn vị phân tích | Vùng × năm-mùa |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | `max30Share` = tổng 30 ngày lớn nhất / tổng mùa; AN-01/02. |
| Baseline | BL-SEASON |
| Ngưỡng và nguồn gốc | α; 30 ngày: lựa chọn dự án. |
| Số mẫu tối thiểu | n ≥ 9 |
| Điều kiện đủ dữ liệu | Mùa trọn vẹn. |
| Thiếu dữ liệu và trường hợp biên | Tổng mùa = 0 → `null`. |
| Đầu ra | `max30Share`, nhãn. |
| Mức độ chắc chắn và hạn chế | Mô tả. |
| Được / không được kết luận | Được: “hoạt động phân tán hơn”. Không được: suy nguyên nhân. |
| Câu diễn giải UI | “Phần hoạt động trong 30 ngày cao điểm nhất của mùa.” |
| Ví dụ số | Tây Nguyên 2024-2025: 0,282 so với median 0,343 → LOW. |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

#### CMP-08

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-08` |
| Tên và mục đích | So sánh năm. |
| Đơn vị phân tích | Vùng × năm |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`); tệp điểm cho số ngày có phát hiện. |
| Bộ lọc | Nhánh B; AC-02 một vệ tinh. |
| Công thức / pseudocode | Tổng năm (AN-01/02); số ngày có phát hiện (AC-02); SPC-02/03; Theil–Sen (AN-06). |
| Baseline | BL-YEAR |
| Ngưỡng và nguồn gốc | α |
| Số mẫu tối thiểu | n ≥ 9 năm đủ |
| Điều kiện đủ dữ liệu | Năm đủ 12 tháng. |
| Thiếu dữ liệu và trường hợp biên | 2000 và 2026 partial → chỉ so cùng khoảng ngày. |
| Đầu ra | Tổng, nhãn, `detectionDays`, `top10Share`, `tv`, độ dốc. |
| Mức độ chắc chắn và hạn chế | Đổi cảm biến đã được hài hòa ở nhánh B; số thô thì không. |
| Được / không được kết luận | Được: so `snpp_eq` giữa các năm. Không được: so detection thô đa vệ tinh (S6). |
| Câu diễn giải UI | “Tổng hoạt động năm đã quy về thang S-NPP.” |
| Ví dụ số | Detection thô ban ngày 2011 → 2012: 13.803 → 86.644 (×6,3); `snpp_eq` 66.128 → 75.241 (×1,14). |
| Cách kiểm định | Theo năm; leave-one-year-out (`validation_leave_one_year_out.csv`). |
| Trạng thái | Dùng ngay. |

#### CMP-09

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-09` |
| Tên và mục đích | So sánh khu vực. |
| Đơn vị phân tích | Hai vùng × cùng kỳ |
| Dữ liệu đầu vào | Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`) |
| Bộ lọc | Cùng nhánh, cùng bộ lọc. |
| Công thức / pseudocode | Mật độ = tổng / (diện tích các ô được chọn / 1.000 km²); cũng trả tổng và mỗi ô. |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | — |
| Điều kiện đủ dữ liệu | Điều kiện chung: cùng phiên bản, cùng tập ô hoặc đã chuẩn hóa, cùng độ dài hiệu dụng, cả hai `AVAILABLE`, không có mã 1, cùng nhánh và bộ lọc. Không đạt → `differenceAvailable = false` + `reasons[]`. Cho phép khác tập ô vì đã chuẩn hóa. |
| Thiếu dữ liệu và trường hợp biên | Diện tích ô theo vĩ độ (709,3 – 764,0 km²). |
| Đầu ra | `valueA`, `valueB`, `densityA`, `densityB`, `ratio`. |
| Mức độ chắc chắn và hạn chế | Vùng khác nhau về lớp phủ, mây và góc quan sát; chưa có dữ liệu lớp phủ. |
| Được / không được kết luận | Được: “mật độ phát hiện cao hơn”. Không được: “mật độ đám cháy cao hơn”; không so hai vùng khác lớp phủ mà không ghi chú. |
| Câu diễn giải UI | “Mật độ phát hiện trên 1.000 km² (không phải mật độ đám cháy).” |
| Ví dụ số | 03/2024: ĐBSCL 5.380 so với Tây Nguyên 3.880 → theo tổng ×1,39; theo mỗi ô ×2,38. |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

#### CMP-10

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-10` |
| Tên và mục đích | Hai bản đồ (dual-map). |
| Đơn vị phân tích | Ô × hai kỳ |
| Dữ liệu đầu vào | `/map/cells` × 2 |
| Bộ lọc | Nhánh B. |
| Công thức / pseudocode | Delta từng ô khi tương thích (v0.4 §7 / D20). |
| Baseline | Không dùng baseline (chỉ số mô tả) |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | — |
| Điều kiện đủ dữ liệu | Điều kiện chung: cùng phiên bản, cùng tập ô hoặc đã chuẩn hóa, cùng độ dài hiệu dụng, cả hai `AVAILABLE`, không có mã 1, cùng nhánh và bộ lọc. Không đạt → `differenceAvailable = false` + `reasons[]`. |
| Thiếu dữ liệu và trường hợp biên | Không tương thích → ẩn chênh lệch, ghi lý do. |
| Đầu ra | `delta` theo ô, `differenceAvailable`. |
| Mức độ chắc chắn và hạn chế | Từng ô dao động mạnh; không gắn nhãn. |
| Được / không được kết luận | Được: “ô X cao hơn ở kỳ B”. Không được: kết luận bất thường cấp ô (so sánh bội). |
| Câu diễn giải UI | “Chênh lệch từng ô giữa hai kỳ (cùng thang màu).” |
| Ví dụ số | Đã có trong frontend Compare (nhánh `frontend/*`). |
| Cách kiểm định | Contract test v0.4. |
| Trạng thái | Đã có. |

#### CMP-11

| Trường | Nội dung |
|---|---|
| rule_id | `CMP-11` |
| Tên và mục đích | Phân bố không gian giữa hai kỳ. |
| Đơn vị phân tích | Như SPC-03 |
| Dữ liệu đầu vào | Như SPC-03 |
| Bộ lọc | Như SPC-03 |
| Công thức / pseudocode | SPC-01 … SPC-03. |
| Baseline | Phân bố TV cặp năm liền nhau. |
| Ngưỡng và nguồn gốc | Không có ngưỡng (chỉ số mô tả) |
| Số mẫu tối thiểu | Hai kỳ đủ |
| Điều kiện đủ dữ liệu | Điều kiện chung: cùng phiên bản, cùng tập ô hoặc đã chuẩn hóa, cùng độ dài hiệu dụng, cả hai `AVAILABLE`, không có mã 1, cùng nhánh và bộ lọc. Không đạt → `differenceAvailable = false` + `reasons[]`. |
| Thiếu dữ liệu và trường hợp biên | Như SPC-03 |
| Đầu ra | `activeCells`, `top10Share`, `tv`. |
| Mức độ chắc chắn và hạn chế | Mô tả. |
| Được / không được kết luận | Được: “phân bố đổi nhiều hơn thường gặp”. Không được: “đám cháy dịch chuyển”. |
| Câu diễn giải UI | Như SPC-03. |
| Ví dụ số | 2024 → 2025: TV = 0,183 (cặp năm liền nhau 2012–2025: trung vị 0,167, tối đa 0,217). |
| Cách kiểm định | — |
| Trạng thái | Dùng ngay. |

### Mức chú ý (thay cho “mức cảnh báo”)

| Mức | Điều kiện | Màu UI |
|---|---|---|
| 0 — Bình thường | `TYPICAL` | Trung tính |
| 1 — Cao/thấp hơn hầu hết các năm | `HIGH`/`LOW` ở **một** cửa sổ, chế độ vận hành, cấp vùng | Màu nhấn trung tính, có chữ |
| 1′ — Có thể cao/thấp | `POSSIBLY_*` (giai đoạn ước lượng) | Viền nét đứt |
| 2 — Cao/thấp ở cả hai cửa sổ | `HIGH`/`LOW` ở cả `FULL` và `RECENT` | Nhấn mạnh hơn, **không** đỏ báo động |
| 3 — Cao kéo dài | Mức 2 ở ≥ k/m kỳ (AN-07) | Chưa bật |

Bất thường dữ liệu dùng biểu tượng riêng “chất lượng dữ liệu”, không dùng thang mức chú ý.

---

## Phần VII. Mười hai tình huống bắt buộc

Tất cả là số tính thật, trừ S10.

| # | Tình huống | Dữ liệu và kết quả | Quy tắc |
|---|---|---|---|
| S1 | Nhiều detection nhưng lịch sử cũng cao | Tây Bắc 05/03/2024: `snpp_eq` ngày 513,0; 7 ngày 1.335,0; nền 2012–2023 (n = 12) median 850,0, ngưỡng 103,0 / 4.938,0 → **TYPICAL**. Cùng ngày có 1.484 detection lõi; 889 đạt bộ lọc A; 398 sự kiện được quan sát (364 mới) | BL-DAY7, AN-01 |
| S2 | Ít detection nhưng bất thường với khu vực | ĐBSCL 04/10/2024: ngày 0,0; 7 ngày 11,0 so với ngưỡng cao 9,0, median 1,5 → HIGH theo công thức. Giá trị quá nhỏ, nên phải là `LOW_ACTIVITY` khi chốt `M_min`. Hiện MVP không gắn nhãn cấp ngày nhỏ | AN-01, 3.5 |
| S3 | Không có detection, chưa biết tình trạng quan sát | 11/07/2026: S-NPP mất toàn quốc (11–16/07). S-NPP gốc 0 detection. `snpp_eq` = 18,8, vá bằng NOAA-20 (mã 4). Nhánh A trả `PARTIAL_OBSERVATION`. Không có dữ liệu mây cho các ngày khác | DQ-01 |
| S4 | Tháng mới qua một phần | 01–13/11/2026 = 398,5 so với cùng 13 ngày (median 493,0) → TYPICAL; so với cả tháng sẽ sai thành −71% | CMP-04 |
| S5 | Baseline bằng 0 | Ô 54_430 tháng 8: median 2003–2025 (trừ 2024) = 0; năm 2024 = 5,0; 9/22 năm > 0. `deltaPct` = `null` (không thêm epsilon). Toàn bộ năm 2024 chỉ có 4 trường hợp ô-tháng như vậy với X > 3 | P11 |
| S6 | MODIS → VIIRS làm số thô tăng | Detection thô ban ngày: 2011 = 13.803 → 2012 = 86.644 (×6,3); `snpp_eq` 66.128 → 75.241 (×1,14). 2022 → 2023 (thêm NOAA-21): 77.630 → 151.279 so với ×1,47 | P06, EV-05 |
| S7 | FRP cao nhưng confidence thấp | 1.334 detection `conf = l` có FRP ≥ 100 MW. 468 detection VIIRS có brightness < 250 K (giá trị hỏng), FRP trung vị 95,4 MW. Ví dụ S-NPP 11/03/2013 (ô 56_431): 952,9 MW, `l`, 367 K | AN-03, BT-01 |
| S8 | NRT thiếu `type` | 22.157/22.157 điểm NRT; lớp sự kiện dừng 31/07/2026 (VIIRS). Suy từ mặt nạ tĩnh: 10.469 điểm đạt | EV-01, Q1 |
| S9 | `snpp_eq` ước lượng nhưng không có detection gốc | 97,2% ô-ngày mã 2 có giá trị > 0 nhưng **0 detection đầu vào**, mang 154.762,8 / 750.831,1 `snpp_eq`. Ví dụ ô 53_433 ngày 15/03/2010: 1,159, 0 detection | P08 |
| S10 | Kết quả đổi sau khi archive thay NRT | **Giả định có căn cứ:** theo FIRMS, NRT được thay bằng dữ liệu chuẩn sau khoảng 3 tháng. Khi archive 08–11/2026 có `type`, khoảng 22.157 detection sẽ được đánh giá lại; ước lượng theo mặt nạ là ~10.469 đạt. Số sự kiện, nhãn và `eventDataThrough` sẽ thay đổi | DC §7 |
| S11 | Tăng detection nhưng không tăng số ngày có phát hiện | S-NPP: Tây Nguyên 2013 +27,2% detection, +0,0% ngày (288); ĐBSCL 2018 +24,2% / −0,4% | AC-02 |
| S12 | Bộ lọc FRP ≥ 5 làm đổi xu hướng | S-NPP ban ngày, tỉ lệ FRP ≥ 5 giảm từ 0,577 – 0,589 (2012–2016) xuống 0,512 – 0,536 (2021–2025). Từ 2012 đến 2025: chưa lọc −45,5%, đã lọc −51,6% | FRP-05, P06 |

---

## Phần VIII. Kiểm định

| Hạng mục | Cách làm | Đã chạy | Kết quả / cần làm |
|---|---|---|---|
| Tỉ lệ nhãn khi không có bất thường | Mô phỏng hoán đổi được | Có | Mục V |
| Chạy lùi, không rò rỉ dữ liệu | Baseline vận hành chỉ dùng năm trước | Có (tháng × vùng) | Bảng 4.3; cần thêm pentad và 7 ngày |
| Tách hiệu chỉnh / đánh giá cho `M_min` | Nhãn thứ hạng cấp ô-tháng, vận hành (chỉ năm trước); hiệu chỉnh trên năm đích 2012–2016, đánh giá trên 2017–2025; nhóm theo median tham chiếu | **Có** (`calib_split.py`) | Bảng bên dưới |
| Độ nhạy baseline | `FULL`, `RECENT`, mở rộng dần | Có | Bảng 4.3 |
| Độ nhạy bộ lọc và ngưỡng sự kiện | eps, khoảng nối, cửa sổ, FRP | Có (eps, khoảng nối, cửa sổ) | FRP 0/10 MW: cần chạy |
| Ảnh hưởng mất dữ liệu / đổi cảm biến | DQ-01, DQ-02; EV-05 | Có một phần | Cần chạy riêng các tháng có mã 4 |
| Độ phủ khoảng 90% | `validation_coverage.csv` (1.0): 89,7–89,8% ở cấp ô-tháng | Có (pipeline) | Chưa có cho cấp vùng |
| Sai dương / sai âm | **Chỉ khi có nhãn đối chứng** (cháy đã xác minh) | **Không có** | Không tuyên bố accuracy |

**Kết quả tách hiệu chỉnh / đánh giá** (tỉ lệ nhãn HIGH / LOW, %, theo median tham chiếu của ô-tháng). Mức danh nghĩa là j/(n+1): 8,4–8,5% (2012–2016) và 7,2–8,4% (2017–2025).

| Median tham chiếu | Hiệu chỉnh 2012–2016: số trường hợp | HIGH | LOW | Đánh giá 2017–2025: số trường hợp | HIGH | LOW |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 1.965 | 0,0 | 0,0 | 7.266 | 3,3 | 0,0 |
| (0, 1] | 19.423 | 10,0 | **21,2** | 31.099 | 7,0 | 0,5 |
| (1, 5] | 6.958 | **15,8** | **18,5** | 12.416 | 7,4 | 7,9 |
| (5, 20] | 3.636 | 8,8 | 10,1 | 7.116 | 3,7 | 12,9 |
| (20, 100] | 2.345 | 6,3 | 6,6 | 4.222 | 1,7 | 13,2 |
| > 100 | 893 | 3,2 | 5,2 | 1.277 | 0,6 | **21,8** |

Đọc kết quả:

- **Hiệu chỉnh:** ô có median ≤ 5 `snpp_eq`/tháng cho tỉ lệ nhãn vượt xa mức danh nghĩa. Từ median > 5 trở lên thì gần mức danh nghĩa. Vì vậy **ứng viên `M_min` = 5** (cấp ô-tháng).
- **Đánh giá:** trên 2017–2025, ô hoạt động mạnh lại có quá nhiều LOW và quá ít HIGH. Nguyên nhân là bước gãy 2017, không phải mức hoạt động thấp.
- Kết luận: `M_min` = 5 là **ứng viên có căn cứ**, chưa đủ để bật nhãn cấp ô. Phải xử lý cửa sổ tham chiếu (Q3) trước, rồi chạy lại phép kiểm này với `RECENT`. Trong CFG, `value` vẫn là `null` và `candidate` là 5.

Những gì kết luận được khi chưa có ground truth:

- Kết luận được: tính nhất quán nội bộ (sự kiện S-NPP đi cùng `snpp_eq`), tỉ lệ nhãn so với kỳ vọng thống kê, độ nhạy.
- Không kết luận được: tỉ lệ cháy thật bị bỏ sót, độ chính xác “xác nhận cháy”.

## Phần IX. Hiện chưa thể kết luận

- Nguyên nhân bước gãy 2017.
- 0 hay thấp có phải do mây.
- Một sự kiện có phải cháy rừng, hay một đám cháy độc lập.
- Năng lượng (FRE) hoặc diện tích cháy.
- Cảnh báo cấp ô mỗi ngày có ý nghĩa thống kê (mục V, so sánh bội).
- Số sự kiện đa vệ tinh tăng/giảm qua năm.

## Phần X. Nguồn

**Dự án:**

- `QUY_TAC_NHAN_DIEN_SU_KIEN_CHAY.md`
- `TASK_03B_ANOMALY_DESIGN_NOTE.md`
- Contract và Decision Log v0.4
- Pipeline 1.0 (`README.md`, `uncertainty_table.csv`, `data_gaps.csv`, manifest)
- `HoaLich_v1.6_LAM_SACH_DU_LIEU.md`
- `validation_anomaly.csv` (1.3)

**NASA / FIRMS:**

- [README tải dữ liệu FIRMS](https://firms.modaps.eosdis.nasa.gov/download/Readme.txt)
- [Thuộc tính MODIS/VIIRS](https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs)
- [FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq)
- [Bài NASA về kích thước pixel trên bản đồ cháy](https://www.earthdata.nasa.gov/news/feature-articles/why-do-fires-nasas-maps-sometimes-look-bigger-than-really-are)
- [MODIS C6/C6.1 Fire User Guide](https://modis-fire.umd.edu/files/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf)
- [VIIRS C2 375 m AF User Guide v1.2](https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf)

**NOAA:**

- [NOAA STAR — Active Fires (JPSS VIIRS)](https://star.nesdis.noaa.gov/jpss/fires.php): mô tả sản phẩm (vị trí, FRP, mặt nạ lửa) và các ATBD.
- [NOAA I-band (375 m) Active Fires ATBD v1.0](https://star.nesdis.noaa.gov/jpss/documents/ATBD/ATBD_Iband_ActiveFires_v1.0.pdf): cơ sở thuật toán VIIRS 375 m, dùng cho EV-01, BT-02.

**ESA** (cho các nâng cấp cần dữ liệu):

- [ESA WorldCover](https://esa-worldcover.org/en): lớp phủ đất 10 m năm 2020 và 2021 từ Sentinel-1/2. Dùng cho U-5 (phân biệt rừng/nông nghiệp) và CMP-09 (so vùng khác lớp phủ). Hai năm dùng hai phiên bản thuật toán, nên thay đổi giữa 2020 và 2021 không chỉ là thay đổi thật.
- [ESA Fire_cci](https://climate.esa.int/en/projects/fire/): diện tích cháy. FireCCI51 (MODIS, 2001–2020) và FireCCIS311 (Sentinel-3 + VIIRS, 2019–2024) có lưới 0,25° **trùng lưới ô của Hỏa Lịch**. Dùng cho U-7 (đối chiếu diện tích cháy); không thay `snpp_eq`.

**Khoa học:**

- [Giglio và cộng sự 2016](https://doi.org/10.1016/j.rse.2016.02.054)
- [Schroeder và cộng sự 2014](https://doi.org/10.1016/j.rse.2013.12.008)
- [Wooster và cộng sự 2005](https://doi.org/10.1029/2005JD006318)
- [Afi và cộng sự 2026](https://jurnal.polibatam.ac.id/index.php/JAIC/article/download/12686/3628)
- [Pettitt 1979](https://doi.org/10.2307/2346729)
- [Sen 1968](https://doi.org/10.1080/01621459.1968.10480934)
- [Hamed & Rao 1998](https://doi.org/10.1016/S0022-1694(97)00125-X)
- [Benjamini & Hochberg 1995](https://doi.org/10.1111/j.2517-6161.1995.tb02031.x)
- [Lindén & Mäntyniemi 2011](https://doi.org/10.1890/10-1831.1)
- [Leys và cộng sự 2013](https://doi.org/10.1016/j.jesp.2013.03.013)
- [Hyndman & Fan 1996](https://doi.org/10.1080/00031305.1996.10473566)
- [Angelopoulos & Bates (arXiv 2107.07511)](https://arxiv.org/abs/2107.07511)
- [Hyndman & Athanasopoulos, FPP3 §5.10](https://otexts.com/fpp3/tscv.html)
- [Tashman 2000](https://doi.org/10.1016/S0169-2070(00)00065-0)
