# Kế hoạch sản phẩm — Theo dõi hoạt động cháy (Hỏa Lịch)

| Mục | Giá trị |
|---|---|
| Phiên bản | `product-plan-v0.2-draft` |
| Ngày | 15/11/2026 |
| Phạm vi | **Tài liệu kế hoạch.** Chưa sửa mã backend hay frontend. Việc triển khai bắt đầu sau khi đội chốt các quyết định ở §6 |
| Đi kèm | **QT** (quy tắc), **DC** (data contract), **CFG** (`ANALYTICS_RULES_CONFIG.json`) |

## 1. Sản phẩm theo dõi được gì, và không theo dõi được gì

| Lớp | Dữ liệu đến | Độ trễ so với 15/11/2026 | Ghi chú |
|---|---|---|---|
| Nhánh B: xu hướng `snpp_eq` | 13/11/2026 | ~2 ngày theo snapshot. Chưa có quy trình cập nhật định kỳ | Từ 02/11/2026 nguồn chính là NOAA-20 quy đổi (S-NPP ngừng) |
| Nhánh A: detection | 13/11/2026 (NRT) | ~2 ngày | NRT thiếu `type`, sẽ được archive thay sau khoảng 3 tháng |
| Nhánh A: sự kiện, bộ lọc nghiêm ngặt | 31/07/2026 (VIIRS), 29–30/08 (MODIS) | ~3,5 tháng | Chờ Q1 |

Sản phẩm trả lời được:

1. Một nơi, trong một ngày, có hoạt động phát hiện cao/thấp so với lịch sử không? Trả lời ở cấp vùng, theo cửa sổ 7 ngày (QT BL-DAY7).
2. Tháng, mùa, năm này so với cùng kỳ lịch sử, với kỳ trước và với vùng khác ra sao?
3. Tần suất phát hiện, phân bố không gian và tín hiệu nhiệt thay đổi thế nào?
4. Detection, cụm và sự kiện ước tính nằm ở đâu?

Sản phẩm **không** trả lời:

- có đang cháy rừng không;
- cháy bao nhiêu héc-ta;
- ngày mai cháy ở đâu;
- vì sao hoạt động giảm sau 2017;
- danh sách ô “bất thường” mỗi ngày. Lý do: với 22 năm lịch sử, cảnh báo cấp ô không vượt được kiểm soát so sánh bội (QT Phần V).

## 2. Luồng sử dụng

| Luồng | Bước | Endpoint (DC) | Quy tắc (QT) |
|---|---|---|---|
| F1. Hôm nay / ngày X ở vùng tôi quan tâm | Chọn vùng (Toàn quốc, 5 vùng, ô, khung, điểm + bán kính) → chọn ngày → xem detection, cụm, sự kiện trên bản đồ → thẻ “7 ngày quanh ngày X so với lịch sử” → bảng chất lượng dữ liệu | `/area/day` | AC-, EV-, AN-01 (7 ngày), DQ- |
| F2. Tháng / mùa / năm này so với lịch sử | Chọn kỳ → hai chip nhãn (`FULL`, `RECENT`) → biểu đồ có dải tham chiếu → giải thích | `/anomaly`, `/seasons` | AN-01/02/05 |
| F3. So sánh | Chọn kiểu: tháng trước, cùng tháng năm trước, cùng khoảng ngày, hai vùng, hai bản đồ → thẻ chênh lệch + lý do ẩn | `/comparison`, `/map/cells` ×2 | CMP- |
| F4. Mức chú ý gần đây | Danh sách mức chú ý **cấp vùng**, chế độ vận hành, kèm cờ chất lượng | `/attention` | Mức 1–2 |
| F5. Thay đổi dài hạn | Biểu đồ năm, điểm chuyển chế độ, độ dốc; chuỗi sự kiện một vệ tinh | `/anomaly?granularity=year`, `/events/series` | AN-06, EV-05 |
| F6. Đọc dữ liệu đúng | Data Notes: bộ lọc hai nhánh, phiên bản, bảng “không được kết luận” | `/metadata` | QT Phần II, IX |

## 3. Thành phần giao diện

Nguyên tắc màu:

- Nhãn thống kê dùng **màu trung tính có chữ**. Mức 2 chỉ nhấn mạnh hơn, không đỏ báo động.
- Chất lượng dữ liệu dùng biểu tượng riêng, không dùng thang màu của hoạt động.
- Giá trị ước lượng có viền hoặc nét đứt.
- `null` có ô gạch chéo, không bao giờ vẽ thành 0.

| # | Thành phần | Câu hỏi người dùng | Chỉ số | Điều kiện hiển thị | Tooltip | Thiếu dữ liệu / ước lượng |
|---|---|---|---|---|---|---|
| U1 | Bản đồ ô 0,25° (heatmap) | Hoạt động tập trung ở đâu? | A06 `snpp_eq` | Luôn | “Số phát hiện ban ngày quy về S-NPP trong ô 0,25°; không phải số đám cháy.” | Ô `null`: gạch chéo. Mã 2: viền nét đứt và chữ “ước lượng từ Aqua”. Ô mã 4: chấm nhỏ “NOAA-20 quy đổi” |
| U2 | Lớp detection | Vệ tinh thấy lửa ở đâu, lúc nào? | A01, A02, FRP-01, BT-01 | Khoảng ≤ `detectionLayerMaxDays` (CFG, chưa chốt) | Tâm pixel; kích thước pixel; vệ tinh; giờ địa phương; FRP; confidence; `typeStatus` | NRT có biểu tượng “tạm thời”. `type` thiếu: “chưa xác định loại”. Brightness 208/367 K: “chưa đánh giá” / “trần đo” |
| U3 | Lớp cụm / sự kiện | Các detection nào thuộc cùng một sự kiện ước tính? | EV-03, EV-04 | Khoảng nằm trong `eventDataThrough` | “Sự kiện ước tính theo quy tắc thử nghiệm 1 km / 24 giờ; không phải đám cháy đã xác nhận.” | Ngoài phạm vi: “Chưa có dữ liệu sự kiện sau 31/07/2026”. `AMBIGUOUS`: ký hiệu riêng. `LONG_CHAIN`: viền |
| U4 | Bộ chọn vùng | | SP-01 … SP-04 | Luôn | Với điểm/polygon: “Giá trị snpp_eq là của các ô có tâm trong vùng; vùng chỉ chiếm X% các ô đó.” | Không có tâm ô nào: “Vùng nhỏ hơn ô thống kê; chỉ có dữ liệu detection” |
| U5 | Bộ chọn thời kỳ | | TM-01 … TM-07 | Luôn | Ngày địa phương UTC+7. Kỳ chưa đủ ngày có nhãn “đến dd/mm” | Kỳ partial: số ngày đã có / tổng |
| U6 | Bộ chọn nguồn / bộ lọc | Đang xem dữ liệu nào? | Nhánh A/B, vệ tinh, bộ lọc | Luôn | Bảng so sánh hai nhánh (QT 2.3) | Đổi bộ lọc thì mọi số ghi rõ `filterVersion` |
| U7 | Heatmap lịch (tháng × năm, ngày × tháng) | Mùa đốt năm nay khác các năm thế nào? | A06, AN-01 | Cấp vùng | Giá trị + hạng + nhãn | `OUTSIDE_DATASET_RANGE`: ô trống có chú thích. Partial: nét đứt |
| U8 | Chuỗi thời gian + baseline | Đang cao hay thấp so với lịch sử? | AN-01/02, BL-* | Có `n ≥ 9` thì vẽ dải `[lowCut, highCut]` và đường median | “Dải: khoảng của hầu hết các năm trước (thứ hạng, α = 0,10); không phải khoảng tin cậy 95%.” | `n < 9`: chỉ vẽ median, ghi “chưa đủ lịch sử”. Mã 2: thêm khoảng 90% |
| U9 | Cùng tháng / cùng mùa qua các năm | Năm này đứng thứ mấy? | CMP-03, CMP-05 … CMP-07, AN-05 | Cấp vùng | Hạng; bước gãy 2017 | Năm thiếu/partial: không có cột, chú thích lý do |
| U10 | Phân bố FRP theo nguồn | Tín hiệu nhiệt có khác thường không? | FRP-02, FRP-05, AN-03 | Theo từng vệ tinh × D/N; **không gộp** | “FRP là công suất tức thời của pixel; MODIS và VIIRS khác kích thước pixel nên không so trực tiếp.” | Thiếu FRP: đếm riêng. Confidence thấp: tô khác |
| U11 | Danh sách mức chú ý | Có vùng nào đáng chú ý gần đây? | Mức 1, 1′, 2 (vận hành) | Cấp vùng; đủ `n` | Câu UI của quy tắc + “nhãn thống kê, không phải xác nhận cháy” | Mục có cờ chất lượng hiện biểu tượng bên cạnh |
| U12 | Bảng chất lượng dữ liệu | Có tin được con số này không? | DQ-A … DQ-F, DQ-01 … DQ-04 | Luôn, thu gọn | Phiên bản, nguồn, mất dữ liệu, NRT/archive | “Không có dữ liệu mây” luôn hiển thị |
| U13 | Thẻ so sánh | Khác bao nhiêu, có đáng kể không? | CMP-* | Có hai kỳ/vùng | Bối cảnh biến động thường gặp | `differenceAvailable = false`: “Không so được”, kèm lý do |
| U14 | Thanh độ mới dữ liệu | Dữ liệu đến khi nào? | `dataThrough`, `eventDataThrough` | Header | Tách theo lớp và vệ tinh | NRT: “tạm thời” |

## 4. MVP với dữ liệu hiện có

| # | Hạng mục | Quy tắc | Dữ liệu |
|---|---|---|---|
| M1 | Nhãn bất thường cấp vùng (tháng, pentad, năm, YTD, 7 ngày từ 2012), hai cửa sổ, hai chế độ | AN-01, AN-02 | `derived/` 1.0 |
| M2 | `POSSIBLY_*` cho giai đoạn ước lượng | AN-01 | `uncertainty_table.csv`; cần xác nhận chiều q05/q95 |
| M3 | So sánh tháng trước, cùng tháng năm trước, cùng khoảng ngày, hai vùng (mật độ), hai bản đồ | CMP-01 … CMP-04, CMP-09, CMP-10 | Có sẵn |
| M4 | Chỉ số mùa và so sánh mùa (năm-mùa theo vùng) | AN-05, CMP-05 … CMP-07 | Có sẵn |
| M5 | Xu hướng dài hạn hồi cứu: Pettitt, Theil–Sen | AN-06, CMP-08 | Có sẵn |
| M6 | Lớp detection (archive + NRT, có nhãn tạm thời) | AC-, FRP-, BT- | Tệp điểm v1.6 |
| M7 | Cụm, sự kiện đến 07/2026; chuỗi sự kiện S-NPP 2012–2025 | EV-01 … EV-05 | Tệp điểm v1.6 |
| M8 | Bảng chất lượng dữ liệu | DQ- | `data_gaps.csv`, mã nguồn |
| M9 | Data Notes bổ sung | QT II, IX | Tài liệu |

Chỉ hiển thị số, chưa gắn nhãn (chờ hiệu chỉnh):

- nhãn cấp ô / khung / điểm (`M_min`);
- AN-03 (FRP cao bất thường) và AN-04 (khu vực mới);
- AN-07 (duy trì);
- sự kiện NRT (Q1).

## 5. Nâng cấp cần thêm dữ liệu hoặc kiểm định

| # | Nâng cấp | Cần | Mở khóa |
|---|---|---|---|
| U-1 | Cập nhật định kỳ | Quy trình tải FIRMS, chạy pipeline, phiên bản hóa snapshot, thay NRT bằng archive (DC §7) | Theo dõi gần thời gian thực cho cả hai nhánh |
| U-2 | Sự kiện NRT | Archive có `type`, hoặc kiểm định cách suy `type` từ mặt nạ | Sự kiện 08–11/2026 |
| U-3 | Phân biệt 0 do không cháy với 0 do mây | Mặt nạ mây hoặc số lần quan sát hợp lệ theo pixel | Bỏ cảnh báo `NO_CLOUD_INFORMATION`; mới có thể làm nhãn “thấp” đáng tin |
| U-4 | Nhóm quan sát thật | Mã granule / lượt bay | Thay cửa sổ 10 phút |
| U-5 | “Cháy rừng”, “đốt nông nghiệp” | Lớp phủ đất/rừng theo năm (ví dụ [ESA WorldCover](https://esa-worldcover.org/en), 10 m, 2020–2021) | Câu chữ và bộ lọc theo lớp phủ |
| U-6 | Kiểm định sự kiện | Tập cháy đã xác minh tại Việt Nam, ảnh độ phân giải cao | Sai dương / sai âm; chốt eps, khoảng nối, `L_max` |
| U-7 | FRE | Lấy mẫu dày (vệ tinh địa tĩnh) + phương pháp tích phân | FRP-04 |
| U-7b | Đối chiếu diện tích cháy | [ESA Fire_cci](https://climate.esa.int/en/projects/fire/) (lưới 0,25° trùng lưới ô) | Bối cảnh diện tích cháy theo ô; không thay `snpp_eq` |
| U-8 | Đơn vị hành chính | Ranh giới chính thức | SP-04 |
| U-9 | Polygon tự do | API POST GeoJSON | SP-03 |
| U-10 | Hiệu chỉnh `M_min` (ứng viên 5 `snpp_eq`/ô-tháng đã có từ tách hiệu chỉnh/đánh giá), AN-03, AN-04, AN-07 | Chạy lùi, không cần dữ liệu mới; chờ Q3 | Nhãn cấp ô; FRP; khu vực mới; duy trì |
| U-11 | Kiểm định lại bất thường trên 1.0 | Không cần dữ liệu mới | Thay số của 1.3 |

## 6. Quyết định cần chốt

| # | Quyết định | Đề xuất | Ai chốt |
|---|---|---|---|
| Q1 | NRT thiếu `type`: loại hay suy từ mặt nạ | Loại cho MVP; suy sau khi kiểm định | Data + Product |
| Q2 | 14.703 detection `type = 0` trong mặt nạ tĩnh | Loại, để nhánh A khớp nhánh B | Data |
| Q3 | Cửa sổ `RECENT` (mốc 2017) | Dùng; Pettitt hỗ trợ cho toàn quốc / Tây Nguyên / Khác | Product + Data |
| Q4 | Phương pháp nhãn: thứ hạng thay p10/p90 | Thứ hạng, α = 0,10, `n ≥ 9` | Data + Backend (gate D03) |
| Q5 | Trả tọa độ detection qua API (đổi `rawDetectionPointsAvailable`) | Trả, kèm nhãn tâm pixel/NRT; xác nhận điều khoản dữ liệu FIRMS | Product + Backend |
| Q6 | Endpoint so sánh hay frontend tự tính | Backend tính (§4 DC) để dùng chung quy tắc | Backend + Frontend |
| Q7 | Mở lại D23 (rank/percentile) | Mở | Product |
| Q8 | Đơn vị so vùng | Mỗi 1.000 km² | Product |
| Q9 | Câu chữ nhãn | “Cao/thấp hơn hầu hết các năm cùng kỳ”; tránh chữ “cảnh báo” | Product |
| Q10 | Định nghĩa năm-mùa theo vùng (TM-06) | Dùng tháng sau tháng thấp nhất; cho cấu hình | Data + Product |
| Q11 | Chế độ mặc định của UI | `OPERATIONAL` cho mọi nhãn; `RETROSPECTIVE` chỉ ở màn lịch sử | Product |
| Q12 | Nhánh frontend làm nền (main đã lùi về 5d00252) | `frontend/explore-sample-ux` | Frontend |

## 7. Lộ trình triển khai: backend đến giao diện

Thứ tự phụ thuộc. Chưa bắt đầu code cho đến khi Giai đoạn 0 xong.

| Giai đoạn | Việc | Tiêu chí xong |
|---|---|---|
| 0. Chốt | Q1 … Q12 vào Decision Log; đóng băng CFG v0.2 | Mọi tham số CFG có `status`; tham số chưa có căn cứ giữ `null` |
| 1. Dữ liệu (Python, offline) | (a) Artifact `events/` gồm raw_detections, observation_groups, clusters, events, data_quality, manifest sha256. (b) Aggregate ô-kỳ nhánh A. (c) `uncertainty-table.json` vào `derived/`. (d) Golden value từ `derived/` cho test vector DC §6. (e) Bảng mùa | Tái lập đúng E1, E2, A1 … A4, C1 … C3; sha256 hợp lệ |
| 2. Backend | Repository đọc artifact mới (lỗi `events/` không làm hỏng nhánh B); service baseline / anomaly / comparison / season / attention đọc CFG; endpoint DC §4; contract test DC §6 | Mọi test vector đạt; OpenAPI có 5 JSON mẫu; build JDK 21 xanh |
| 3. Mock + frontend | Fixture từ backend thật; U1 … U14 theo §3, đủ trạng thái `null` / partial / ước lượng / NRT | Mỗi trạng thái của DC §3.1 có kiểm tra giao diện; không màn nào gọi sự kiện là “đám cháy” |
| 4. Kiểm định | U-10, U-11; độ nhạy bộ lọc FRP 0/5/10; tách hiệu chỉnh 2003–2016 và đánh giá 2017–2025 | CFG v0.3 có số đã hiệu chỉnh hoặc vẫn `null` kèm lý do |
| 5. Nâng cấp | U-1 → U-2 → U-3 → U-5 → U-6 | Theo từng mục |

## 8. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Người dùng đọc “thấp” thành “an toàn” | Luôn kèm `NO_CLOUD_INFORMATION`; Q9 |
| Đọc sự kiện / detection như đám cháy | Câu chữ cố định; danh sách cấm P01 … P12 dùng làm checklist review |
| Chọn cửa sổ để “ra kết quả đẹp” | Luôn hiển thị hai cửa sổ; phiên bản hóa CFG |
| Hai nhánh mâu thuẫn ở cùng vị trí | Q2; không đặt hai nhánh chung một trục |
| Kết quả đổi khi archive thay NRT | DC §7: phiên bản và lịch sử đánh giá |
| Snapshot cũ | Thanh độ mới; U-1 |
