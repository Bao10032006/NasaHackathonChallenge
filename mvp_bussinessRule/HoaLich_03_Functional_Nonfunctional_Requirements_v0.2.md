---
subtitle: Functional & Non-functional Requirements
title: HỎA LỊCH
version: v0.2
updated: 2026-11-14
language: vi
---

**PRODUCT / ENGINEERING SPECIFICATION · DOCUMENT 03 · v0.2**

# 1. Mục tiêu và quy ước

Đặc tả yêu cầu có thể kiểm thử cho MVP Hỏa Lịch. Chỉ số chuẩn là `snpp_eq` — số phát hiện ban ngày, đã lọc nguồn tĩnh, tương đương S-NPP. Chỉ số này không phải số vụ cháy, diện tích cháy, fire risk hoặc dự báo.

Must phải hoàn thành cho luồng demo cốt lõi. Should chỉ triển khai sau khi dependency được chốt. Could/Discovery không được làm chậm Must.

# 2. Functional Requirements

| ID | Ưu tiên / US | Chức năng | Yêu cầu có thể kiểm thử |
|---|---|---|---|
| FR01 | Must / US01 | Chọn phạm vi | Cho phép chọn `ToanQuoc`, 5 vùng chẩn đoán hoặc cell 0,25° có trong dataset; không coi vùng chẩn đoán là ranh giới hành chính. |
| FR02 | Must / US02 | Lọc thời gian | Cho phép chọn năm và granularity `month`/`pentad` trong metadata; filter áp dụng đồng bộ và kỳ ngoài phạm vi bị từ chối. |
| FR03 | Must / US03 | Calendar | Hiển thị heatmap theo tháng/pentad với `snpp_eq`, legend, tooltip/click, `missing`, `zero` và `partial`. |
| FR04 | Must / US04 | Bản đồ lưới | Hiển thị giá trị theo cell 0,25° cho kỳ đã chọn; không tạo hotspot/tọa độ giả từ giá trị tổng hợp. |
| FR05 | Must / US05 | Trends | Trả chuỗi nhiều năm cho cùng metric/area/period, kèm coverage và partial cho từng điểm. |
| FR06 | Must / US03, US05 | Seasonality và historical comparison | Cung cấp baseline cùng kỳ, khoảng năm tham chiếu, sample size và chênh lệch của kỳ được chọn; chưa tự gắn nhãn anomaly. |
| FR07 | Must / US07 | Nguồn và giới hạn | Giải thích FIRMS, MODIS–VIIRS, `snpp_eq`, `k_cell=60`, lưới, time granularity, missing/partial và giới hạn sử dụng. |
| FR08 | Must / US01–US05 | Đồng bộ trạng thái | Một filter state quản lý area, year, granularity và period; calendar/map/trends/comparison phải dùng cùng state; có reset/loading/empty/error. |
| FR09 | Should / US06 | Chỉ báo anomaly | Chỉ bật khi method, threshold, reference years và minimum sample size được cấu hình, công bố và kiểm thử. |
| FR10 | Should / US08 | Chi tiết cell | Click cell để xem ID, bounds, period, value/status, metric và data version; không gán provenance chi tiết hơn nguồn. |
| FR11 | Could / US09 | Export CSV | Xuất đúng dữ liệu theo filter, giữ missing, kèm unit/status/version/source note. |
| FR12 | Must / US07 | Minh chứng harmonization | Hiển thị một so sánh raw versus harmonized từ artifact đối chứng đã kiểm tra và giải thích giới hạn so sánh. |
| FR13 | Discovery / US10 | Day View readiness | Không đưa `day` vào UI/API production trước khi hoàn thành data review, contract, validation và copywriting về observed/estimated. |

# 3. Quy tắc seasonality và historical comparison

- Comparison luôn dùng cùng area và cùng seasonal period: tháng với cùng tháng, pentad với cùng pentad.
- Response phải chứa `baselineMethod`, `referenceStartYear`, `referenceEndYear`, `sampleSize` và coverage/status.
- Phiên bản v0.2 đề xuất median làm baseline mặc định vì bền vững hơn với năm cực trị; đây phải là cấu hình/metadata, không hardcode ngầm trong UI.
- Kỳ missing hoặc không đủ coverage không tham gia baseline. Giá trị `0` hợp lệ vẫn được giữ.
- Năm mục tiêu có thể bị loại khỏi baseline để tránh tự so sánh với chính nó; hành vi phải được khai báo trong contract.
- Phần Must chỉ trình bày value, baseline và delta. Việc gọi là “anomaly” thuộc FR09.

# 4. Quy tắc anomaly — gated Should

Trước khi bật FR09, nhóm phải chốt và ghi version cho:

- Baseline method và reference period.
- Ngưỡng: percentile, robust score hoặc quy tắc khác.
- Minimum sample size và xử lý các năm partial/transition.
- Cách xử lý baseline bằng `0`, tied values và uncertainty.
- Nhãn UI trung tính, ví dụ “cao hơn ngưỡng lịch sử cùng kỳ”; không dùng “cảnh báo cháy”.

Khi chưa đủ điều kiện, API/UI trả hoặc hiển thị `insufficient_baseline`, không suy diễn kết quả.

# 5. Data & Business Rules

- **BR01:** `snpp_eq` là số thập phân có thể do mô hình ước lượng; không làm tròn thành số vụ cháy.
- **BR02:** `missing`/không có bản ghi khác `0`; lỗi API cũng không được biểu diễn như `0`.
- **BR03:** các năm/kỳ đầu-cuối chuỗi và transition cần metadata `partial`/warning thích hợp.
- **BR04:** vùng `DBSCL`, `TayNguyen`, `TayBac`, `DBSH`, `Khac` là vùng chẩn đoán, không phải địa giới hành chính.
- **BR05:** không cộng thô nhiều vệ tinh để tạo metric harmonized; sử dụng artifact do pipeline phát hành.
- **BR06:** nhãn source tổng hợp không chứng minh provenance cho từng cell/ngày.
- **BR07:** pentad 1..73 theo ngày-trong-năm; pentad 73 gồm ngày 366 ở năm nhuận.
- **BR08:** không trộn FRP, brightness hoặc confidence xuyên cảm biến vào `snpp_eq`.
- **BR09:** Day View, nếu được duyệt, phải công bố phần nào là quan sát và phần nào là phân bổ/ước lượng từ mô hình cấp tháng.
- **BR10:** minh chứng raw/harmonized phải dùng cùng phạm vi và định nghĩa, không trình bày raw merged count như metric có thể so sánh trực tiếp.

# 6. Non-functional Requirements

| ID | Nhóm | Mục tiêu chấp nhận |
|---|---|---|
| NFR01 | Hiệu năng | API thống kê nhẹ có mục tiêu p95 ≤ 2 giây trên máy demo với 5 request đồng thời; phải đo trước khi công bố. |
| NFR02 | Khả dụng | Luồng chính hoạt động trên Chrome/Edge mới, desktop 1366px và mobile ≥375px; không có cuộn ngang ngoài vùng dữ liệu chủ ý. |
| NFR03 | Nhất quán | Giá trị kiểm tra khớp artifact nguồn trong sai số làm tròn 0,01; missing/zero/partial nhất quán mọi tầng. |
| NFR04 | Giải thích | Mỗi visual có metric, unit, period, area, legend, source/version và warning phù hợp. |
| NFR05 | Độ bền | Thiếu file, schema sai hoặc query lỗi phải cho error rõ; không trả payload hợp lệ giả. |
| NFR06 | Bảo mật MVP | Public read-only API, validate area/time/filter, không có secret trong frontend, giới hạn query hợp lý. |
| NFR07 | Tái lập | Công bố `dataVersion`, `modelVersion`, `dataThrough`, hash/manifest và baseline/anomaly method version nếu có. |
| NFR08 | Tiếp cận | Không truyền đạt mức hoạt động chỉ bằng màu; có nhãn/số và keyboard focus cho control. |
| NFR09 | Khả năng truy vết | Mỗi response/visual quan trọng truy được về artifact và rule tạo ra nó. |

# 7. Definition of Done cho Must

- US01–US05 và US07 chạy xuyên suốt với dữ liệu thật.
- Calendar, map, trends và comparison dùng cùng filter state.
- Seasonality có baseline, reference years và sample size; không chỉ là một biểu đồ một năm.
- Có minh chứng raw/harmonized đã đối chiếu và lời giải thích đúng giới hạn khoa học.
- Missing, zero, partial và lỗi được kiểm thử riêng.
- Không có Day View hoặc anomaly label nếu readiness gate chưa đạt.
- API và UI cùng metric/unit/version; các test mẫu đối chiếu được về CSV/JSON/NPZ phát hành.

# 8. Traceability Summary

- US01 → FR01, FR08.
- US02 → FR02, FR08.
- US03 → FR03, FR06.
- US04 → FR04, FR08.
- US05 → FR05, FR06.
- US06 → FR09.
- US07 → FR07, FR12.
- US08 → FR10.
- US09 → FR11.
- US10 → FR13.

