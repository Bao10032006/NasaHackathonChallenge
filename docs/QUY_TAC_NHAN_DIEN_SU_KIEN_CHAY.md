# Bộ quy tắc nhận diện sự kiện cháy ước tính

- Phiên bản: `experimental_v1`
- Ngày lập: 2026-11-14
- Dữ liệu: FIRMS MODIS (Terra/Aqua), VIIRS (S-NPP/NOAA-20/NOAA-21).
- Mục tiêu: lọc detection cháy thực vật, gom cụm trong lượt quan sát và liên kết thành sự kiện cháy ước tính.

> Đây là quy tắc vận hành của dự án, chưa được kiểm định để xác nhận số đám cháy thực tế tại Việt Nam. Một detection là một pixel được vệ tinh phát hiện, không tương đương một đám cháy độc lập. Cháy thực vật không tự đồng nghĩa với cháy rừng.

## 1. Chọn detection đạt bộ lọc

| Nguồn | Điều kiện bắt buộc |
|---|---|
| MODIS — Terra/Aqua | `type = 0` và `confidence >= 30` và `frp >= 5 MW` |
| VIIRS — S-NPP/N20/N21 | `type = 0` và `confidence` thuộc `{n, h}` và `frp >= 5 MW` |

Tên nhóm: **Điểm phát hiện cháy thực vật đạt bộ lọc FRP ≥ 5 MW**.

`type = 0` có nghĩa là cháy thực vật giả định. Ngưỡng FRP 5 MW có tiền lệ trong nghiên cứu Riau [1], nhưng việc kết hợp các điều kiện trên là lựa chọn của dự án, không phải công thức xác nhận cháy đã được nghiên cứu đó kiểm định cho Việt Nam. Không chuyển confidence `n/h` của VIIRS thành xác suất hoặc phần trăm.

### Xử lý các bản ghi còn lại

| Trường hợp | Xử lý |
|---|---|
| `frp < 5` | Giữ trong nhóm phát hiện dưới ngưỡng FRP; không kết luận không cháy |
| Confidence thấp | Giữ tham khảo trong nhóm phát hiện chất lượng thấp |
| Thiếu `type` | Ghi điểm nóng chưa xác định loại; không tự điền `0` |
| `type = 1` | Tách nhóm nguồn nhiệt núi lửa |
| `type = 2` | Tách nhóm nguồn nhiệt cố định khác trên đất liền |
| `type = 3` | Tách nhóm nguồn nhiệt ngoài khơi/trên nước |
| Thiếu FRP | Chưa đánh giá được bộ lọc FRP; không thay bằng `0` |
| Thiếu hoặc không đọc được confidence | Chưa đánh giá được bộ lọc chất lượng |

Giữ nguyên bản ghi gốc. Các lý do không đạt bộ lọc có thể đồng thời xuất hiện; không xóa dữ liệu để thay thế bằng nhãn “không cháy”.

## 2. Đánh giá brightness bổ sung

Brightness là nhiệt độ sáng của pixel, đơn vị Kelvin, không phải nhiệt độ ngọn lửa hay độ sáng nhìn thấy bằng mắt.

| Nguồn và thời gian | Điều kiện | Diễn giải |
|---|---|---|
| MODIS ban ngày (`D`) | `brightness > 360 K` | Vượt ngưỡng nhiệt tuyệt đối MODIS |
| MODIS ban đêm (`N`) | `brightness > 320 K` | Vượt ngưỡng nhiệt tuyệt đối MODIS |
| VIIRS ban đêm (`N`) | `brightness > 320 K` | Chỉ đạt phần nhiệt độ của kiểm tra VIIRS |
| VIIRS ban ngày (`D`) | Không đặt ngưỡng cố định | Giữ giá trị gốc; chưa đánh giá bằng phép kiểm tra tuyệt đối đơn giản |

Nguồn ngưỡng: Giglio và cộng sự (2016) [2], Schroeder và cộng sự (2014) [3]. Các ngưỡng là những nhánh trong thuật toán xử lý ảnh, không tái hiện toàn bộ thuật toán từ JSON.

Lưu ý:

- Kiểm tra VIIRS ban đêm còn yêu cầu cờ chất lượng kênh `QF_I4 = 0` cho trường hợp tương ứng. JSON hiện tại không có cờ này; confidence `n` không thay thế được nó.
- MODIS ban ngày còn có các bước loại phát hiện giả.
- Điểm không vượt ngưỡng tuyệt đối vẫn có thể được thuật toán vệ tinh phát hiện bằng kiểm tra nền lân cận.
- Thiếu brightness hoặc không xác định ngày/đêm phải ghi “chưa đánh giá”, không coi là không vượt ngưỡng.
- Brightness là cờ bổ sung, **không bắt buộc để gom sự kiện** trong cấu hình mặc định này.
- Nếu bật lọc brightness, phải ghi rõ đây là bộ lọc thêm có khả năng bỏ sót và thay đổi tập điểm đầu vào.

## 3. Gom detection thành cụm trong từng lượt quan sát

Chỉ dùng các detection đạt bước 1 cho lớp sự kiện này.

1. Xử lý riêng từng vệ tinh.
2. Gom theo lượt quan sát nếu có mã lượt bay phù hợp.
3. Nếu thiếu mã lượt bay, tạo các nhóm thời gian có độ dài tối đa **10 phút**; đây chỉ là đại diện gần đúng, không bảo đảm xác định đúng lượt bay.
4. Trong mỗi nhóm, sử dụng:

```text
DBSCAN
    eps = 1 km
    min_samples = 1
    metric = Haversine
```

Dùng cùng khoảng cách **1 km cho cả MODIS và VIIRS**, theo lựa chọn của dự án. Không tính khoảng cách Euclidean trực tiếp trên kinh độ/vĩ độ dạng độ. Chuẩn hóa thời gian quan sát về UTC khi xử lý; `acq_time` cần được giữ đủ bốn chữ số trước khi ghép với `acq_date`.

Kết quả gọi là **cụm phát hiện cháy**. Detection đơn lẻ vẫn được giữ và ghi rõ cụm có một điểm.

> 1 km là khoảng cách nối các điểm lân cận, không phải bán kính hay đường kính tối đa của cụm. Một chuỗi detection có thể tạo thành cụm rộng nhiều kilomet. DBSCAN không tự chứng minh các detection thuộc cùng một đám cháy.

## 4. Liên kết cụm thành sự kiện cháy ước tính

Xử lý các cụm theo thứ tự thời gian. Cho phép liên kết giữa các vệ tinh.

Cụm mới có thể liên kết với một sự kiện nếu đồng thời:

```text
Khoảng thời gian từ lần ghi nhận gần nhất của sự kiện <= 24 giờ

VÀ

Khoảng cách nhỏ nhất giữa detection của cụm mới
và detection của cụm gần nhất thuộc sự kiện <= 1 km
```

| Kết quả đối chiếu | Hành động |
|---|---|
| Khớp đúng một sự kiện | Gắn cùng `event_id` |
| Không khớp sự kiện nào | Tạo `event_id` mới |
| Khớp nhiều sự kiện | Đánh dấu liên kết chưa rõ; không tự gộp tất cả |
| Không có ghi nhận mới trong hơn 24 giờ | Ngừng nối theo cấu hình này; không kết luận cháy đã tắt |

Các trường hợp chưa rõ cần được báo cáo riêng; không cộng vào một số lượng sự kiện được coi là chắc chắn.

**10 phút, 1 km và 24 giờ là cấu hình vận hành thử nghiệm**, không phải bộ ngưỡng khoa học đã kiểm chứng chung. Mây hoặc khoảng trống quan sát có thể làm một sự kiện bị tách; các hoạt động cháy gần nhau có thể bị gom nhầm. Khoảng cách cố định 1 km cũng có thể tách pixel MODIS lân cận có kích thước lớn.

## 5. Kết quả và cách trình bày

Mỗi `event_id` được liên kết rõ theo cấu hình hiện tại được tính là một **sự kiện cháy ước tính**, không phải một đám cháy đã xác nhận.

Câu kết luận mẫu:

> Trong khu vực và thời gian đã chọn, hệ thống nhận diện X sự kiện cháy thực vật ước tính từ các detection đạt bộ lọc type, confidence và FRP ≥ 5 MW. Có Y cụm chưa xác định rõ liên kết sự kiện.

Mỗi sự kiện nên lưu:

- `event_id` và `rule_version`.
- Thời điểm đầu tiên và gần nhất được quan sát; không gọi đó là thời điểm bắt đầu hoặc kết thúc cháy thực tế.
- Số detection và số nhóm quan sát.
- Các vệ tinh tham gia.
- Phạm vi các detection; không coi đó mặc nhiên là diện tích cháy.
- Danh sách detection gốc với FRP, brightness, confidence, type và tọa độ.
- Các cờ nhiệt bổ sung và trạng thái liên kết.

Không suy ra “cháy liên tục” giữa hai lần quan sát. Không gọi kết quả là “vụ cháy rừng” khi chưa có căn cứ về lớp phủ rừng.

## 6. Quan hệ với dữ liệu harmonization

```text
Detection gốc
    ├── Tổng hợp và hiệu chuẩn → snpp_eq → phân tích xu hướng
    └── Lọc + gom cụm + liên kết → sự kiện cháy ước tính
```

- Dùng `detections` gốc để gom cụm, vì còn vị trí, thời gian và cảm biến.
- `snpp_eq` là số lượt phát hiện quy đổi, không phải số đám cháy hay số pixel có vị trí mới.
- Một cell có thể chứa nhiều sự kiện; một sự kiện có thể đi qua nhiều cell.
- Bộ lọc FRP trong tài liệu này không tự thay đổi chuỗi `snpp_eq` đã tính. Nếu muốn chuỗi harmonization theo bộ lọc mới, cần hiệu chuẩn và chạy lại pipeline.
- Nếu dùng bản xuất chỉ giữ ban ngày, kết quả sự kiện cũng chỉ dựa trên quan sát ban ngày; không thể đánh giá nhánh ban đêm từ bản xuất đó.

## 7. Đánh giá trước khi dùng kết quả như số lượng sự kiện ổn định

Cần kiểm tra những trường hợp gộp/tách sai và báo cáo độ nhạy của ngưỡng không gian, thời gian, FRP. Giữ 1 km là cấu hình mặc định đã chọn, nhưng không trình bày nó là ngưỡng tối ưu đã được xác nhận.

## 8. Tài liệu tham khảo

1. Afi và cộng sự (2026). *Spatiotemporal Analysis of Peatland Fire Hotspots and Fire Intensity in Riau Province Using MODIS–VIIRS Multisensor Satellite Data*. JAIC, 10(3), 2198–2208. [PDF](https://jurnal.polibatam.ac.id/index.php/JAIC/article/download/12686/3628). Sử dụng FRP ≥ 5 MW làm bộ lọc phương pháp; không tiến hành xác minh thực địa trực tiếp.
2. Giglio, Schroeder & Justice (2016). *The Collection 6 MODIS active fire detection algorithm and fire products*. Remote Sensing of Environment, 178, 31–41. [Toàn văn](https://pmc.ncbi.nlm.nih.gov/articles/PMC6110110/). DOI: 10.1016/j.rse.2016.02.054.
3. Schroeder và cộng sự (2014). *The New VIIRS 375 m active fire detection data product: Algorithm description and initial assessment*. Remote Sensing of Environment, 143, 85–96. [PDF](https://directreadout.sci.gsfc.nasa.gov/publications_documents/Schroeder_et_al_2014b_RSE.pdf). DOI: 10.1016/j.rse.2013.12.008.
4. NASA FIRMS. [Định nghĩa trường MODIS](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_MODIS_Firehotspots.html) và [định nghĩa trường VIIRS](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html).
5. MODIS C6/C6.1 Active Fire Product User's Guide. [PDF](https://modis-fire.umd.edu/files/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf). Nguồn phân lớp confidence MODIS.
