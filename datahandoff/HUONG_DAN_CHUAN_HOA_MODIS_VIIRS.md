# Chuẩn hóa bốn bộ dữ liệu FIRMS về thước đo S-NPP

Tài liệu dự án Hỏa Lịch, lập ngày 14/11/2026. Mô tả dựa trên `hoalich_pipeline.py`, `hoalich_README.md`, gói `hoalich_data_v1.zip` và các script xuất JSON trong workspace. Các kết quả v1 được trích từ artifacts đi kèm; lần lập tài liệu này không chạy lại toàn bộ hiệu chuẩn.

## 1. Mục tiêu

MODIS và VIIRS có độ phân giải, độ nhạy và lịch quan sát khác nhau. Số phát hiện gốc của chúng không thể nối trực tiếp thành một chuỗi rồi diễn giải mọi thay đổi là thay đổi hoạt động cháy.

Hỏa Lịch chọn một thước đo chung:

> **Số phát hiện ban ngày, đã lọc nguồn nhiệt tĩnh, tương đương vệ tinh S-NPP VIIRS.**

Cột biểu diễn thước đo này là `snpp_eq`. Phần trước khi S-NPP hoạt động được ước lượng từ MODIS; phần có S-NPP hợp lệ sử dụng quan sát S-NPP; NOAA-20 được quy đổi để tiếp nối hoặc vá khoảng thiếu.

Kết quả là chuỗi thống nhất về đơn vị. Phương pháp không xác định tổng số đám cháy thật, không tạo thêm tọa độ điểm cháy đã bỏ sót và chưa hiệu chuẩn FRP hoặc nhiệt độ sáng giữa các cảm biến.

## 2. Bốn bộ đầu vào và vai trò

| Bộ FIRMS | Vệ tinh | Vai trò trong pipeline hiện tại |
|---|---|---|
| MODIS M-C61 | Terra và Aqua | Tái dựng lịch sử trước S-NPP; Aqua là cầu nối chính |
| VIIRS SV-C2 | S-NPP | Nguồn tham chiếu |
| VIIRS J1V-C2 | NOAA-20 | Quy đổi về S-NPP để vá hoặc tiếp nối |
| VIIRS J2V-C2 | NOAA-21 | Đối chiếu tính nhất quán và hỗ trợ dò khoảng thiếu |

Như vậy có **bốn bộ dữ liệu, năm vệ tinh và hai họ cảm biến MODIS/VIIRS**. NOAA-21 đã được đọc và phân tích nhưng **chưa được chọn vào chuỗi hài hòa cuối**. Không nên mô tả bản v1 là đã sử dụng số đếm của cả năm vệ tinh để tạo giá trị cuối ở mọi thời điểm.

## 3. Dữ liệu gốc và dữ liệu sau chuẩn hóa

Mỗi dòng FIRMS gốc là một phát hiện tại một pixel và một thời điểm. Các trường thường gặp:

| Trường | Ý nghĩa sử dụng |
|---|---|
| `latitude`, `longitude` | Tọa độ tâm pixel phát hiện |
| `acq_date`, `acq_time` | Ngày và giờ quan sát UTC |
| `satellite`, `instrument` | Vệ tinh và cảm biến thực đo |
| `daynight` | Ban ngày hoặc ban đêm |
| `frp` | Công suất bức xạ cháy, MW |
| `brightness`, `bright_t31` | Các trường nhiệt độ sáng của sản phẩm gốc, K |
| `confidence` | Chỉ báo độ tin cậy; thang MODIS và VIIRS khác nhau |
| `scan`, `track` | Kích thước pixel theo hướng quét và hướng chuyển động, km |
| `type`, `version` | Phân loại và phiên bản sản phẩm; NRT hiện có không chứa `type` |

Tên trường, kênh phổ và cách diễn giải độ sáng phải theo sản phẩm nguồn. Giữ nguyên tên trường trong JSON không có nghĩa mọi cảm biến đo cùng kênh. Nhiệt độ sáng của pixel cũng không phải nhiệt độ ngọn lửa.

Đơn vị tổng hợp hiện tại là **số bản ghi phát hiện**, khác với phương án occupancy “số ô 1 km–ngày” từng được đề xuất trong tài liệu nghiên cứu ban đầu.

## 4. Bước chuẩn hóa bảng và lọc dữ liệu

1. Đọc các JSON archive/NRT, chuẩn hóa tên vệ tinh, kiểu tọa độ, giờ và trường số trong bảng nội bộ.
2. Loại bản ghi trùng theo tọa độ, thời gian và vệ tinh trong pipeline chính. Bản tải hiện tại được báo cáo không có trùng.
3. Dựng mặt nạ nguồn nhiệt tĩnh từ vị trí từng có `type=2` hoặc `type=3`; làm tròn tọa độ trên lưới 0,01°.
4. Loại các phát hiện rơi vào mặt nạ, kể cả NRT thiếu `type`.
5. Chọn `daynight=D` để xây chuỗi hài hòa.
6. Mặc định giữ mọi mức confidence; thống kê hoặc thử nghiệm bỏ confidence thấp là phân tích riêng.

Mặt nạ tĩnh giúp giảm ảnh hưởng của nguồn công nghiệp và nguồn nhiệt cố định, nhưng có thể loại cả cháy thực xảy ra trong cùng ô mặt nạ. Đây là một giả định tiền xử lý cần công bố.

Trong JSON mới, mỗi bản ghi bên trong `detections` giữ nguyên trường và giá trị gốc. “Giữ nguyên” áp dụng cho bản ghi được giữ lại sau lọc, không có nghĩa toàn bộ dữ liệu ngày/đêm ban đầu đều có mặt trong file xuất.

## 5. Ô lưới `cell` và thời gian

Pipeline dùng ô 0,25°:

\[
cy=\lfloor latitude/0.25\rfloor,\qquad
cx=\lfloor longitude/0.25\rfloor.
\]

Mã ô là `cy_cx`. Ví dụ `34_419` có vĩ độ [8,50; 8,75) và kinh độ [104,75; 105,00). Đây là vùng tổng hợp, không phải một điểm cháy hoặc đơn vị hành chính. Kích thước theo km thay đổi theo vĩ độ.

Mỗi vệ tinh được đếm riêng theo ô–ngày, rồi tổng hợp ô–tháng và ô–pentad. Ngày theo `acq_date` UTC. Một pentad thông thường dài 5 ngày; năm có 73 pentad, khối cuối nhận ngày dư.

## 6. Dữ liệu học hiệu chuẩn

Quan hệ Aqua→S-NPP được học trên 02/2012–12/2021, theo ô 0,25° × tháng. Chỉ những ô–tháng cả hai nguồn có exposure ít nhất 0,999 được đưa vào hiệu chuẩn v1.

Ký hiệu:

| Ký hiệu | Định nghĩa |
|---|---|
| c, t | Ô lưới và tháng cụ thể của một năm |
| m, s | Tháng trong năm và nhóm mùa |
| A, V | Số Aqua và S-NPP ban ngày sau lọc |
| W | Trọng số train; mặc định 1 cho ô–tháng được chọn, 0 cho phần loại |
| V̂ | Số S-NPP tương đương được dự báo |

Các hệ số và prior phải được tính lại chỉ từ train trong từng vòng validation. Sử dụng toàn bộ nhãn để tính hệ số trước khi chia năm sẽ làm kết quả kiểm tra quá lạc quan.

## 7. Mô hình tỷ số theo ô

Đặt tổng đích và tổng nguồn:

\[
N_c=\sum_t W_{c,t}V_{c,t},\qquad
D_c=\sum_t W_{c,t}A_{c,t}.
\]

Tỷ số toàn cục:

\[
r_g=\frac{\sum_cN_c}{\sum_cD_c}.
\]

Prior không gian được lấy từ cửa sổ 5×5 có cả ô trung tâm:

\[
p_c=\frac{N_{\mathcal N(c)}+k_{nb}r_g}
{D_{\mathcal N(c)}+k_{nb}}.
\]

Tỷ số ô đã làm trơn:

\[
r_c=\frac{N_c+k_{cell}p_c}{D_c+k_{cell}},\qquad
\widehat V_{cell}=r_cA.
\]

Mục đích là hạn chế hệ số cực đoan ở ô ít dữ liệu. Ô có nhiều Aqua tin nhiều vào tỷ số riêng; ô ít Aqua được kéo về prior lân cận. Đây là tỷ số của các tổng, không phải trung bình tỷ số của từng tháng.

Ví dụ minh họa: một ô có tổng Aqua 30, tổng S-NPP 168 và prior 5. Với k_cell=100, hệ số là (168+100×5)/(30+100)≈5,138. Một tháng Aqua=10 cho dự báo khoảng 51,38 phát hiện S-NPP tương đương theo nhánh này.

## 8. Mô hình hurdle: hai trường hợp Aqua

\[
\widehat V_{hurdle}=\begin{cases}
r_{c,s}A,&A>0,\\
g_{c,m},&A=0.
\end{cases}
\]

### 8.1. Aqua có phát hiện

Chỉ trên các tháng A>0, tính tổng N⁺ và D⁺ theo ô–mùa. Pipeline làm trơn:

\[
r_{c,s}=\frac{N_{c,s}^{+}
+k_{season}r_c^{+}(r_s^{+}/r_g^{+})}
{D_{c,s}^{+}+k_{season}}.
\]

r_c⁺ là tỷ số ô đã làm trơn trên nhóm A>0; r_s⁺ và r_g⁺ là tỷ số mùa và toàn cục trên chính nhóm này. Hai mùa mặc định là tháng 1–5 và 6–12.

Mục đích là cho phép quan hệ Aqua/S-NPP thay đổi theo địa điểm và mùa. Không được đồng nhất các tỷ số có dấu ⁺ với tỷ số của mô hình cell, vì tập mẫu khác nhau.

### 8.2. Aqua không phát hiện

Với nhóm A=0, gọi S⁰ là tổng S-NPP, n⁰ là tổng trọng số mẫu tương ứng. Pipeline lấy trung bình rồi làm trơn theo mùa và tháng:

\[
g_{c,s}=\frac{S_{c,s}^{0}+k_{floor}g_s}
{n_{c,s}^{0}+k_{floor}},\qquad
g_{c,m}=\frac{S_{c,m}^{0}+k_{floor}g_{c,s(m)}}
{n_{c,m}^{0}+k_{floor}}.
\]

g_s là mức trung bình nhóm A=0 của mùa trên toàn miền. Với cấu hình sàn khí hậu mặc định, g_c,m là mức dự báo khi Aqua bằng 0. Pipeline còn có lựa chọn sàn theo hoạt động lân cận, nhưng đó không phải cấu hình mặc định đang mô tả.

Mục đích là mô tả tín hiệu S-NPP có thể ghi nhận khi Aqua không phát hiện. Đây là kỳ vọng thống kê, không phải khôi phục danh sách tọa độ thực tế.

## 9. Mô hình lai và các tham số

\[
\boxed{\widehat V=0.5\widehat V_{cell}+0.5\widehat V_{hurdle}}
\]

Mô hình lai cân bằng hai giả định: hoạt động thay đổi tỷ lệ với Aqua và phần phát hiện Aqua bỏ sót có mức nền theo mùa.

| Tham số | Bản v1 | Đề xuất sau thí nghiệm | Vai trò |
|---|---:|---:|---|
| k_cell | 60 | **100** | Co tỷ số ô về prior |
| k_season | 60 | 60 | Co tỷ số ô–mùa |
| k_nb | 20 | 20 | Co prior lân cận về toàn cục |
| k_floor | 2 | 2 | Làm trơn mức sàn nhóm A=0 |
| Trọng số blend | 0,5–0,5 | 0,5–0,5 | Kết hợp hai dự báo |
| κ | 3 | 3 | Phân bổ tổng tháng xuống ngày |

**Hệ số** r_c, r_c,s, g_c,m được học từ dữ liệu. **Tham số** k_cell, k_season… điều khiển mức làm trơn. Không gọi tất cả là hệ số chuyển đổi giữa vệ tinh.

Thí nghiệm nested validation theo năm trên bộ v1 chọn k_cell=100 ở cả năm vòng. MAE giảm từ 4,188345 xuống 4,185523, khoảng 0,067%; kết quả ít nhạy trong vùng 40–200. Chi tiết tại `K_VALIDATION_REPORT.md`.

Pipeline mặc định và các JSON xuất hiện tại **vẫn dùng kết quả v1 với k_cell=60**. Chọn 100 chưa đồng nghĩa bộ sản phẩm đã được chạy lại. Trước khi phát hành bản dùng 100 cần truyền tham số nhất quán, kiểm định và sinh lại hệ số, chuỗi cùng khoảng bất định.

## 10. Exposure và khoảng thiếu

\[
e=\frac{\text{số ngày được đánh dấu hợp lệ}}{\text{số ngày lịch}},
\qquad A_{adj}=A/e.
\]

Khi dựng sản phẩm, mã hiện chỉ bù theo công thức trên nếu e≥0,5. Ví dụ e=0,8 và A=80 thì A_adj=100. Khi e<0,5, mã đặt đầu vào nguồn điều chỉnh bằng 0; phần này cần cảnh báo thay vì gọi là quan sát xác nhận không cháy.

Cờ hợp lệ được suy luận từ thống kê phát hiện của nhiều vệ tinh và các chuỗi ngày trống. Nó chưa phải mặt nạ coverage/cloud chính thức. Phép bù còn giả định những ngày thiếu có thể đại diện bằng ngày có dữ liệu; điều này có thể sai trong các đợt cháy ngắn.

Đây là bù exposure trong quá trình dựng sản phẩm; mô hình mặc định là các công thức tỷ số/sàn, không phải một GBM Poisson đang được huấn luyện với offset.

## 11. Chuyển đổi từng nguồn về S-NPP

| Nguồn | Đường chuyển đổi |
|---|---|
| S-NPP | Giữ số phát hiện trực tiếp khi hợp lệ |
| Aqua | Mô hình lai Aqua→S-NPP |
| Terra | Mô hình Terra→Aqua, sau đó mô hình Aqua→S-NPP |
| NOAA-20 | Số NOAA-20 chia tỷ số N20/S-NPP |
| NOAA-21 | Có tỷ số đối chiếu, chưa là nhánh nguồn trong chuỗi cuối |

### NOAA-20

Trên các ô–ngày cả NOAA-20 và S-NPP được đánh dấu hợp lệ:

\[
k_{20}=\frac{\sum NOAA20}{\sum S\text{-}NPP}=1.0106,
\qquad V_{eq}=NOAA20/k_{20}.
\]

Tỷ số NOAA-21/S-NPP được báo cáo là 0,9633. Hai con số này thuộc bộ dữ liệu, bộ lọc và thời kỳ v1; không coi là hằng số vật lý áp dụng mọi nơi.

### Terra

Quan hệ Terra→Aqua được học trên 2003–2007. Trước tháng 8/2002, áp hai bước Terra→Aqua→S-NPP. Đoạn này tích lũy sai số của hai phép hiệu chuẩn và cần cảnh báo độ tin cậy thấp hơn.

## 12. Quy tắc chọn nguồn, không cộng vệ tinh

Ở từng ô–ngày:

1. Trước tháng 8/2002: dùng Terra qua hai bước hiệu chuẩn.
2. Từ tháng 8/2002 đến trước S-NPP: dùng Aqua hiệu chuẩn.
3. Khi có S-NPP hợp lệ: dùng S-NPP.
4. S-NPP thiếu nhưng NOAA-20 hợp lệ: dùng NOAA-20 quy đổi.
5. Cả hai không hợp lệ: fallback Aqua hiệu chuẩn.

Ví dụ minh họa S-NPP=100, NOAA-20=102 và NOAA-21=98 cùng ô–ngày: nếu S-NPP hợp lệ, kết quả là 100. Nếu S-NPP thiếu và NOAA-20 hợp lệ, kết quả xấp xỉ 102/1,0106=100,93.

Pipeline hiện có thể fallback Aqua sau năm 2022, dù tài liệu định hướng tránh giai đoạn quỹ đạo Aqua trôi. Cần giới hạn hoặc đánh dấu nhánh này trong một bản sửa tiếp theo.

## 13. Phân bổ tổng tháng xuống ngày và pentad

Với phần tái dựng từ MODIS:

\[
w_d=\frac{A_d+\kappa q_d}{\sum_{j\in tháng}(A_j+\kappa q_j)},
\qquad \widehat V_d=\widehat V_{tháng}w_d.
\]

q_d là hồ sơ mùa vụ S-NPP đã chuẩn hóa trong tháng; κ=3. Tổng trọng số bằng 1 nên bảo toàn tổng dự báo tháng. Sau đó cộng từng ngày thành pentad.

Pentad lịch sử là phân bổ ước lượng; nó không có độ xác thực tương đương quan sát S-NPP trực tiếp. Profile mùa vụ dùng khi kiểm định cũng phải học từ train.

## 14. JSON phục vụ làm việc

File hiện có: `artifacts/harmonized_with_detections.json`. Mỗi phần tử là một ô–tháng; `detections` chứa các phát hiện ban ngày sau lọc của tất cả vệ tinh có mặt trong ô–tháng đó.

Ví dụ cấu trúc sau chỉ minh họa, số snpp_eq không phải kết quả tính cho điểm ví dụ:

```json
[
    {
        "cell": "34_419",
        "year": 2005,
        "month": 3,
        "snpp_eq": 120.5,
        "source": "aqua_hieu_chuan",
        "detections": [
            {
                "latitude": 8.7243,
                "longitude": 104.9908,
                "acq_date": "2005-03-25",
                "acq_time": "0630",
                "type": "0",
                "track": 1,
                "daynight": "D",
                "satellite": "Aqua",
                "frp": 5.1,
                "instrument": "MODIS",
                "bright_t31": 293.6,
                "version": "6.03",
                "brightness": 313.9,
                "scan": 1,
                "confidence": "41"
            }
        ]
    }
]
```

| Trường ngoài | Ý nghĩa |
|---|---|
| cell/year/month | Vùng và kỳ tổng hợp |
| snpp_eq | Giá trị hài hòa; có thể là số thập phân vì là ước lượng |
| source | Nhãn nguồn tổng hợp từ bảng tháng v1 |
| detections | Danh sách phép đo gốc; không phải danh sách điểm S-NPP tổng hợp |

FRP, độ sáng, confidence, scan/track và thời gian trong detections giữ nguyên giá trị nguồn, không lấy trung bình và không đổi nhãn thành phép đo S-NPP. NRT không có type thì vẫn thiếu trường đó. Số phần tử detections không nhất thiết bằng snpp_eq vì có nhiều vệ tinh và phép quy đổi số đếm.

`detections=[]` nghĩa là không có phát hiện gốc được giữ lại ở ô–tháng. snpp_eq vẫn có thể dương do mức sàn và nối chuỗi. Trạng thái này chưa tự phân biệt không phát hiện, dữ liệu thiếu hay phát hiện bị loại; muốn phân biệt phải xem thêm dữ liệu trước lọc và cờ hợp lệ.

Nhãn source của bảng tháng hiện lấy nguồn chiếm đa số trên toàn miền trong kỳ, không phản ánh chính xác nguồn riêng từng ô. Khi cần truy vết đầy đủ, dùng src_code từng ô–ngày trong `cube_daily_day_veg.npz`.

## 15. Các file cần dùng

| File | Công dụng |
|---|---|
| hoalich_pipeline.py | Pipeline xử lý, hiệu chuẩn và kiểm định |
| hoalich_data_v1.zip | Artifacts hiệu chuẩn v1 và script verify_outputs.py |
| tables/calib_coeffs_025.csv trong ZIP | Tỷ số ô, tỷ số mùa, mức sàn tháng |
| tables/harmonized_025_month.csv trong ZIP | Chuỗi hài hòa ô–tháng |
| tables/cube_daily_day_veg.npz trong ZIP | Quan sát, cờ hợp lệ và nguồn từng ô–ngày |
| tables/validation_*.csv trong ZIP | Kết quả kiểm định theo thời gian và độ phủ |
| tune_shrinkage.py | Thí nghiệm chọn k_cell |
| K_VALIDATION_REPORT.md | Báo cáo độ nhạy tham số |
| export_harmonized_with_detections.py | Xuất JSON có số đếm quy đổi và danh sách phát hiện nguyên bản |

Chạy lại phần xuất JSON:

```powershell
python export_harmonized_with_detections.py
```

Lệnh này đọc artifacts v1 và raw trong Data/, không huấn luyện lại mô hình. File xuất có 183.731 ô–tháng, 1.839.788 phát hiện ban ngày sau lọc, tổng snpp_eq=1.774.716,01 và dung lượng khoảng 1,08 GB ở lần xuất hiện tại.

## 16. Cách đọc kết quả và giới hạn

- Đánh giá số đếm hài hòa bằng năm giữ lại, MAE, bias theo vùng và KGE; không chỉ nhìn việc bước nhảy 2012 giảm.
- FRP và độ sáng gốc phục vụ phân tích bổ sung theo đúng vệ tinh. Chưa có phép quy đổi những đại lượng này về S-NPP trong pipeline.
- Khoảng bất định v1 dùng phân vị tỷ số sai số thực nghiệm; chưa nên gọi là bảo đảm conformal 90% cho mọi AOI. Mã hiện có xử lý cận bằng nhau ở kỳ nguồn đa số là quan sát/quy đổi; không diễn giải thành không có sai số đo hoặc chuyển đổi.
- Ngày thiếu được suy luận thống kê; không có phát hiện không đồng nghĩa không cháy.
- Các năm/kỳ không đủ như đầu năm 2000 hoặc cuối năm 2026 cần đánh dấu, so cùng khoảng ngày khi so lịch sử.
- Static mask và cờ outage v1 dùng toàn bộ lịch sử; thí nghiệm chọn k đã giữ cố định các bước này. Không gọi đó là kiểm định độc lập toàn pipeline từ raw.
- Bản v1 chọn mô hình sau khi xem một số phép kiểm hai chiều; kết quả có thể lạc quan. Không diễn giải độ khớp S-NPP là độ chính xác tuyệt đối ngoài mặt đất.

## 17. Mô tả ngắn dùng khi thuyết trình

“Chúng tôi chọn S-NPP VIIRS làm thước đo chung. Dữ liệu được lọc cùng tiêu chí và tổng hợp theo cùng ô lưới, thời gian. Từ giai đoạn Aqua và S-NPP chồng lấn, chúng tôi học tỷ số theo địa điểm, mùa và mức nền khi Aqua không phát hiện. Terra được nối qua Aqua, còn NOAA-20 được hiệu chỉnh theo S-NPP. Ở mỗi ô–ngày, hệ thống chọn một nguồn ưu tiên để tránh đếm chồng. Số đếm đã hài hòa được lưu cùng các bản ghi gốc để truy vết FRP, độ sáng và thời gian quan sát.”
