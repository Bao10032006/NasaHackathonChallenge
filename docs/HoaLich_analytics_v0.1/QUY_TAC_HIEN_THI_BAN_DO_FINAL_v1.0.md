# Hỏa Lịch — Quy tắc hiển thị bản đồ theo thời gian và mức zoom

Phiên bản: `map-display-v1.0` • Ngày: 15/11/2026

Trạng thái: **Đặc tả sản phẩm đã chốt để triển khai**, theo yêu cầu tự lựa chọn ngưỡng của người dùng. Các ngưỡng dưới đây là lựa chọn giao diện, chưa được hiệu chỉnh bằng thử nghiệm người dùng. Chưa thay đổi backend, frontend, bộ lọc khoa học hoặc thuật toán sự kiện.

## 1. Quyết định chính

1. Bản đồ sự kiện ở mức nhìn toàn quốc: năm hiện ô có **từ 30 sự kiện ước tính**, tháng từ **5**, ngày từ **2**.
2. Zoom gần làm ngưỡng giảm dần; từ zoom 11 trở lên, hiện từ **1 sự kiện**.
3. Ngưỡng xét trên **ô cố định 0,25°**, không xét trên cụm biểu tượng thay đổi theo màn hình. Không giảm kích thước ô khi zoom để tránh thay đổi mẫu số.
4. Khi zoom gần, chuyển từ biểu tượng tổng hợp sang vị trí đại diện sự kiện. Khi đó con số trên cụm biểu tượng là số sự kiện, không phải số detection.
5. Ngưỡng hiển thị không làm mất dữ liệu, không thay đổi tổng vùng, biểu đồ, baseline hay nhãn thống kê.
6. Có nút **“Hiện tất cả nơi có dữ liệu”**, đưa ngưỡng về 1; vẫn gom biểu tượng để tránh chồng lấp.
7. Không có artifact sự kiện hợp lệ thì không dùng detection hoặc `snpp_eq` giả làm số sự kiện. Hiển thị rõ lớp chưa sẵn sàng, cho phép người dùng chọn lớp khác.

Ví dụ người dùng nói “điểm A có 100 đám cháy” được diễn giải trong sản phẩm là: **ô A có 100 sự kiện cháy ước tính được ghi nhận trong kỳ**, không phải một tọa độ có 100 đám cháy đã xác nhận.

## 2. Tài liệu đầu vào và phạm vi kế thừa

Đã đọc gói `HoaLich_analytics_v0.1.zip`; các tài liệu bên trong mang phiên bản v0.2-draft:

- [Quy tắc phân tích](QUY_TAC_PHAN_TICH_BAT_THUONG_VA_SO_SANH.md).
- [Hợp đồng dữ liệu](DATA_CONTRACT_ANALYTICS.md).
- [Kế hoạch sản phẩm](PRODUCT_PLAN_THEO_DOI_CHAY.md).
- [Cấu hình nghiên cứu](ANALYTICS_RULES_CONFIG.json).
- [Quy tắc sự kiện đã thống nhất](../QUY_TAC_NHAN_DIEN_SU_KIEN_CHAY.md).

Tài liệu này bổ sung và có ưu tiên cho **ngưỡng hiển thị, tổng đếm trên bản đồ, tương tác zoom và hợp đồng trình bày**. Nó không thay thế phương pháp bất thường hoặc tự phê duyệt những ngưỡng khoa học đang null trong cấu hình nghiên cứu.

Những điều phải sửa cách diễn giải khi tích hợp tài liệu cũ:

| Nội dung tài liệu nhận được | Quyết định khi triển khai giao diện |
|---|---|
| Nêu backend đang chạy pipeline 1.0 | Đây là thông tin được báo cáo ở workspace khác; đọc manifest của backend triển khai thực tế, không hardcode 1.0 |
| Đề xuất loại mọi type=0 nằm trong static mask | Không tự áp dụng vì chỉ đang chốt giao diện. Theo filterVersion thực tế và cho biết chính sách static |
| Có thể cộng eventCount của các cell | Chỉ được cộng khi sự kiện đã có một ô chủ sở hữu duy nhất; nếu dùng giao nhau với nhiều ô phải COUNT DISTINCT eventId |
| Ví dụ sự kiện đến 07/2026 | Đọc eventDataThrough và coverage theo nguồn thực tế. Sau mốc đó là chưa có dữ liệu sự kiện, không phải 0 |
| Kết quả Pettitt, nhãn HIGH/LOW và test vector đã báo cáo | Không coi là đã tái kiểm định trong lần làm tài liệu này |
| Chưa thể cảnh báo cấp ô/ngày theo cấu hình rank hiện có | Không suy rộng thành bất khả thi cho mọi phương pháp; giữ tính năng này tắt trong phiên bản hiện tại |
| Ngưỡng hiển thị chưa có | Chốt theo các bảng dưới đây, độc lập với ngưỡng bất thường |

## 3. Ba lớp bản đồ và đơn vị

| Lớp | Metric | Số trên biểu tượng | Vai trò |
|---|---|---|---|
| Sự kiện cháy ước tính | `event_count_clear` | Số eventId duy nhất, liên kết rõ | Khám phá vị trí và tần suất sự kiện |
| Điểm phát hiện | `detection_count` | Số detectionId duy nhất theo bộ lọc | Xem ghi nhận vệ tinh, bao gồm lớp NRT riêng |
| Hoạt động quy đổi | `snpp_eq` | Số lượt phát hiện tương đương S-NPP | So sánh xu hướng dài hạn |

Chế độ Khám phá mặc định đề xuất lớp sự kiện nếu có dữ liệu; nếu chưa có, hiển thị thông báo và nút chuyển lớp, không tự đổi đơn vị trên cùng nhãn. Chế độ So sánh dài hạn mặc định lớp `snpp_eq` nếu có chuỗi phù hợp.

Không gọi số detection hoặc snpp_eq là số vụ cháy. Sự kiện ước tính cũng chưa phải đám cháy đã xác nhận. Không dùng FRP để quyết định ô nào vượt ngưỡng đếm; FRP là thuộc tính của dữ liệu đầu vào/chi tiết.

## 4. Định nghĩa “một nơi” và cách đếm không trùng

### 4.1. Ô dùng xét ngưỡng

```text
cy = floor(latitude / 0.25)
cx = floor(longitude / 0.25)
cellId = cy + "_" + cx
```

Biên ô dùng khoảng nửa kín: [south,north) × [west,east). Dùng tọa độ WGS84. Ô 0,25° có kích thước hàng chục kilomet ở Việt Nam; biểu tượng tổng hợp đặt ở tâm ô không phải vị trí đám cháy. Khi hover/click phải tô ranh giới ô.

### 4.2. Detection

Đếm detectionId duy nhất sau khi áp dụng bộ lọc và chính sách archive/NRT superseded. Nhiều vệ tinh quan sát cùng vùng vẫn là nhiều detection nếu chưa có quy tắc hợp nhất; không gọi là nhiều sự kiện.

Mỗi detection thuộc đúng một ô theo tọa độ tâm pixel. Không lọc bằng cờ `in_json` một cách mặc định; phải dùng bộ lọc và filterVersion rõ ràng. File xuất chỉ chứa một phần detection không đủ để khẳng định tổng toàn bộ v1.6.

### 4.3. Sự kiện

Artifact sự kiện phải có eventId, thành viên detection, trạng thái liên kết và phiên bản thuật toán. Chỉ `CLEAR` vào `event_count_clear`; nhóm chưa rõ liên kết được báo cáo riêng.

**Vị trí đại diện ổn định:** chọn detection đạt bộ lọc được ghi nhận sớm nhất trong toàn bộ sự kiện; nếu trùng giờ, chọn detectionId nhỏ nhất theo thứ tự từ điển. Tọa độ này là vị trí đại diện quan sát, không phải điểm khởi phát cháy thực tế. Không đổi vị trí đại diện khi zoom hoặc khi đổi tháng.

**Ô sở hữu:** ô chứa vị trí đại diện trên. Mỗi sự kiện chỉ có một ô sở hữu trong cùng phiên bản dữ liệu. Nếu archive thay NRT làm thay đổi sự kiện, tạo phiên bản mới và làm mới toàn bộ tổng hợp liên quan.

**Sự kiện được ghi nhận trong kỳ:** có ít nhất một detection thành viên đạt bộ lọc trong khoảng thời gian đã chọn. Không chỉ dùng phép giao khoảng first/last vì khoảng giữa có thể không được quan sát.

```text
event_count_clear(cell, period)
  = COUNT DISTINCT eventId
    WHERE ownerCell = cell
      AND linkStatus = CLEAR
      AND EXISTS eligible detection in period
```

Sự kiện xuyên hai tháng có thể được tính một lần ở mỗi tháng nhưng chỉ một lần trong năm. **Không cộng số sự kiện tháng để lấy số sự kiện năm.** Backend phải đếm DISTINCT trên kỳ đích.

Vùng chọn mặc định dùng vị trí đại diện sự kiện để cộng được các ô. Chức năng “sự kiện có detection giao vùng” là truy vấn riêng, dùng DISTINCT và ghi rõ cách chọn; không so trực tiếp với tổng theo ô sở hữu.

Chi tiết vùng phải cảnh báo khi có sự kiện giao vùng nhưng vị trí đại diện nằm ngoài vùng. Lớp detection giúp người dùng xem những ghi nhận tại chỗ này.

## 5. Bảng ngưỡng chính: sự kiện cháy ước tính

Ngưỡng là **từ T trở lên (`count >= T`)**, không phải lớn hơn T. Zoom z là zoom liên tục của bản đồ; chọn dải theo các khoảng nửa kín dưới đây.

| Mức zoom | Phạm vi nhìn gần đúng | Ngày | Tháng | Mùa/quý | Năm |
|---|---|---:|---:|---:|---:|
| 0 ≤ z < 6 | Toàn quốc/rất rộng | 2 | 5 | 10 | **30** |
| 6 ≤ z < 8 | Vùng rộng | 1 | 3 | 7 | **20** |
| 8 ≤ z < 10 | Cấp tỉnh và lân cận | 1 | 2 | 3 | **10** |
| 10 ≤ z < 11 | Khu vực gần | 1 | 1 | 2 | **5** |
| z ≥ 11 | Chi tiết | **1** | **1** | **1** | **1** |

Các mô tả địa lý chỉ để giải thích, không thay thế zoom số. Kích thước màn hình và vĩ độ có thể khiến cùng zoom bao phủ các phạm vi khác nhau.

Lý do chọn: 30/năm và 5/tháng giúp ưu tiên nơi có hoạt động lặp lại khi xem rộng; ngày giữ ngưỡng thấp để không làm bản đồ gần như trống; zoom sâu luôn cho tiếp cận sự kiện đơn lẻ. Đây là quyết định thiết kế, không phải ngưỡng khoa học hoặc đã tối ưu từ phân bố dữ liệu.

## 6. Bảng ngưỡng lớp detection

Không dùng bảng sự kiện cho detection vì một sự kiện có thể tạo nhiều lượt phát hiện.

| Mức zoom | Ngày | Tháng | Mùa/quý | Năm |
|---|---:|---:|---:|---:|
| 0 ≤ z < 6 | 5 | 20 | 50 | 100 |
| 6 ≤ z < 8 | 3 | 10 | 25 | 50 |
| 8 ≤ z < 10 | 2 | 5 | 10 | 20 |
| 10 ≤ z < 11 | 1 | 2 | 5 | 10 |
| z ≥ 11 | 1 | 1 | 1 | 1 |

Lớp “NRT chưa xác định loại” dùng cùng bảng để giảm mật độ biểu tượng nhưng tách màu/ký hiệu và tổng riêng; không cộng vào số sự kiện cháy thực vật.

## 7. Lớp snpp_eq

- Không áp dụng ngưỡng 30 sự kiện hoặc 100 detection cho snpp_eq.
- Vẽ polygon ô cho mọi giá trị hợp lệ >0; giá trị 0 và thiếu dữ liệu có trạng thái riêng.
- Zoom không chia nhỏ giá trị 0,25° hoặc sinh vị trí cháy giả ở tâm ô.
- Không làm tròn trước khi tô màu hay xét điều kiện: 0,01 vẫn khác 0.
- Đọc đúng nguồn cell–tháng, không cộng snpp_eq bị lặp trên các dòng CSV detection.
- Nếu chỉ có số liệu theo tháng: hỗ trợ tháng, mùa gồm tháng trọn vẹn và năm đủ tháng. Không tự chia tháng xuống ngày hoặc cắt một phần tháng.
- Trong JSON ô–tháng, danh sách detection có thể khác tập điểm dùng tính snpp_eq; số phần tử không thay thế snpp_eq.

Mặc định tô màu theo `log1p(snpp_eq)` để giảm việc vài ô lớn lấn át các ô nhỏ. Miền màu lấy trên toàn vùng dữ liệu của kỳ, không tính lại theo viewport; khi so sánh hai kỳ dùng miền chung của hai kỳ. Chú giải phải ghi “thang log, lượt tương đương S-NPP”, tooltip luôn ghi giá trị thật. Nếu toàn bộ giá trị hợp lệ bằng 0, dùng một màu trung tính và bỏ phép chuẩn hóa chia cho 0.

## 8. Thời kỳ chưa hoàn tất và khoảng tùy chọn

### 8.1. Lịch và độ mới

Ngày lớp detection/sự kiện theo Asia/Ho_Chi_Minh, khoảng [00:00 ngày đầu,00:00 ngày sau ngày cuối). Backend đổi sang UTC để truy vấn. Không lấy `lst` thay múi giờ dân sự. Nhánh B giữ quy ước thời gian của artifact và công bố rõ nếu khác.

Đọc dataThrough riêng từng lớp. Không hardcode dữ liệu luôn kết thúc 07/2026 hay 13/11/2026.

### 8.2. Kỳ đang diễn ra

Cho phép hai lựa chọn: “Cả kỳ” và “Đến ngày dữ liệu mới nhất”. Khi kỳ chưa hoàn tất, mặc định lựa chọn thứ hai.

Với tháng/mùa/năm bị cắt ở cuối do chưa tới ngày dữ liệu:

```text
T_effective = max(1, ceil(T_full * elapsedCalendarDays / totalCalendarDays))
```

Ví dụ năm 2026 tại zoom 5, mới có dữ liệu đến 31/01: ceil(30×31/365)=3. Đây chỉ là giảm ngưỡng hiển thị, không ngoại suy tổng năm và không điều chỉnh mùa vụ. Ngày lẻ đang diễn ra luôn dùng ngưỡng ngày, không chia theo số giờ.

Nếu dữ liệu có lỗ hổng bên trong kỳ, không lấy số ngày có detection làm elapsedDays và không giảm ngưỡng để che việc thiếu quan sát. Giữ nhãn thiếu dữ liệu. Nếu người dùng chọn kỳ hoàn toàn ngoài dữ liệu, trả unavailable, không áp công thức ra 1.

### 8.3. Khoảng tùy chọn

| Số ngày được chọn | Bảng gốc | Hệ số |
|---|---|---|
| 1 | Ngày | 1 |
| 2–31 | Tháng | N/30 |
| 32–120 | Mùa/quý | N/90 |
| 121 trở lên | Năm | N/365 |

T = max(1, ceil(T_bảng × hệ số)). Dùng N là số ngày lịch thực sự truy vấn; không áp thêm công thức kỳ partial lần thứ hai. Mùa định danh dùng bảng mùa trực tiếp, dù dài khác 90 ngày; công thức N/90 chỉ dùng khoảng tùy chọn.

## 9. Cách vẽ theo zoom và hành vi khi click

### 9.1. Zoom dưới 11

- Xét ngưỡng trên từng ô 0,25° trước.
- Vẽ tâm và đường viền ô đủ ngưỡng. Tooltip: “Ô thống kê — X sự kiện ước tính được ghi nhận trong kỳ”.
- Có thể gom các biểu tượng ô đủ ngưỡng theo khoảng cách màn hình **48 CSS px**. Đây là gom biểu tượng, không phải thuật toán gom đám cháy 1 km.
- Số trên cụm biểu tượng bằng tổng số sự kiện của các ô đủ ngưỡng thuộc cụm, nhờ ô sở hữu không trùng. Kèm `cellCount` để phân biệt số ô và số sự kiện.
- Ô dưới ngưỡng không được gom trước rồi cộng thành cụm vượt ngưỡng. Trình tự bắt buộc: lọc ô → gom biểu tượng.

### 9.2. Zoom từ 11 trở lên

- Ngưỡng về 1, hiện vị trí đại diện sự kiện hoặc tâm pixel detection theo lớp đang chọn.
- Vẫn gom biểu tượng 48 px nếu chồng nhau. Với một vị trí có 100 eventId khác nhau trong năm, cụm có nhãn 100; không ép hiển thị 100 chấm trùng tọa độ.
- Click cụm: zoom tới phạm vi thành viên hoặc mở danh sách nếu mọi tọa độ trùng nhau. Không lặp vô hạn zoom.
- Zoom ≥14: cho phép tách biểu tượng trùng vị trí kiểu spiderfy tối đa **50 thành viên**; lớn hơn mở danh sách phân trang 50. Đường nối chỉ là đồ họa, không phải tọa độ mới.
- Click sự kiện: hiện detection thành viên, first/last observed, vệ tinh, FRP theo từng quan sát và trạng thái liên kết. Không biến bounding box thành diện tích cháy.

### 9.3. Chọn một điểm/ô cụ thể

- Tìm kiếm hoặc click ô sẽ mở panel với **toàn bộ số liệu của vùng chọn**, không chỉ dữ liệu vượt ngưỡng.
- Nút “Xem chi tiết tại đây” đưa ngưỡng vùng chọn về 1 và zoom tối thiểu 11; khu vực ngoài vùng chọn vẫn theo chế độ hiện tại.
- Nếu không muốn đổi zoom, panel vẫn hiển thị tất cả bản ghi và ghi “Bản đồ đang lọc từ T”.
- Selection không bị mất chỉ vì ngưỡng mới làm biểu tượng không còn hiện.

## 10. Nhãn, kích thước và màu

Ngưỡng chỉ quyết định hiện/ẩn. Màu/kích thước thể hiện số lượng, không thể hiện xác suất hay mức nguy hiểm.

| Count trên biểu tượng | Đường kính CSS px | Mức màu |
|---|---:|---|
| 1 | 12 | 1 |
| 2–4 | 18 | 2 |
| 5–9 | 24 | 3 |
| 10–29 | 30 | 4 |
| 30–99 | 36 | 5 |
| 100 trở lên | 44 | 6 |

Sự kiện: dải tím tăng đậm `#F2F0F7, #DADAEB, #BCBDDC, #9E9AC8, #756BB1, #54278F`; chữ tối ở mức 1–3, chữ trắng mức 4–6. Detection: ký hiệu tròn khác, dải xanh lam; NRT thiếu type: vòng rỗng có nhãn NRT. Có chú giải tên metric và đơn vị ở mọi chế độ.

Nhãn ≥1.000 có thể rút gọn (1,2k) nhưng tooltip trả số nguyên đầy đủ. Không đổi đơn vị vì đổi zoom. Vùng bấm tối thiểu 44×44 px dù hình vẽ nhỏ hơn.

Nhãn HIGH/LOW từ analytics là lớp độc lập, dùng viền/chip chữ. Không coi ô 100 sự kiện là HIGH nếu không có đánh giá thống kê hợp lệ. Không tự tạo nhãn bất thường cấp ô/ngày từ ngưỡng hiển thị.

## 11. Tổng số, nơi bị ẩn và hiệu năng

Luôn tách:

- `totalInSelection`: toàn bộ số lượng trong vùng và kỳ, trước ngưỡng hiển thị.
- `visibleByThreshold`: số lượng thuộc ô đạt ngưỡng.
- `hiddenByThreshold`: số lượng thuộc ô không đạt ngưỡng.
- `renderedFeatureCount`: số biểu tượng sau gom màn hình; không phải số sự kiện.
- `ambiguousCount`, `unclassifiedTypeCount`: riêng, không cộng vào eventCountClear.

Với cùng một tập ô sở hữu: totalInSelection = visibleByThreshold + hiddenByThreshold. Không dùng renderedFeatureCount để đối chiếu tổng metric.

Với viewport chi tiết, dùng vị trí đại diện để xác định trong viewport; tiêu chí của một ô vẫn tính trên toàn ô, không trên phần ô vừa lọt màn hình. Truy vấn có buffer để gom biểu tượng qua rìa tile; ID phải ổn định, không đếm trùng tile.

Giới hạn kỹ thuật khởi đầu:

| Thành phần | Giá trị |
|---|---:|
| Biểu tượng trước khi phải gom thêm | 500 trên một viewport |
| Bán kính gom màn hình | 48 px mặc định; tăng lên 64, 80, 96 nếu cần |
| Danh sách chi tiết | 50 dòng/trang |
| Độ trễ chờ sau thao tác bản đồ | 250 ms |
| Khoảng tối đa cho lớp raw detection không gom | 31 ngày |

Nếu vẫn trên 500 biểu tượng, dùng tile tổng hợp hoặc phân trang không gian có nhãn; không tự lấy top 500 và làm mất phần còn lại. Tháng/năm vẫn xem được detection qua tổng hợp; raw của khoảng dài hơn 31 ngày cần người dùng chọn khoảng nhỏ trong panel. Sự kiện năm vẫn xem qua đại diện/cụm, không tải mọi detection thành viên ngay.

Nút “Hiện tất cả” đưa ngưỡng về 1, không vô hiệu hóa gom màn hình và không tải 2 triệu điểm vào trình duyệt.

Request mới thay request cũ; bỏ response cũ khi người dùng đã đổi kỳ/lớp. Backend tính tổng, frontend không suy tổng từ những tile đã tải.

## 12. So sánh hai thời kỳ

1. Khóa cùng vùng, tập ô, metric, bộ lọc, phiên bản sự kiện và zoom.
2. Tính ngưỡng riêng cho thời lượng mỗi kỳ; dùng **min(T_A,T_B)** làm ngưỡng chung để không che kỳ ngắn hơn. Ghi ngưỡng chung trên cả hai panel.
3. Lấy tập ô **hợp** đạt ngưỡng ở A hoặc B. Cả hai bản đồ vẽ cùng tập ô này.
4. Một bên bằng 0 vẫn giữ ô trung tính; null là gạch chéo. Không ẩn ô ở bên thấp để tạo cảm giác biến mất hoàn toàn.
5. Dùng cùng thang màu. Tổng và delta dựa toàn vùng chưa lọc, không chỉ ô đang hiện.
6. Nếu dùng lớp sự kiện, số liệu giữa nhiều tháng là DISTINCT trên từng kỳ; không cộng các tổng tháng. So sánh dài hạn nhiều cảm biến phải có cảnh báo khác biệt quan sát; lớp snpp_eq là lựa chọn ưu tiên cho xu hướng.
7. Kỳ đang diễn ra phải so cùng phần lịch tương ứng. Mẫu số bằng 0: deltaPct=null, ghi “từ 0 lên X”; không tạo vô hạn hay thêm epsilon.

Ngưỡng hiển thị không quyết định differenceAvailable. Quyết định đủ điều kiện so sánh thuộc analytics contract.

## 13. Thiếu dữ liệu và ngoại lệ

| Trường hợp | Giao diện |
|---|---|
| Có dữ liệu nhưng mọi ô dưới ngưỡng | “Không có ô đạt ngưỡng T; có X sự kiện dưới ngưỡng”, kèm Hiện tất cả |
| Có dữ liệu hợp lệ, không có phát hiện | “Không ghi nhận phát hiện trong dữ liệu”; không ghi không cháy/an toàn |
| Ngoài phạm vi artifact sự kiện | “Chưa có dữ liệu sự kiện cho kỳ này”; eventCount=null |
| Chỉ có NRT thiếu type | Lớp điểm nóng NRT riêng; không suy type=0 từ static=False |
| Thiếu thông tin mây | Hiện cờ chất lượng; không tự xem mọi ngày là được quan sát đầy đủ |
| Ô có snpp_eq nhưng detections rỗng | Hiện ở lớp quy đổi; không tạo sự kiện/detection giả |
| Static/type mâu thuẫn | Theo filterVersion; giữ cờ để kiểm tra, không đổi bằng thao tác zoom |
| Chưa đủ baseline | Vẫn hiển thị số lượng; nhãn bất thường là chưa đủ lịch sử |
| Backend chậm/lỗi | Hiện trạng thái tải/lỗi; không trả bản đồ trắng có số 0 |

Thông báo ngưỡng luôn xuất hiện: **“Đang hiển thị ô có từ T [đơn vị] trong [kỳ]. Zoom gần hoặc chọn Hiện tất cả để xem ít hơn.”**

## 14. Hợp đồng API bổ sung

Đề xuất endpoint: `GET /api/v1/map/activity`. Đây là đặc tả mới, chưa tuyên bố backend đã có.

Đầu vào: `metric`, `startDate`, `endDateExclusive`, `periodType`, `timezone`, `zoom`, `bbox` hoặc selection, `showAll`, `filterVersion`, `eventRuleVersion`, `dataVersion`. Cache key gồm toàn bộ phiên bản và chế độ so sánh nếu có.

Backend trả ngưỡng đã áp dụng, tổng trước/sau lọc và representation; frontend không tự suy ngưỡng khác. `source` của cell–tháng không thay cho satellite của detection.

Ví dụ giả định (dữ liệu minh họa, không phải số đã đo):

```json
{
  "metric": "event_count_clear",
  "unit": "estimated_events",
  "period": {
    "type": "year",
    "startDate": "2025-01-01",
    "endDateExclusive": "2026-01-01",
    "timezone": "Asia/Ho_Chi_Minh",
    "complete": true
  },
  "display": {
    "ruleVersion": "map-display-v1.0",
    "zoom": 5,
    "thresholdBase": 30,
    "thresholdEffective": 30,
    "operator": ">=",
    "thresholdUnit": "events_per_owner_cell_per_period",
    "cellSizeDegrees": 0.25,
    "representation": "cell_markers",
    "showAll": false
  },
  "summary": {
    "totalInSelection": 136,
    "visibleByThreshold": 100,
    "hiddenByThreshold": 36,
    "renderedFeatureCount": 1,
    "ambiguousCount": 0
  },
  "features": [
    {
      "id": "cell:61_435",
      "cellId": "61_435",
      "geometryRole": "cell_center",
      "longitude": 108.875,
      "latitude": 15.375,
      "count": 100,
      "valueStatus": "AVAILABLE",
      "classification": "NOT_ASSESSED"
    }
  ],
  "qualityFlags": ["NO_CLOUD_INFORMATION"],
  "meta": {
    "example": true,
    "dataVersion": "example-snapshot",
    "filterVersion": "event-filter-v1",
    "eventRuleVersion": "experimental_v1",
    "eventOwnershipVersion": "first-observation-v1",
    "computedAtUtc": "2026-11-15T00:00:00Z"
  }
}
```

Chế độ unavailable giữ summary giá trị null và status cụ thể. Không dùng ví dụ trên làm fixture production khi chưa thay bằng artifact thực tế.

## 15. Pseudocode triển khai

```text
validate metric, time range, versions, coverage
load eligible records using the scientific filter (never a zoom filter)
if metric == events:
    select CLEAR eventIds with observations in requested period
    assign each to its stable ownerCell
    count DISTINCT eventId per ownerCell
elif metric == detections:
    count DISTINCT detectionId per cell
else:
    read and aggregate genuine cell-period snpp_eq once per period

compute full selection summary
if metric == snpp_eq:
    draw available cell polygons; do not invent points
else:
    threshold = table(metric, periodType, zoom)
    apply partial/custom-period adjustment exactly once
    if showAll or focusedSelection: threshold = 1 for that scope
    eligibleCells = cells with count >= threshold
    compute visible and hidden totals before screen clustering
    if zoom < 11: generate cell-center features
    else: generate individual event representatives / detection centers
    cluster eligible features for display only
return features, complete totals, threshold, coverage, versions
```

## 16. Ví dụ hành vi và tiêu chí nghiệm thu

Tất cả số dưới đây là tình huống giả định để test.

| ID | Đầu vào | Kết quả bắt buộc |
|---|---|---|
| MAP-01 | Năm, z=5; ô A=100, B=25, C=9, D=2 sự kiện | Hiện A; tổng=136, hiện=100, ẩn=36 |
| MAP-02 | Cùng dữ liệu, z=7 | Ngưỡng20; hiện A+B=125; ẩn11 |
| MAP-03 | Cùng dữ liệu, z=9 | Ngưỡng10; hiện A+B; C=9 vẫn ẩn |
| MAP-04 | Cùng dữ liệu, z=10 | Ngưỡng5; hiện A+B+C=134 |
| MAP-05 | Cùng dữ liệu, z=11 | Ngưỡng1; tiếp cận đủ136, có thể gom biểu tượng |
| MAP-06 | Năm, z=5, count=29/30/31 | 29 ẩn; 30 và31 hiện |
| MAP-07 | Tháng, z=5, count=4/5 | 4 ẩn;5 hiện |
| MAP-08 | Ngày, z=5, ô có1 sự kiện | Ẩn nhưng tính trong tổng; z=6 hoặc Hiện tất cả thì hiện |
| MAP-09 | Tìm kiếm ô có2 sự kiện/năm ở z=5 | Panel hiện2; Xem chi tiết đưa vùng chọn về ngưỡng1 |
| MAP-10 | 1 sự kiện có100 detection | Nhãn sự kiện=1; nhãn detection=100, không đánh tráo |
| MAP-11 | 1 sự kiện có detection ở2 cell | Đếm1 ở ô sở hữu; tổng vùng=1, chi tiết có thể thấy cả2 ô |
| MAP-12 | 1 sự kiện được quan sát ở2 tháng cùng năm | Mỗi tháng=1; năm DISTINCT=1, không bằng2 |
| MAP-13 | 4 ô mỗi ô10 sự kiện, năm z=5 | Tất cả dưới30; không gom thành40 rồi cho hiện |
| MAP-14 | 100 sự kiện cùng tọa độ, z=14 | Cụm100 + danh sách50/trang; không ép spiderfy100 |
| MAP-15 | Năm2026 chỉ có31 ngày đầu, z=5 | Ngưỡng hiệu lực3; ghi Đến31/01, không ngoại suy tổng năm |
| MAP-16 | Giữa kỳ có mất quan sát | Không tính ngày detection thay coverage; hiện chất lượng thiếu |
| MAP-17 | So năm A=35, B=2 cùng ô, z=5 | Ô hiện ở cả hai panel nhờ hợp tập; ghi35 và2 |
| MAP-18 | Một bên missing, bên kia35 | Missing là null/gạch chéo, delta unavailable |
| MAP-19 | snpp_eq=0,01, detections=[] | Polygon quy đổi có0,01; không có sự kiện giả |
| MAP-20 | Hơn500 biểu tượng | Gom thêm/tile; tổng không giảm; không cắt top500 |
| MAP-21 | Pan bản đồ cùng kỳ | Tổng của selection cố định không thay đổi; viewport total có thể đổi và phải có nhãn riêng |
| MAP-22 | Zoom5,99→6,00 | Chuyển dải đúng biên; totalInSelection không đổi |
| MAP-23 | NRT thiếu type | Không thêm vào event_count_clear; hiển thị lớp NRT riêng |
| MAP-24 | Artifact sự kiện chưa có | Hiện chưa sẵn sàng; không dùng len(detections) làm eventCount |
| MAP-25 | Đổi từ sự kiện sang detection | Đổi bảng ngưỡng, chú giải, đơn vị và tổng đồng thời |
| MAP-26 | Count lớn nhưng analytics=TYPICAL | Giữ TYPICAL; không tự nâng HIGH vì ngưỡng giao diện |
| MAP-27 | Request cũ trả sau request mới | Không ghi đè kỳ/zoom mới bằng dữ liệu cũ |
| MAP-28 | Hai nguồn dữ liệu khác version | Chặn so sánh hoặc yêu cầu đồng bộ, không im lặng trộn |

## 17. Cấu hình chốt để sao chép khi triển khai

```json
{
  "displayRuleVersion": "map-display-v1.0",
  "thresholdBasis": "fixed_0.25deg_cell",
  "comparisonOperator": ">=",
  "zoomBreaks": [6, 8, 10, 11],
  "thresholds": {
    "event_count_clear": {
      "day": [2, 1, 1, 1, 1],
      "month": [5, 3, 2, 1, 1],
      "season": [10, 7, 3, 2, 1],
      "year": [30, 20, 10, 5, 1]
    },
    "detection_count": {
      "day": [5, 3, 2, 1, 1],
      "month": [20, 10, 5, 2, 1],
      "season": [50, 25, 10, 5, 1],
      "year": [100, 50, 20, 10, 1]
    }
  },
  "snppEqThreshold": null,
  "showAllThreshold": 1,
  "detailZoom": 11,
  "spiderfyMinZoom": 14,
  "spiderfyLimit": 50,
  "screenClusterRadiusPx": [48, 64, 80, 96],
  "targetMaxRenderedFeatures": 500,
  "detailPageSize": 50,
  "requestDebounceMs": 250,
  "rawDetectionMaxDays": 31,
  "eventOwnershipVersion": "first-observation-v1",
  "countEventsBy": "distinct_event_id_with_observation_in_period",
  "ambiguousEventsIncluded": false,
  "partialThresholdPolicy": "ceil_scaled_calendar_fraction_min_1",
  "comparisonCellPolicy": "union_above_shared_min_threshold",
  "thresholdPurpose": "display_only",
  "parameterStatus": "project_choice_not_empirically_optimized"
}
```

Mảng 5 phần tử tương ứng 5 dải zoom trong bảng. Quý dùng cấu hình season. Các giá trị null của nghiên cứu analytics không được thay bằng bảng ngưỡng này.

## 18. Thứ tự triển khai và giới hạn hoàn tất

1. Xác minh manifest thực tế và khả năng truy cập detection, eventId, membership, cell–tháng. Tài liệu nghiên cứu có số tổng sự kiện không đồng nghĩa backend đã có artifact eventId để vẽ.
2. Tạo vị trí đại diện/ô sở hữu sự kiện và aggregate DISTINCT offline; không gom sự kiện lại khi người dùng zoom.
3. Backend triển khai endpoint bản đồ, ngưỡng, tổng trước/sau lọc, phiên bản và các trạng thái unavailable.
4. Frontend triển khai 3 lớp, 5 dải zoom, nút Hiện tất cả, chi tiết và so sánh hợp tập.
5. Chạy MAP-01…MAP-28 và kiểm tra trên điện thoại/máy tính.
6. Đo số feature, độ trễ, tỷ lệ ẩn và khả năng người dùng tìm được điểm quan tâm. Nếu điều chỉnh ngưỡng sau thử nghiệm, tăng displayRuleVersion; không đổi eventRuleVersion nếu thuật toán sự kiện không đổi.

Tài liệu này hoàn tất phần quyết định hiển thị. Nó không chứng nhận các phép kiểm định khoa học trong gói nghiên cứu, không tuyên bố ứng dụng đã được triển khai, và không chuyển các giới hạn dữ liệu thành con số giả.
