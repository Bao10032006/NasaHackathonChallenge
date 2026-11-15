"""Generates Phần VI (rule contracts) of QUY_TAC_PHAN_TICH_BAT_THUONG_VA_SO_SANH.md and splices it in."""
import re
import sys

FIELDS = [
    ('name', 'Tên và mục đích'), ('unit', 'Đơn vị phân tích'), ('input', 'Dữ liệu đầu vào'), ('filter', 'Bộ lọc'),
    ('formula', 'Công thức / pseudocode'), ('baseline', 'Baseline'), ('threshold', 'Ngưỡng và nguồn gốc'),
    ('minN', 'Số mẫu tối thiểu'), ('sufficient', 'Điều kiện đủ dữ liệu'), ('missing', 'Thiếu dữ liệu và trường hợp biên'),
    ('output', 'Đầu ra'), ('certainty', 'Mức độ chắc chắn và hạn chế'), ('conclude', 'Được / không được kết luận'),
    ('ui', 'Câu diễn giải UI'), ('example', 'Ví dụ số'), ('validation', 'Cách kiểm định'), ('status', 'Trạng thái'),
]

PA = 'Tệp điểm v1.6 (`HoaLich_v1.6_points_clean.csv.gz`)'
PB = 'Snapshot 1.0 `derived/` (`daily-values.f32`, `daily-source.u8`, `daily-input-count.i16`)'
NOBL = 'Không dùng baseline (chỉ số mô tả)'
NOTH = 'Không có ngưỡng (chỉ số mô tả)'
SPLIT = 'Tách hiệu chỉnh 2003–2016 / đánh giá 2017–2025'

R = []

def rule(rid, **kw):
    missing = [k for k, _ in FIELDS if k not in kw]
    assert not missing, (rid, missing)
    R.append((rid, kw))

# ---------------- Nhánh A ----------------
rule('EV-01',
     name='Bộ lọc detection cho lớp sự kiện: chọn detection “cháy thực vật đạt bộ lọc FRP ≥ 5 MW” theo [quy tắc gốc](../QUY_TAC_NHAN_DIEN_SU_KIEN_CHAY.md) §1.',
     unit='Detection', input=PA + '; trường `type`, `conf`, `conf_modis`, `frp`, `sat`.',
     filter='MODIS: `type = 0` VÀ `conf_modis ≥ 30` VÀ `frp ≥ 5`. VIIRS: `type = 0` VÀ `conf ∈ {n, h}` VÀ `frp ≥ 5`.',
     formula='`passed = type == 0 and frp >= 5 and (conf_modis >= 30 if MODIS else conf in {n,h})`. Ghi **mọi** lý do không đạt vào `filterReasons[]`; không xóa bản ghi.',
     baseline=NOBL,
     threshold='FRP 5 MW: tiền lệ [Afi và cộng sự 2026](https://jurnal.polibatam.ac.id/index.php/JAIC/article/download/12686/3628) (Riau, không xác minh thực địa). Confidence: [MODIS User Guide](https://modis-fire.umd.edu/files/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf), [VIIRS User Guide](https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf). Tổ hợp là lựa chọn dự án.',
     minN='Không áp dụng', sufficient='Có đủ `type`, confidence, FRP cho detection.',
     missing='`type` thiếu (toàn bộ NRT) → `typeStatus = MISSING`, không đạt (trừ khi Q1 chọn suy từ mặt nạ). FRP thiếu → `NOT_EVALUATED` (hiện 0 trường hợp). Không điền 0.',
     output='`filterPassed`, `filterReasons[]`, `typeStatus`.',
     certainty='Bộ lọc không xác nhận cháy. Tác động khác nhau theo cảm biến (FRP-05).',
     conclude='Được: “detection đạt bộ lọc của dự án”. Không được: gọi là cháy rừng, cháy đã xác nhận (P02).',
     ui='“Điểm phát hiện đạt bộ lọc của dự án (type 0, confidence, FRP ≥ 5 MW). Không phải đám cháy đã xác nhận.”',
     example='1.161.304 / 2.150.162 đạt. Không đạt: FRP < 5: 880.394; confidence thấp: 160.859; `type = 2`: 57.294; `type` thiếu: 22.157.',
     validation='Độ nhạy FRP 0/5/10 MW với số sự kiện; đối chiếu tập cháy đã xác minh (cần dữ liệu).',
     status='Dùng ngay (archive); NRT chờ Q1.')

rule('EV-02',
     name='Nhóm quan sát: đại diện cho một lượt bay của một vệ tinh để gom cụm.',
     unit='Nhóm (vệ tinh × cửa sổ thời gian)', input=PA + '; `sat`, `dt`.', filter='Detection đạt EV-01.',
     formula='Sắp theo `observedUtc` trong từng vệ tinh. `if t − t_start_of_group > W: open new group`.',
     baseline=NOBL, threshold='`W = 10` phút: lựa chọn dự án vì FIRMS không có mã granule.', minN='Không áp dụng',
     sufficient='Có `observedUtc` đến phút.', missing='Không có mã lượt bay → `groupingMethod = TIME_WINDOW_PROXY`. Lượt bay dài hơn W bị tách.',
     output='`groupId`, `startUtc`, `endUtc`, `detectionCount`.', certainty='Gần đúng; không bảo đảm đúng lượt bay.',
     conclude='Được: số nhóm quan sát có phát hiện. Không được: coi nhóm là lượt bay đã xác thực.',
     ui='“Nhóm quan sát: các phát hiện cùng vệ tinh trong ≤ 10 phút (ước lượng lượt bay).”',
     example='Kích thước nhóm: p50 = 137, p90 = 901, max = 5.729 detection. S-NPP ngày 05/03/2024 có 4 nhóm (05:19, 06:59 UTC ban ngày; 17:50, 19:30 UTC ban đêm).',
     validation='So với mã granule khi có (U-4). Độ nhạy 5/10/20 phút: 53.781 / 52.749 / 51.302 sự kiện (2024).',
     status='Dùng ngay.')

rule('EV-03',
     name='Cụm phát hiện: gom detection gần nhau trong một nhóm quan sát.',
     unit='Cụm', input='Nhóm từ EV-02.', filter='Detection đạt EV-01.',
     formula='DBSCAN(eps, `min_samples = 1`, Haversine), tương đương thành phần liên thông của đồ thị “khoảng cách ≤ eps”. Hiện thực bằng lưới băm 0,01° + union-find.',
     baseline=NOBL, threshold='eps = 1 km: lựa chọn dự án, cấu hình **thử nghiệm**; không phải ngưỡng xác nhận cùng đám cháy.', minN='1 detection',
     sufficient='Tọa độ hợp lệ.', missing='Cụm 1 điểm vẫn giữ (`detectionCount = 1`).',
     output='`clusterId`, `groupId`, `detectionCount`.',
     certainty='1 km là khoảng nối, không phải bán kính; cụm có thể dài nhiều km. Pixel MODIS > 1 km có thể bị tách.',
     conclude='Được: số cụm theo cấu hình. Không được: gọi cụm là một đám cháy.',
     ui='“Cụm phát hiện: các điểm cách nhau ≤ 1 km trong cùng lượt quan sát (cấu hình thử nghiệm).”',
     example='800.554 cụm (mọi năm); 75,3% có 1 detection.',
     validation='Độ nhạy eps 0,5/1/2 km: 64.807 / 52.749 / 43.307 sự kiện (2024).', status='Dùng ngay.')

rule('EV-04',
     name='Liên kết cụm thành sự kiện cháy ước tính.',
     unit='Sự kiện', input='Cụm từ EV-03, theo thời gian.', filter='Như EV-01.',
     formula='Duyệt cụm theo thời gian. Ứng viên là sự kiện có `t − lastObserved ≤ G` và có detection của **cụm gần nhất** cách ≤ D. 1 ứng viên → gắn vào. 0 → tạo mới. ≥ 2 → `AMBIGUOUS`, tạo ID riêng, không gộp.',
     baseline=NOBL, threshold='G = 24 giờ; D = 1 km: lựa chọn dự án, thử nghiệm. `L_max` (chuỗi dài) = `null`.', minN='1 cụm',
     sufficient='Ngày nằm trong `eventDataThrough` của vệ tinh.',
     missing='Mất quan sát giữa hai lần → sự kiện có thể bị tách; không kết luận cháy đã tắt. Sự kiện cắt ngang `eventDataThrough` → cờ `CROSSES_EVENT_DATA_THROUGH`.',
     output='`eventId`, `linkStatus`, `firstObservedUtc`, `lastObservedUtc`, `observedSpanHours`, `detectionCount`, `satellites[]`, `flags[]`.',
     certainty='Mây làm tách sự kiện; cháy gần nhau bị gộp; 616 chuỗi > 7 ngày (đa số là nguồn nhiệt lặp tại chỗ).',
     conclude='Được: “X sự kiện ước tính theo `experimental_v1`, Y cụm chưa rõ”. Không được: gọi là X đám cháy; gọi lần đầu/cuối là lúc bắt đầu/tắt.',
     ui='“Sự kiện cháy ước tính: cụm phát hiện nối nhau trong ≤ 24 giờ và ≤ 1 km. Không phải đám cháy đã xác nhận.”',
     example='706.206 sự kiện; 8.298 cụm `AMBIGUOUS` (1,04%); 70,0% có 1 detection; 88,9% chỉ được quan sát 1 lần. Ví dụ ô 55_429 ngày 01/03/2024: 5 detection, 3 vệ tinh, trong 51 phút.',
     validation='Độ nhạy G 12/24/48 giờ: 53.777 / 52.749 / 50.860 sự kiện (2024). Rà thủ công chuỗi dài. Đối chiếu cháy đã xác minh (cần dữ liệu).',
     status='Dùng ngay; `L_max` cần kiểm định.')

rule('EV-05',
     name='Chuỗi sự kiện một vệ tinh: chỉ số sự kiện duy nhất được so qua nhiều năm.',
     unit='Vùng × năm/tháng', input='EV-01 … EV-04 chạy riêng cho **một** vệ tinh.', filter='EV-01 + `dayNight = D`.',
     formula='`count(events where satellite == S and day)` cho mỗi kỳ; kèm `events per 1000 snpp_eq`.',
     baseline='Các năm của cùng vệ tinh (S-NPP 2012–2025; Aqua đến 2021).',
     threshold='Không có ngưỡng nhãn. Hệ số NOAA-20/S-NPP = 1,054 (trung vị 2019–2025) chỉ là mô tả, `applied = false`.',
     minN='Năm đủ 12 tháng của vệ tinh đó', sufficient='Vệ tinh hoạt động suốt kỳ; kỳ không vượt `eventDataThrough`.',
     missing='Năm thiếu hoặc partial → không vẽ cột, ghi lý do. Aqua từ 2022 → cảnh báo `AQUA_FALLBACK_AFTER_ORBIT_DRIFT`.',
     output='`period`, `eventCount`, `eventCountStatus`, `snppEq`, `eventsPer1000SnppEq`.',
     certainty='Ổn định nội bộ (274–316 sự kiện / 1.000 `snpp_eq`); chưa kiểm chứng độc lập.',
     conclude='Được: so số sự kiện S-NPP giữa 2012 và 2025. Không được: so sự kiện đa vệ tinh giữa các năm (2011 → 2012 là ×2,80, trong khi `snpp_eq` chỉ ×1,14).',
     ui='“Số sự kiện ước tính chỉ từ S-NPP, ban ngày, để so sánh được giữa các năm.”',
     example='S-NPP: 2012 = 20.646; 2016 = 22.528; 2017 = 12.814; 2024 = 15.688; 2025 = 11.723.',
     validation='Tỉ số với `snpp_eq` ổn định theo năm; kiểm định hệ số nối NOAA-20.', status='Dùng ngay (S-NPP).')

rule('AC-01',
     name='Đếm detection thô và detection đạt từng bộ lọc.',
     unit='Ô, vùng, điểm/polygon × kỳ', input=PA, filter='Không lọc (thô); đếm riêng theo EV-01.',
     formula='`count` theo `satellite × dayNight × src`; với bộ lọc: đếm từng `filterReason`.',
     baseline=NOBL, threshold=NOTH, minN='Không áp dụng', sufficient='Có detection hoặc biết trạng thái quan sát.',
     missing='0 detection + `OBSERVED_NO_KNOWN_GAP` → `AVAILABLE 0` kèm `NO_CLOUD_INFORMATION`. Vệ tinh `OUTAGE` → `MISSING`.',
     output='`detectionsBySatDnSrc{}`, `filterReasonCounts{}`.',
     certainty='Đếm chính xác pixel; không phải đám cháy.',
     conclude='Được: so trong cùng vệ tinh và cùng kỳ. Không được: xu hướng dài hạn khi số vệ tinh đổi (P06).',
     ui='“Số pixel được phát hiện theo từng vệ tinh; không phải số đám cháy.”',
     example='Tây Bắc 05/03/2024, ban ngày: Terra 28, Aqua 78, S-NPP 513, NOAA-20 472, NOAA-21 394; 889 đạt bộ lọc EV-01.',
     validation='Đối chiếu tổng với nhật ký v1.6 (S-NPP 2024 ban ngày ngoài mặt nạ = 50.991 ở cả hai nguồn).', status='Dùng ngay.')

rule('AC-02',
     name='Số ngày có phát hiện: tách tần suất khỏi cường độ.',
     unit='Vùng × kỳ, theo một vệ tinh', input=PA, filter='Lõi (ngoài mặt nạ tĩnh, ban ngày) hoặc EV-01, ghi rõ.',
     formula='`count(distinct localDate where detections ≥ 1)`.',
     baseline='Cùng kỳ các năm của cùng vệ tinh (khi so).', threshold=NOTH, minN='Kỳ đủ ngày',
     sufficient='Biết ngày `OUTAGE` của vệ tinh.', missing='Ngày `OUTAGE` bị loại khỏi mẫu số; trả `observedDays`.',
     output='`detectionDays`, `observedDays`.',
     certainty='Phụ thuộc mây và tần suất lượt bay.',
     conclude='Được: “tăng số detection nhưng không tăng số ngày”. Không được: so giữa các vệ tinh.',
     ui='“Số ngày có ít nhất một phát hiện (một vệ tinh).”',
     example='S-NPP Tây Nguyên 2013: detection +27,2% nhưng số ngày +0,0% (288 ngày).',
     validation='Kiểm tra với lịch mất dữ liệu.', status='Dùng ngay.')

rule('AC-03',
     name='Số nhóm quan sát có phát hiện.',
     unit='Vùng × kỳ, theo vệ tinh', input='EV-02', filter='Như AC-02',
     formula='`count(groups with ≥ 1 detection in area)`.', baseline=NOBL, threshold=NOTH, minN='Không áp dụng',
     sufficient='Như AC-02.', missing='Như AC-02.', output='`groupCount`.', certainty='Phụ thuộc EV-02 (gần đúng).',
     conclude='Được: so trong cùng vệ tinh. Không được: gọi là số lượt bay.',
     ui='“Số lượt quan sát (ước lượng) có phát hiện.”',
     example='S-NPP ngày 05/03/2024: 4 nhóm (2 ban ngày, 2 ban đêm).', validation='So với mã granule (U-4).', status='Dùng ngay.')

rule('FRP-01',
     name='FRP lớn nhất của kỳ, kèm thời điểm, vệ tinh, confidence.',
     unit='Vùng × kỳ × vệ tinh', input=PA + '; `frp`.', filter='Theo nhánh A đang chọn.',
     formula='`argmax(frp)` trong từng vệ tinh × D/N.', baseline=NOBL, threshold=NOTH, minN='1 detection',
     sufficient='FRP không thiếu.', missing='Không có detection → `null`, không phải 0.',
     output='`valueMw`, `satellite`, `observedUtc`, `confidence`, `dayNight`.',
     certainty='FRP là công suất **tức thời** của pixel; phụ thuộc góc nhìn và kích thước pixel.',
     conclude='Được: “pixel có FRP lớn nhất là …”. Không được: so giá trị MODIS với VIIRS; gọi là cường độ đám cháy.',
     ui='“FRP: công suất bức xạ tức thời của pixel (MW) lúc vệ tinh quan sát.”',
     example='Tây Bắc 05/03/2024: 561,8 MW, Aqua, 06:31 UTC, confidence `h`.',
     validation='Kiểm tra trùng với giá trị gốc.', status='Dùng ngay.')

rule('FRP-02',
     name='Phân vị FRP theo vệ tinh × ngày/đêm.',
     unit='Vùng × kỳ × vệ tinh × D/N', input=PA, filter='Ngoài mặt nạ tĩnh (hoặc EV-01, ghi rõ).',
     formula='`quantile(frp, [0.5, 0.9, 0.99])`, **không gộp** cảm biến.', baseline=NOBL, threshold=NOTH,
     minN='Số detection tối thiểu để báo p99: `null` (chưa chốt); trả `n` kèm theo',
     sufficient='n đủ cho phân vị (trả `n`).', missing='n nhỏ → chỉ trả trung vị và `n`.',
     output='`p50`, `p90`, `p99`, `n`.', certainty='Phân bố lệch phải; phụ thuộc cảm biến.',
     conclude='Được: so trong cùng vệ tinh, cùng D/N. Không được: so S-NPP với Aqua.',
     ui='“Phân bố FRP của từng vệ tinh; không so giữa vệ tinh vì kích thước pixel khác nhau.”',
     example='Ngoài mặt nạ: S-NPP D 5,5 / 16,7 / 64,7 MW; Aqua D 17,1 / 62,2 / 221,0 MW; S-NPP N 1,2 / 3,7 / 12,9 MW.',
     validation='Ổn định theo năm của cùng vệ tinh.', status='Dùng ngay.')

rule('FRP-03',
     name='Tổng FRP của một nhóm quan sát (MW tức thời).',
     unit='Nhóm quan sát', input='EV-02', filter='Một vệ tinh, một nhóm.',
     formula='`sum(frp)` trong nhóm sau khi loại trùng do chồng pixel ở mép quét. Quy tắc loại trùng = `null`.',
     baseline=NOBL, threshold='Không có', minN='1 detection', sufficient='Nhóm hoàn chỉnh.',
     missing='Chưa loại trùng → cờ `FRP_SUM_NOT_DEDUPLICATED`.',
     output='`frpSumMw`, `deduplicated`.', certainty='Thấp cho tới khi có quy tắc loại trùng.',
     conclude='Được: tổng tức thời của một lượt. Không được: cộng qua nhiều lượt và gọi là năng lượng (P04).',
     ui='“Tổng FRP tức thời trong một lượt quan sát (chưa loại trùng).”',
     example='S-NPP 05/03/2024 toàn quốc: nhóm 05:19 UTC 311 detection, tổng 4.050,2 MW; nhóm 06:59 UTC 568 detection, 6.173,2 MW (chưa loại trùng).',
     validation='Kiểm tra pixel chồng ở mép quét MODIS/VIIRS.', status='Cần tính thêm.')

rule('FRP-04',
     name='FRE (năng lượng bức xạ).',
     unit='Sự kiện hoặc vùng × kỳ', input='Chuỗi FRP dày theo thời gian', filter='—',
     formula='`FRE = ∫ FRP dt` với lấy mẫu đủ dày ([Wooster và cộng sự 2005](https://doi.org/10.1029/2005JD006318)).',
     baseline=NOBL, threshold='—', minN='—', sufficient='Không có với vệ tinh cực quỹ đạo (vài lượt/ngày, mây).',
     missing='Luôn trả `NOT_AVAILABLE`.', output='—', certainty='—',
     conclude='Không được tính hay gọi tên FRE với dữ liệu hiện có.', ui='Không hiển thị.', example='Không áp dụng.',
     validation='Cần dữ liệu địa tĩnh.', status='Cần dữ liệu.')

rule('FRP-05',
     name='Tỉ lệ detection đạt FRP ≥ 5 MW.',
     unit='Vùng × kỳ × vệ tinh', input=PA, filter='Lõi hoặc toàn bộ, ghi rõ.',
     formula='`count(frp ≥ 5) / count(all)`.', baseline='Cùng vệ tinh các năm (khi so).', threshold='5 MW (EV-01).',
     minN='Không áp dụng', sufficient='FRP đủ.', missing='FRP thiếu → loại khỏi mẫu số, đếm riêng.',
     output='`share`, `n`.', certainty='Phản ánh cảm biến nhiều hơn hoạt động cháy.',
     conclude='Được: giải thích vì sao bộ lọc đổi xu hướng. Không được: so tỉ lệ MODIS với VIIRS như chất lượng cháy.',
     ui='“Phần trăm điểm có FRP ≥ 5 MW; khác nhau mạnh giữa MODIS và VIIRS.”',
     example='Aqua 98,1%; Terra 95,5%; S-NPP 48,8%; NOAA-20 46,9%; NOAA-21 56,5%. S-NPP ban ngày: 0,577 (2012) → 0,512 (2025).',
     validation='Theo năm và vệ tinh.', status='Dùng ngay.')

rule('BT-01',
     name='Phân bố brightness theo vệ tinh × ngày/đêm.',
     unit='Vùng × kỳ × vệ tinh × D/N', input=PA + '; `bright` (kênh ~4 µm), `bright31` (~11 µm).', filter='Như FRP-02.',
     formula='Phân vị; gắn `NOT_EVALUATED` nếu `< 250 K`; `AT_SENSOR_CEILING` nếu `= 367 K` (VIIRS).',
     baseline=NOBL, threshold='250 K và 367 K: đo từ dữ liệu (nhật ký v1.6).', minN='Không áp dụng',
     sufficient='Có brightness.', missing='Giá trị hỏng/trần → loại khỏi phân vị, đếm riêng.',
     output='`p05`, `p50`, `p95`, `invalidCount`, `ceilingCount`.',
     certainty='Kênh MODIS và VIIRS khác nhau; không phải nhiệt độ ngọn lửa.',
     conclude='Được: so trong cùng vệ tinh. Không được: so MODIS với VIIRS (P05).',
     ui='“Nhiệt độ sáng của kênh đo (K), không phải nhiệt độ ngọn lửa.”',
     example='p50 ban ngày: S-NPP 337,3 K; Aqua 321,3 K (khác kênh). 468 điểm VIIRS < 250 K (FRP trung vị 95,4 MW). 7,45% điểm VIIRS đạt EV-01 ở trần 367 K.',
     validation='Theo cảm biến.', status='Dùng ngay.')

rule('BT-02',
     name='Cờ vượt ngưỡng brightness tuyệt đối (mô tả).',
     unit='Detection', input=PA, filter='—',
     formula='MODIS D > 360 K; MODIS N > 320 K; VIIRS N > 320 K (chỉ phần nhiệt độ); VIIRS D: không ngưỡng.',
     baseline=NOBL,
     threshold='[Giglio và cộng sự 2016](https://doi.org/10.1016/j.rse.2016.02.054); [Schroeder và cộng sự 2014](https://doi.org/10.1016/j.rse.2013.12.008). Là nhánh trong thuật toán, không tái hiện toàn bộ thuật toán.',
     minN='Không áp dụng', sufficient='Biết D/N và brightness hợp lệ.',
     missing='Thiếu `QF_I4` (VIIRS) → chỉ “phần nhiệt độ”. Giá trị hỏng → `NOT_EVALUATED`.',
     output='`brightnessFlag`.',
     certainty='Không vượt ngưỡng vẫn có thể là lửa (kiểm tra nền lân cận).',
     conclude='Không được dùng làm bộ lọc xác nhận cháy.', ui='“Cờ nhiệt bổ sung, không bắt buộc.”',
     example='Tập đạt EV-01: vượt MODIS 10.277; VIIRS đêm chỉ phần nhiệt 9.613; không vượt 388.045; VIIRS ngày không ngưỡng 753.369.',
     validation='—', status='Dùng ngay.')

rule('SPC-01',
     name='Số ô có hoạt động.',
     unit='Vùng × kỳ', input=PA, filter='Một vệ tinh; lõi hoặc EV-01.',
     formula='`count(distinct cellId with detections ≥ 1)`.', baseline='Cùng kỳ các năm của cùng vệ tinh.', threshold=NOTH,
     minN='Không áp dụng', sufficient='Như AC-02.',
     missing='Không dùng “ô có `snpp_eq` > 0”, vì mô hình rải giá trị (S9).',
     output='`activeCells`, `totalCells`.', certainty='Không phải diện tích cháy.',
     conclude='Được: so phạm vi không gian giữa các năm cùng vệ tinh. Không được: gọi là diện tích cháy.',
     ui='“Số ô 0,25° có ít nhất một phát hiện (một vệ tinh).”',
     example='S-NPP: 2016 có 541 ô; 2017 có 525; 2024 có 547; 2025 có 538.',
     validation='—', status='Dùng ngay.')

rule('SPC-02',
     name='Mức tập trung không gian.',
     unit='Vùng × năm', input=PB, filter='Nhánh B.',
     formula='Phần tổng `snpp_eq` năm nằm trong 10% ô cao nhất.', baseline='Các năm khác (khi so).', threshold=NOTH,
     minN='Năm đủ', sufficient='Năm đủ ngày.', missing='Năm partial → không so.', output='`top10Share`.',
     certainty='Mô tả.', conclude='Được: “hoạt động tập trung hơn/ít hơn”. Không được: suy nguyên nhân.',
     ui='“Phần hoạt động nằm trong 10% ô cao nhất.”',
     example='2005: 43,9%; 2015: 41,4%; 2024: 43,4%; 2025: 43,3%.', validation='—', status='Dùng ngay.')

rule('SPC-03',
     name='Thay đổi phân bố không gian giữa hai kỳ.',
     unit='Hai kỳ, cùng tập ô', input=PB, filter='Nhánh B.',
     formula='`TV = ½ Σ_c |s_A(c) − s_B(c)|`, với `s(c)` là tỉ phần của ô trong tổng.', baseline='Phân bố TV của các cặp năm liền nhau (bối cảnh).',
     threshold='Không có ngưỡng; `null`.', minN='Hai kỳ đủ', sufficient='Cùng tập ô, cùng độ dài kỳ.',
     missing='Tổng = 0 → `null`.', output='`tv` (0–1).', certainty='Mô tả.',
     conclude='Được: “phân bố đổi nhiều hơn/ít hơn thường gặp”. Không được: gọi là dịch chuyển đám cháy.',
     ui='“Mức khác nhau của phân bố không gian (0 = giống hệt, 1 = không trùng).”',
     example='2016 → 2017: 0,178; 2024 → 2025: 0,183; 2005 → 2024: 0,339; các cặp năm liền nhau 2012–2025: trung vị 0,167, tối đa 0,217.',
     validation='—', status='Dùng ngay.')

# ---------------- Nhánh B: bất thường ----------------
rule('AN-01',
     name='Hoạt động cao hơn hầu hết các năm cùng kỳ (HIGH).',
     unit='Toàn quốc, 5 vùng (ô/khung chờ `M_min`) × pentad/tháng/năm-mùa/năm/YTD/7 ngày',
     input=PB + '; khoảng 90% (`uncertainty_table.csv`) cho mã nguồn 2.',
     filter='Nhánh B (ban ngày, ngoài mặt nạ tĩnh, mọi confidence, không lọc FRP).',
     formula='`X` = tổng kỳ; `R` theo BL-*; `j = floor(α(n+1))`; `j < 1 → INSUFFICIENT_BASELINE`; `X >` giá trị lớn thứ j → HIGH; mã 2: HIGH nếu `lo90 >` ngưỡng, ngược lại `POSSIBLY_HIGH`.',
     baseline='BL-* theo cấp; `FULL` 2003–2025 và `RECENT` 2017–2025; chế độ `OPERATIONAL` (năm < y) cho mức chú ý.',
     threshold='α = 0,10: đề xuất, chưa hiệu chỉnh theo người dùng. Không dùng p90 nội suy (QT Phần V).',
     minN='n ≥ 9 (hệ quả của α)', sufficient='Kỳ đích đủ ngày (hoặc cùng khoảng ngày); mỗi năm tham chiếu đủ ngày (BL §4.2).',
     missing='Năm thiếu/partial/mã 1 bị loại khỏi `R`. Cấp ngày lẻ → `NOT_ASSESSED`.',
     output='`classification`, `j`, `lowCut`, `highCut`, `n`, `median`, `delta`, `deltaPct`, `percentile`, `rank`, `mode`, `window`, `attentionLevel`.',
     certainty='Khoảng α kỳ bình thường vẫn mang nhãn; cửa sổ ảnh hưởng mạnh; không có mây.',
     conclude='Được: “cao hơn hầu hết các năm cùng kỳ”. Không được: “có cháy nguy hiểm”, “xác suất cháy 90%”.',
     ui='“Cao hơn hầu hết các năm cùng kỳ (2003–2025): hạng 1/24. Nhãn thống kê, không phải xác nhận cháy.”',
     example='Toàn quốc 10/2026 (vận hành): X = 2.614,3; median 837,0; ngưỡng cao 1.665,5; hạng 1/24 → HIGH; `RECENT` cũng HIGH (median 996,0) → mức 2.',
     validation='Mô phỏng hoán đổi được (P(HIGH) = 8,6% với n = 22); chạy lùi vận hành (bảng 4.3); ' + SPLIT + ' (Phần VIII).',
     status='Dùng ngay (vùng).')

rule('AN-02',
     name='Hoạt động thấp hơn hầu hết các năm cùng kỳ (LOW).',
     unit='Như AN-01', input='Như AN-01', filter='Như AN-01',
     formula='`X <` giá trị nhỏ thứ j → LOW; mã 2: LOW nếu `hi90 <` ngưỡng, ngược lại `POSSIBLY_LOW`.',
     baseline='Như AN-01', threshold='Như AN-01', minN='n ≥ 9', sufficient='Như AN-01', missing='Như AN-01',
     output='Như AN-01',
     certainty='Có thể do mây che, không quan sát được; điểm gãy 2017 làm năm gần đây lệch về LOW với `FULL`.',
     conclude='Được: “thấp hơn hầu hết các năm”. Không được: “an toàn”, “không cháy”.',
     ui='“Thấp hơn hầu hết các năm cùng kỳ. Không có dữ liệu mây; mức thấp có thể do không quan sát được.”',
     example='Tây Nguyên 03/2024: vận hành (2003–2023, n = 21, ngưỡng thấp 5.073,0) → LOW; hồi cứu (2003–2025 trừ 2024, n = 22, ngưỡng thấp 3.875,0) → TYPICAL. Toàn quốc 03/2026: `FULL` LOW, `RECENT` TYPICAL.',
     validation='Như AN-01.', status='Dùng ngay (vùng).')

rule('AN-03',
     name='FRP cao bất thường trong nhóm quan sát tương đồng.',
     unit='Detection', input=PA, filter='Ngoài mặt nạ tĩnh; cùng vệ tinh × D/N × vùng × tháng.',
     formula='`flag if frp > Q_q(group, years < y)`; luôn kèm confidence; `conf = l` → `LOW_CONFIDENCE_HIGH_FRP`.',
     baseline='Phân bố FRP của cùng nhóm ở các năm trước (vận hành).',
     threshold='q = `null` (chưa hiệu chỉnh).', minN='Số detection nền tối thiểu = `null` (chưa chốt)',
     sufficient='Nhóm có lịch sử đủ.', missing='Nhóm mới hoặc lịch sử ít → `INSUFFICIENT_BASELINE`.',
     output='`frpPercentileInGroup`, `flag`, `confidence`.',
     certainty='FRP phụ thuộc góc nhìn, kích thước pixel; nhiều detection mỗi ngày → cần kiểm soát so sánh bội.',
     conclude='Được: “FRP cao hơn hầu hết detection cùng nhóm”. Không được: “đám cháy lớn bất thường”.',
     ui='“Pixel có FRP cao so với các phát hiện cùng vệ tinh, cùng vùng, cùng tháng các năm trước.”',
     example='S-NPP ban ngày, Tây Nguyên, tháng 3, nền 2012–2023 (n = 97.950): p99 = 93,6 MW; p99,9 = 223,6 MW; 2024 có 0,21% vượt p99. Một detection 11/03/2013: 952,9 MW nhưng `conf = l`, 367 K.',
     validation='Tỉ lệ cờ theo năm; ổn định theo vệ tinh.', status='Cần tính thêm.')

rule('AN-04',
     name='Phát hiện tại khu vực hiếm có lịch sử.',
     unit='Detection hoặc ô lưới g°', input=PA, filter='Một vệ tinh; lõi.',
     formula='`new = gridCell(lat, lon, g) not in {grid cells with detections of same satellite in years < y}`.',
     baseline='Mọi năm trước của cùng vệ tinh.', threshold='g = `null`.', minN='Số năm lịch sử tối thiểu: `null` (chưa chốt)',
     sufficient='Vệ tinh có lịch sử.', missing='Vệ tinh mới (NOAA-21 từ 2023) → `INSUFFICIENT_BASELINE`.',
     output='`isNewLocation`, `gridDeg`.',
     certainty='Phụ thuộc mạnh vào g; sai số vị trí pixel; thay đổi sử dụng đất.',
     conclude='Được: “chưa từng có phát hiện ở ô lưới này (vệ tinh X)”. Không được: “cháy mới / cháy rừng mới”.',
     ui='“Vị trí chưa từng có phát hiện của vệ tinh này trong các năm trước.”',
     example='S-NPP ban ngày 2024 so với 2012–2023: lưới 0,01° → 8,2% detection ở ô mới; lưới 0,05° → 0,1%.',
     validation='Độ nhạy theo g; rà mẫu.', status='Cần tính thêm.')

rule('AN-05',
     name='Thời điểm và độ dài mùa hoạt động.',
     unit='Vùng × năm-mùa', input=PB, filter='Nhánh B.',
     formula='Trong năm-mùa (TM-06): `onset`/`center`/`end` = ngày tỉ phần tích lũy đạt 10% / 50% / 90%; `duration = end − onset + 1`; `max30Share`. So bằng AN-01/02 với các mùa trước.',
     baseline='BL-SEASON (các mùa trước; hồi cứu hoặc vận hành).', threshold='10/50/90% và 30 ngày: lựa chọn dự án; α như AN-01.',
     minN='n ≥ 9 mùa', sufficient='Năm-mùa trọn vẹn.', missing='Mùa đang diễn ra → không tính `end`; mùa có tổng rất nhỏ → cờ `SEASON_METRICS_SENSITIVE_WHEN_TOTAL_LOW`.',
     output='`onset`, `center`, `end`, `duration`, `max30Share`, nhãn từng chỉ số.',
     certainty='Mùa “dài” có thể chỉ là mùa “dẹt” khi tổng thấp.',
     conclude='Được: “mốc 90% đến muộn hơn hầu hết các mùa”. Không được: “mùa cháy bắt đầu ngày …”.',
     ui='“Ngày đạt 10% / 50% / 90% hoạt động của năm-mùa; không phải ngày bắt đầu/kết thúc mùa cháy thực tế.”',
     example='Tây Nguyên 2024-2025 so với 21 mùa trước: tổng 11.669,9 (median 27.561,9) → LOW; đỉnh 19/03 → TYPICAL; mốc 90% 02/08 → muộn (HIGH); độ dài 191 ngày → HIGH; `max30Share` 0,282 → LOW.',
     validation='Độ lệch chuẩn giữa các năm: Tây Nguyên `center` ±4,5 ngày; ' + SPLIT + '.', status='Dùng ngay.')

rule('AN-06',
     name='Thay đổi kéo dài / chuyển chế độ.',
     unit='Vùng × chuỗi năm (hoặc cùng tháng qua năm)', input=PB, filter='Nhánh B.',
     formula='Kiểm định [Pettitt](https://doi.org/10.2307/2346729) tìm điểm gãy; độ dốc [Theil–Sen](https://doi.org/10.1080/01621459.1968.10480934) trước và sau; Mann–Kendall hiệu chỉnh tự tương quan ([Hamed & Rao 1998](https://doi.org/10.1016/S0022-1694(97)00125-X)).',
     baseline='Toàn chuỗi 2003–2025.', threshold='p < 0,05 để báo “điểm gãy rõ”: quy ước thống kê, không phải ngưỡng cháy.',
     minN='≥ 10 năm', sufficient='Năm đủ.', missing='Năm partial bị loại.',
     output='`changeYear`, `pApprox`, `slopeBefore`, `slopeAfter`.', certainty='Hồi cứu; giả định độc lập; p xấp xỉ.',
     conclude='Được: “chuỗi có điểm gãy quanh 2017”. Không được: nêu nguyên nhân.',
     ui='“Từ 2017 mức hoạt động ở mức thấp hơn rõ rệt so với trước (kiểm định Pettitt).”',
     example='Toàn quốc: gãy từ 2017 (p ≈ 0,001). Theil–Sen 2003–2025: −2.264/năm; 2017–2025: −1.027/năm.',
     validation='So nhiều vùng; kiểm tra cùng điểm gãy ở từng cảm biến thô.', status='Dùng ngay (hồi cứu).')

rule('AN-07',
     name='Duy trì: hoạt động cao kéo dài.',
     unit='Vùng × chuỗi kỳ', input='AN-01', filter='Như AN-01',
     formula='`level3 if count(level2 in last m periods) ≥ k`.', baseline='Như AN-01', threshold='k, m = `null`.',
     minN='m kỳ', sufficient='m kỳ liên tiếp đều được đánh giá.', missing='Kỳ không đánh giá được → ngắt chuỗi.',
     output='`attentionLevel = 3`.', certainty='Chưa hiệu chỉnh.', conclude='Chưa dùng để kết luận.',
     ui='Chưa hiển thị.', example='Chưa có (chưa chọn k, m).', validation='Chạy lùi chọn k, m.', status='Cần tính thêm.')

# ---------------- Chất lượng dữ liệu ----------------
rule('DQ-01',
     name='Mất quan sát (bất thường dữ liệu, không phải bất thường cháy).',
     unit='Vệ tinh × ngày × dải vĩ độ', input='`data_gaps.csv` (123 đợt).', filter='—',
     formula='`status = OUTAGE if date in gap(satellite, band)`.', baseline='Thống kê lượt bay (pipeline).',
     threshold='Theo `log10_p` của pipeline; không đặt ngưỡng mới.', minN='—', sufficient='—',
     missing='Không có trong danh sách → `OBSERVED_NO_KNOWN_GAP` (không có nghĩa là quan sát đầy đủ).',
     output='`observationStatus`.', certainty='Mây không có trong danh sách.',
     conclude='Được: “vệ tinh X không quan sát ngày …”. Không được: suy mức quan sát từ số detection.',
     ui='Biểu tượng chất lượng: “Vệ tinh không quan sát; giá trị được vá từ nguồn khác.”',
     example='S-NPP mất toàn quốc 11–16/07/2026; ngày 11/07: `snpp_eq` toàn quốc = 18,8, cả 587 ô mã 4 (NOAA-20).',
     validation='Đối chiếu danh sách granule chính thức (chưa làm).', status='Dùng ngay.')

rule('DQ-02',
     name='Đổi nguồn vệ tinh hoặc phiên bản trong kỳ.',
     unit='Vùng × kỳ', input=PB + '; `version` (tệp điểm).', filter='—',
     formula='`sourceCodeShare{1..4}`; cờ `SOURCE_SWITCH_IN_PERIOD` khi có > 1 mã; danh sách `version`.', baseline=NOBL,
     threshold='Không có', minN='—', sufficient='—', missing='—', output='`sourceCodeCellDays{}`, `versions[]`, `flags[]`.',
     certainty='Chính xác (đọc từ artifact).',
     conclude='Được: ghi chú nguồn. Không được: gộp vào nhãn hoạt động.',
     ui='“Kỳ này dùng nhiều nguồn: S-NPP trực tiếp và NOAA-20 quy đổi.”',
     example='10/2026 toàn quốc: 17.351 ô-ngày mã 3 và 846 ô-ngày mã 4 (4,6%).', validation='—', status='Dùng ngay.')

rule('DQ-03',
     name='Thiếu trường.',
     unit='Vùng × kỳ', input=PA, filter='—',
     formula='`count(type is null)`, `count(conf is null)`, `count(frp is null)`.', baseline=NOBL, threshold='Không có',
     minN='—', sufficient='—', missing='—', output='`missingFieldCounts{}`.', certainty='Chính xác.',
     conclude='Được: “X điểm thiếu type”. Không được: thay giá trị thiếu.',
     ui='“X điểm chưa có thông tin loại nguồn nhiệt (dữ liệu NRT).”',
     example='22.157 điểm NRT thiếu `type` (01/08 – 13/11/2026).', validation='—', status='Dùng ngay.')

rule('DQ-04',
     name='Tỉ số detection giữa hai vệ tinh cùng ngày lệch bất thường.',
     unit='Ngày', input=PA, filter='Lõi; ngày cả hai vệ tinh ≥ 100 detection.',
     formula='`r = N20/SNPP` theo ngày; so với phân bố lịch sử.', baseline='2019–2025.', threshold='`null` (chưa chốt).',
     minN='—', sufficient='Cả hai vệ tinh hoạt động.', missing='Một vệ tinh `OUTAGE` → không tính.',
     output='`ratio`, `flag`.',
     certainty='Tỉ số ngày dao động rất rộng do khác giờ bay và mây; chỉ dùng để phát hiện lỗi lớn.',
     conclude='Được: “có thể có vấn đề dữ liệu”. Không được: kết luận về cháy.',
     ui='“Số phát hiện của hai vệ tinh lệch nhau bất thường ngày này (kiểm tra dữ liệu).”',
     example='730 ngày (cả hai ≥ 100): p05 = 0,48; p50 = 1,02; p95 = 2,06; min 0,29; max 3,81.',
     validation='Đối chiếu ngày lệch lớn với thông báo sự cố vệ tinh.', status='Cần tính thêm.')

# ---------------- So sánh ----------------
CMPCHK = 'Điều kiện chung: cùng phiên bản, cùng tập ô hoặc đã chuẩn hóa, cùng độ dài hiệu dụng, cả hai `AVAILABLE`, không có mã 1, cùng nhánh và bộ lọc. Không đạt → `differenceAvailable = false` + `reasons[]`.'

rule('CMP-01',
     name='Tháng này với tháng trước, có phân biệt thay đổi theo mùa.',
     unit='Vùng × cặp tháng liền nhau', input=PB, filter='Nhánh B.',
     formula='`r = X_m / X_{m−1}`; so `r` với phân bố tỉ số của cùng cặp tháng các năm (thứ hạng, α).',
     baseline='Cùng cặp tháng 2003–2025 (vận hành: năm < y).', threshold='α như AN-01.', minN='n ≥ 9',
     sufficient=CMPCHK, missing='`X_{m−1} = 0` → `r = null`; chỉ trả `delta`.',
     output='`ratio`, `historicalMedianRatio`, `classification`, `delta`.',
     certainty='Phần lớn thay đổi giữa hai tháng là do mùa.',
     conclude='Được: “tăng nhiều hơn/ít hơn mức tăng mùa thường gặp”. Không được: gọi mức tăng mùa là bất thường.',
     ui='“Tăng ×2,54 so với tháng trước; mức tăng thường gặp của cặp tháng này là ×1,81.”',
     example='Toàn quốc 02 → 03/2026: 3.634,0 → 9.213,3 (×2,54); trung vị lịch sử ×1,81; ngưỡng 1,15 / 2,54 → TYPICAL (sát ngưỡng). Có `SEASONAL_CHANGE_EXPECTED`.',
     validation=SPLIT + '.', status='Dùng ngay.')

rule('CMP-02',
     name='Cùng tháng năm trước.',
     unit='Vùng × hai tháng cùng tên', input=PB, filter='Nhánh B.',
     formula='`delta = B − A`; `deltaPct` khi `A ≥ M_min`; `log2(B/A)` so với phân bố biến động năm-năm.',
     baseline='Phân bố |log₂| hai năm liền nhau (bối cảnh).', threshold='Không có ngưỡng ý nghĩa; bối cảnh p50/p75/p90 = 0,55 / 0,97 / 1,44.',
     minN='Hai kỳ đủ', sufficient=CMPCHK, missing='A = 0 → `deltaPct = null`.',
     output='`delta`, `deltaPct`, `log2Ratio`, `warnings`.', certainty='Bối cảnh mô tả, không phải kiểm định.',
     conclude='Được: “thay đổi nằm trong / vượt biến động thường gặp”. Không được: “giảm có ý nghĩa thống kê”.',
     ui='“Thấp hơn 22% so với cùng tháng năm trước; nằm trong biến động thường gặp.”',
     example='Tây Nguyên 03/2024 → 03/2025: 3.880,0 → 3.034,0 (−21,8%; \\|log₂\\| = 0,35).',
     validation='Phân bố |log₂| theo vùng và mùa.', status='Dùng ngay.')

rule('CMP-03',
     name='Tháng so với phân bố cùng tháng nhiều năm.',
     unit='Như AN-01', input='Như AN-01', filter='Như AN-01', formula='= AN-01 / AN-02 (cấp tháng).',
     baseline='BL-MONTH', threshold='α', minN='n ≥ 9', sufficient='Như AN-01', missing='Như AN-01', output='Như AN-01',
     certainty='Như AN-01', conclude='Như AN-01 / AN-02.', ui='“Hạng x/n trong các năm cùng tháng.”',
     example='Toàn quốc 03/2026: hạng 24/24 (`FULL`).', validation='Như AN-01.', status='Dùng ngay.')

rule('CMP-04',
     name='Tháng (hoặc năm) đang diễn ra so với cùng số ngày lịch sử.',
     unit='Vùng × khoảng ngày', input=PB, filter='Nhánh B.',
     formula='`X = Σ days 1..d of current period`; `R = {same day span in other years}`; rồi AN-01.',
     baseline='BL-PARTIAL', threshold='α', minN='n ≥ 9', sufficient='Cùng khoảng ngày cho mọi năm.',
     missing='Khoảng chứa 29/02 → TM-04.', output='Như AN-01 + `daySpan`.',
     certainty='Kỳ ngắn dao động mạnh hơn.',
     conclude='Được: so cùng khoảng ngày. Không được: so phần đã qua với cả tháng (sai −71% trong ví dụ).',
     ui='“01–13/11: so với cùng 13 ngày các năm trước.”',
     example='Toàn quốc 01–13/11/2026 = 398,5; cùng khoảng 2003–2025 median 493,0; ngưỡng 138,0 / 1.088,0 → TYPICAL. Cả tháng 11 có median 1.398,0.',
     validation='—', status='Dùng ngay.')

rule('CMP-05',
     name='Cùng mùa giữa các năm (tổng năm-mùa).',
     unit='Vùng × năm-mùa', input=PB, filter='Nhánh B.', formula='Tổng năm-mùa; AN-01/02.',
     baseline='BL-SEASON', threshold='α', minN='n ≥ 9 mùa', sufficient='Năm-mùa trọn vẹn.', missing='Mùa đang diễn ra → CMP-04.',
     output='Như AN-01.', certainty='Định nghĩa mùa là giả định dữ liệu (TM-06).',
     conclude='Được: “mùa này thấp/cao hơn hầu hết các mùa”. Không được: gọi là “mùa cháy” khí hậu.',
     ui='“Tổng hoạt động năm-mùa 12/2024 – 11/2025 so với các mùa trước.”',
     example='Tây Nguyên 2024-2025: 11.669,9 so với median 27.561,9 → LOW (n = 21).', validation='Độ nhạy theo tháng bắt đầu mùa.',
     status='Dùng ngay.')

rule('CMP-06',
     name='Thời điểm bắt đầu / đỉnh / kết thúc và độ dài mùa.', unit='Như AN-05', input='Như AN-05', filter='Như AN-05',
     formula='= AN-05.', baseline='BL-SEASON', threshold='Như AN-05', minN='n ≥ 9', sufficient='Như AN-05', missing='Như AN-05',
     output='Như AN-05', certainty='Như AN-05',
     conclude='Không được gọi ngày detection đầu tiên hay mốc 10% là ngày bắt đầu mùa cháy thực tế.',
     ui='Như AN-05.', example='Như AN-05.', validation='Như AN-05.', status='Dùng ngay.')

rule('CMP-07',
     name='Mức tập trung hoạt động trong mùa.', unit='Vùng × năm-mùa', input=PB, filter='Nhánh B.',
     formula='`max30Share` = tổng 30 ngày lớn nhất / tổng mùa; AN-01/02.', baseline='BL-SEASON', threshold='α; 30 ngày: lựa chọn dự án.',
     minN='n ≥ 9', sufficient='Mùa trọn vẹn.', missing='Tổng mùa = 0 → `null`.', output='`max30Share`, nhãn.',
     certainty='Mô tả.', conclude='Được: “hoạt động phân tán hơn”. Không được: suy nguyên nhân.',
     ui='“Phần hoạt động trong 30 ngày cao điểm nhất của mùa.”',
     example='Tây Nguyên 2024-2025: 0,282 so với median 0,343 → LOW.', validation='—', status='Dùng ngay.')

rule('CMP-08',
     name='So sánh năm.', unit='Vùng × năm', input=PB + '; tệp điểm cho số ngày có phát hiện.', filter='Nhánh B; AC-02 một vệ tinh.',
     formula='Tổng năm (AN-01/02); số ngày có phát hiện (AC-02); SPC-02/03; Theil–Sen (AN-06).',
     baseline='BL-YEAR', threshold='α', minN='n ≥ 9 năm đủ', sufficient='Năm đủ 12 tháng.',
     missing='2000 và 2026 partial → chỉ so cùng khoảng ngày.', output='Tổng, nhãn, `detectionDays`, `top10Share`, `tv`, độ dốc.',
     certainty='Đổi cảm biến đã được hài hòa ở nhánh B; số thô thì không.',
     conclude='Được: so `snpp_eq` giữa các năm. Không được: so detection thô đa vệ tinh (S6).',
     ui='“Tổng hoạt động năm đã quy về thang S-NPP.”',
     example='Detection thô ban ngày 2011 → 2012: 13.803 → 86.644 (×6,3); `snpp_eq` 66.128 → 75.241 (×1,14).',
     validation='Theo năm; leave-one-year-out (`validation_leave_one_year_out.csv`).', status='Dùng ngay.')

rule('CMP-09',
     name='So sánh khu vực.', unit='Hai vùng × cùng kỳ', input=PB, filter='Cùng nhánh, cùng bộ lọc.',
     formula='Mật độ = tổng / (diện tích các ô được chọn / 1.000 km²); cũng trả tổng và mỗi ô.', baseline=NOBL, threshold=NOTH,
     minN='—', sufficient=CMPCHK + ' Cho phép khác tập ô vì đã chuẩn hóa.',
     missing='Diện tích ô theo vĩ độ (709,3 – 764,0 km²).', output='`valueA`, `valueB`, `densityA`, `densityB`, `ratio`.',
     certainty='Vùng khác nhau về lớp phủ, mây và góc quan sát; chưa có dữ liệu lớp phủ.',
     conclude='Được: “mật độ phát hiện cao hơn”. Không được: “mật độ đám cháy cao hơn”; không so hai vùng khác lớp phủ mà không ghi chú.',
     ui='“Mật độ phát hiện trên 1.000 km² (không phải mật độ đám cháy).”',
     example='03/2024: ĐBSCL 5.380 so với Tây Nguyên 3.880 → theo tổng ×1,39; theo mỗi ô ×2,38.', validation='—', status='Dùng ngay.')

rule('CMP-10',
     name='Hai bản đồ (dual-map).', unit='Ô × hai kỳ', input='`/map/cells` × 2', filter='Nhánh B.',
     formula='Delta từng ô khi tương thích (v0.4 §7 / D20).', baseline=NOBL, threshold=NOTH, minN='—',
     sufficient=CMPCHK, missing='Không tương thích → ẩn chênh lệch, ghi lý do.', output='`delta` theo ô, `differenceAvailable`.',
     certainty='Từng ô dao động mạnh; không gắn nhãn.',
     conclude='Được: “ô X cao hơn ở kỳ B”. Không được: kết luận bất thường cấp ô (so sánh bội).',
     ui='“Chênh lệch từng ô giữa hai kỳ (cùng thang màu).”',
     example='Đã có trong frontend Compare (nhánh `frontend/*`).', validation='Contract test v0.4.', status='Đã có.')

rule('CMP-11',
     name='Phân bố không gian giữa hai kỳ.', unit='Như SPC-03', input='Như SPC-03', filter='Như SPC-03',
     formula='SPC-01 … SPC-03.', baseline='Phân bố TV cặp năm liền nhau.', threshold=NOTH, minN='Hai kỳ đủ',
     sufficient=CMPCHK, missing='Như SPC-03', output='`activeCells`, `top10Share`, `tv`.', certainty='Mô tả.',
     conclude='Được: “phân bố đổi nhiều hơn thường gặp”. Không được: “đám cháy dịch chuyển”.',
     ui='Như SPC-03.', example='2024 → 2025: TV = 0,183 (cặp năm liền nhau 2012–2025: trung vị 0,167, tối đa 0,217).',
     validation='—', status='Dùng ngay.')


def esc(s):
    return s.replace('\n', ' ')


def render():
    out = ['## Phần VI. Hợp đồng quy tắc', '',
           'Mỗi quy tắc có đủ 17 trường theo mục 8 của yêu cầu, cộng trường “Được / không được kết luận” (mục 7).',
           '',
           '- Ngưỡng đọc từ **CFG**, không hard-code.',
           '- Ghi `null` khi ngưỡng chưa có căn cứ.',
           '- Trạng thái: **Dùng ngay** / **Cần tính thêm** / **Cần dữ liệu** / **Đã có**.',
           '',
           '> Ngưỡng thống kê (ngưỡng thứ hạng, p90, p95, p99…) là **quy tắc của dự án**, không phải ngưỡng xác nhận cháy.',
           '> Một giá trị vượt p95 nghĩa là cao hơn khoảng 95% giá trị tham chiếu. Nó **không** có nghĩa là xác suất có cháy là 95%.',
           '']
    groups = [('EV', 'Nhánh A — detection, cụm, sự kiện'), ('AC', 'Nhánh A — đếm'), ('FRP', 'Tín hiệu nhiệt — FRP'),
              ('BT', 'Tín hiệu nhiệt — brightness'), ('SPC', 'Phân bố không gian'), ('AN', 'Bất thường hoạt động (nhánh B, trừ AN-03/AN-04)'),
              ('DQ', 'Bất thường dữ liệu (tách khỏi bất thường cháy, P12)'), ('CMP', 'So sánh')]
    for prefix, title in groups:
        out += [f'### {title}', '']
        for rid, kw in R:
            if rid.split('-')[0] != prefix:
                continue
            out += [f'#### {rid}', '', '| Trường | Nội dung |', '|---|---|', f'| rule_id | `{rid}` |']
            out += [f'| {label} | {esc(kw[key])} |' for key, label in FIELDS]
            out.append('')
    out += ['### Mức chú ý (thay cho “mức cảnh báo”)', '',
            '| Mức | Điều kiện | Màu UI |', '|---|---|---|',
            '| 0 — Bình thường | `TYPICAL` | Trung tính |',
            '| 1 — Cao/thấp hơn hầu hết các năm | `HIGH`/`LOW` ở **một** cửa sổ, chế độ vận hành, cấp vùng | Màu nhấn trung tính, có chữ |',
            '| 1′ — Có thể cao/thấp | `POSSIBLY_*` (giai đoạn ước lượng) | Viền nét đứt |',
            '| 2 — Cao/thấp ở cả hai cửa sổ | `HIGH`/`LOW` ở cả `FULL` và `RECENT` | Nhấn mạnh hơn, **không** đỏ báo động |',
            '| 3 — Cao kéo dài | Mức 2 ở ≥ k/m kỳ (AN-07) | Chưa bật |', '',
            'Bất thường dữ liệu dùng biểu tượng riêng “chất lượng dữ liệu”, không dùng thang mức chú ý.', '', '---', '']
    return '\n'.join(out)


if __name__ == '__main__':
    path = sys.argv[1]
    t = open(path, encoding='utf-8').read()
    start = t.index('## Phần VI. Hợp đồng quy tắc')
    end = t.index('## Phần VII.')
    t = t[:start] + render() + '\n' + t[end:]
    open(path, 'w', encoding='utf-8', newline='\n').write(t)
    print('rules:', len(R))
