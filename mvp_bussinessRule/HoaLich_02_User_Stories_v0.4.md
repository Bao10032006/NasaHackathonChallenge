---
subtitle: User Stories & Acceptance Criteria
title: HỎA LỊCH
version: v0.4-proposed
updated: 2026-11-14
language: vi
status: frontend-aligned proposal; backend approval pending
---

**PRODUCT REQUIREMENTS · DOCUMENT 02 · v0.4 PROPOSED**

# 1. Quy ước

Must là phạm vi luồng demo v0.4. Should/Could không được chặn Must. Mọi story dùng metric `snpp_eq` và cùng snapshot/version.

# 2. Backlog

- US01 — Chọn vùng có sẵn hoặc vùng khoanh · Must
- US02 — Chọn năm, tháng, pentad hoặc ngày · Must
- US03 — Xem đường 12 tháng và thẻ tóm tắt · Must
- US04 — Xem bản đồ lưới theo năm/tháng/pentad/ngày · Must
- US05 — Xem lịch ngày của một tháng · Must
- US06 — Xem trends và seasonality lịch sử · Must
- US07 — Đối chiếu hai bản đồ cùng kỳ · Must
- US08 — Xem chi tiết nguồn của cell/kỳ · Must
- US09 — Hiểu nguồn và giới hạn · Must
- US10 — Anomaly/rank lịch sử · Should
- US11 — Export hoặc lưu custom area · Could

# 3. Detailed User Stories

## US01. Chọn vùng có sẵn hoặc vùng khoanh | Must

Là người dùng, tôi muốn mọi visual dùng đúng cùng một phạm vi cell.

**Acceptance Criteria**

- Hỗ trợ national, diagnostic region, cell hoặc bounding box.
- Bounding box được resolve trên toàn bộ 587 cell, không bị giới hạn vào Tây Nguyên hay một diagnostic region; một khung có thể cắt qua nhiều vùng.
- Bounding box gồm `west,south,east,north`; chọn tâm cell nằm trong hoặc trên biên.
- Named area và bbox loại trừ nhau; biên sai trả validation error, không tự đảo.
- Response trả requested bounds, selected bounds, rule, count và ordered `cellIds`.
- Không có cell trả `NO_CELLS_IN_BOUNDS`.
- Cùng bbox + dataVersion luôn trả cùng ordered cell set.

## US02. Chọn năm, tháng, pentad hoặc ngày | Must

**Acceptance Criteria**

- Map nhận đúng một selector: `date`, `year`, `year+month` hoặc `year+pentad`.
- Calendar năm trả 12 tháng hoặc 73 pentad; calendar days trả đủ ngày lịch của một tháng.
- Exact date ngoài dataset bị từ chối ở `/daily` và map; placeholder ngoài range trong calendar days dùng `value=null`.
- Kỳ partial trả requested/covered range và số ngày covered/uncovered.

## US03. Xem đường 12 tháng và thẻ tóm tắt | Must

**Acceptance Criteria**

- Năm trả tổng năm, coverage và tháng peak.
- Tháng trả tổng tháng, coverage và ngày peak.
- Ngày trả tổng ngày và source composition.
- Summary calendar dùng field typed `peakPeriod`; summary lịch ngày dùng `peakDate`; không dùng field `peak` đa hình và không lặp `partial` ngoài coverage.
- Peak chỉ xét item `AVAILABLE`; tie lấy mốc sớm nhất.
- Nếu không có item hợp lệ hoặc mọi item hợp lệ bằng 0, peak là `null`.
- Item con partial bị loại khỏi peak. Nếu kỳ cha partial nhưng có item con đầy đủ, peak được phép trả và UI phải ghi “trong khoảng đã có dữ liệu”.

## US04. Xem bản đồ lưới | Must

**Acceptance Criteria**

- Mỗi cell có stable `cellId`, bounds, value/status, partial và origin khi available.
- Map response có summary toàn selection: total/origin/coverage và min/max cell available để frontend dựng thẻ tổng hợp và shared color scale.
- Date có source code/input fields; period aggregate không giả là raw observation.
- Marker ở tâm cell chỉ là ký hiệu lưới; không gọi là tọa độ phát hiện gốc.
- Năm 2000/2026 và tháng 11/2026 thể hiện coverage partial.

## US05. Xem lịch ngày của tháng | Must

**Acceptance Criteria**

- Một request trả 28–31 ngày, xử lý đúng năm nhuận.
- Ngày trong range có giá trị khớp `/daily` và tổng map date trên cùng selection.
- Ngày ngoài range vẫn có calendar item nhưng `value=null`, `valueStatus=OUTSIDE_DATASET_RANGE` và không click sang `/daily`.
- Giá trị 0 trong range vẫn `AVAILABLE`.
- `sourceInputValid=false` không bị đếm là missing.

## US06. Xem trends và seasonality | Must

**Acceptance Criteria**

- Trends hỗ trợ named area và bbox; cùng tháng/pentad qua nhiều năm.
- Seasonality trả mean, median, sample size và reference years.
- Median 2003–2025 là baseline mặc định; loại missing/partial.
- Khi so với target year nằm trong reference range, loại target year khỏi baseline và công bố `excludesTargetYear=true`; zero hợp lệ vẫn tham gia.
- Chưa yêu cầu seasonal aggregate hoặc percentile/rank.

## US07. Đối chiếu hai bản đồ | Must

**Acceptance Criteria**

- Frontend gọi `/map/cells` hai lần với cùng spatial selector và cùng month ở hai year.
- Chỉ ghép khi cùng dataVersion, modelVersion, metric, unit và ordered cell set.
- Delta cell chỉ có khi cả hai available và hai coverage tương thích.
- Nếu một kỳ partial không thể cắt về cùng cửa sổ, vẫn hiển thị hai map nhưng ẩn delta và nêu reason.
- Frontend dùng chung color scale và đồng bộ pan/zoom.

## US08. Xem chi tiết nguồn của cell/kỳ | Must

**Acceptance Criteria**

- Click cell gọi cell-period details, không tải composition cho toàn bộ map mặc định.
- Trả source composition theo code/origin, harmonized value, input count và validity count.
- Period có nhiều origin trả `MIXED` ở aggregate nhưng giữ từng component.
- Không trả raw detection coordinates/timestamps không có trong artifact.

## US09. Hiểu nguồn và giới hạn | Must

**Acceptance Criteria**

- Giải thích FIRMS, `snpp_eq`, four-source dictionary, grid và version.
- Phân biệt direct/scaled/model-redistributed/mixed.
- Công bố daily uncertainty interval không có và daily validation chủ yếu ở month/pentad.
- Raw-versus-harmonized comparison không bắt buộc trong demo.

## US10. Anomaly hoặc rank lịch sử | Should

Chỉ triển khai sau khi method, threshold/rank, minimum sample size và copywriting được duyệt.

## US11. Export hoặc persisted custom area | Could

Không chặn core. MVP gửi lại bbox thay vì lưu custom area server-side.

# 4. Traceability

- US01 → FR01, FR02, BR11–BR13.
- US02 → FR03, FR04, FR05.
- US03 → FR06.
- US04 → FR04.
- US05 → FR05.
- US06 → FR07, FR08.
- US07 → FR09.
- US08 → FR10.
- US09 → FR11.
- US10 → FR12.
- US11 → FR13.
