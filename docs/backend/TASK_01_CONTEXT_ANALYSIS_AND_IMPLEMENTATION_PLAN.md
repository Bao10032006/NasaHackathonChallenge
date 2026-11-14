# TASK 01 — Phân tích bối cảnh Backend và kế hoạch triển khai Hỏa Lịch

Ngày phân tích: 14/11/2026  
Phạm vi: chỉ phân tích, kiểm tra dữ liệu và lập kế hoạch; chưa thay đổi mã nguồn backend hoặc dataset.

## Quy ước bằng chứng

- **[Tài liệu]**: thông tin được xác nhận trong bộ đặc tả hoặc tài liệu bàn giao.
- **[Dữ liệu]**: thông tin đã được kiểm tra trực tiếp từ artifact hiện có trong workspace.
- **[Khuyến nghị]**: quyết định kỹ thuật được đề xuất cho backend, chưa phải yêu cầu kinh doanh đã phê duyệt.
- **[Chưa chốt]**: điểm mơ hồ, thiếu bằng chứng hoặc cần Product/Data/Frontend xác nhận.

## 1. Executive Summary

**[Tài liệu]** Hỏa Lịch là nền tảng web phân tích lịch sử hoạt động cháy tại Việt Nam từ dữ liệu NASA FIRMS MODIS/VIIRS đã được hài hòa. Sản phẩm giải quyết vấn đề số phát hiện giữa các thế hệ cảm biến không thể cộng hoặc so sánh trực tiếp. Chỉ số chuẩn là `snpp_eq`: số phát hiện ban ngày, đã lọc nguồn nhiệt tĩnh, tương đương S-NPP VIIRS. Chỉ số này không phải số vụ cháy, diện tích cháy, tọa độ của một đám cháy ước lượng hay dự báo rủi ro tương lai.

**[Dữ liệu]** Workspace có đủ bảy tài liệu đặc tả bắt buộc, ba tài liệu bàn giao chính, README và `summary.json` của dataset. Dataset v1 chứa 587 ô lưới 0,25°, 27 năm lịch 2000–2026, 183.731 bản ghi ô–tháng, 11.406 bản ghi vùng–pentad và khối ô–pentad cho web. Tập cell giữa `cells_025.csv`, `harmonized_025_month.csv` và `web_cells_pentad.json` khớp hoàn toàn. Tổng năm tính từ CSV ô–tháng lệch tối đa 0,96 so với bảng năm quốc gia do làm tròn ở cấp ô; tổng năm/vùng/ô vì vậy phải ưu tiên bảng tổng hợp đã xuất khi có.

**[Dữ liệu]** Workspace không trống như giả định ban đầu: `backend/` đã có Spring Boot skeleton. Skeleton chưa có endpoint hay loader, nhưng `pom.xml` hiện đồng thời khai báo MVC, WebFlux và JDBC Session; cấu hình này không phù hợp API read-only tối giản. Maven Wrapper trên Windows thất bại ngay ở lệnh lấy phiên bản. Không nên tạo project mới hoặc ghi đè skeleton; Phase 1 nên ổn định skeleton hiện có.

**[Kết luận readiness]** Dữ liệu và yêu cầu đủ để bắt đầu Phase 1 (ổn định project/build) và Phase 2 (dataset loader/index). Chưa nên triển khai ngay toàn bộ controller trước khi chốt riêng các điểm contract: schema response chi tiết cho `/metadata`, `/areas`, `/map/cells`, `/trends`; quy tắc `partial`; cách tổng hợp `lo90`/`hi90` và `src`; tên `dataVersion`/`modelVersion`; ý nghĩa source code `0` trong JSON pentad.

**[Khuyến nghị]** Kiến trúc MVP nên là một Spring Boot monolith dùng Spring MVC, load một lần các artifact nhẹ vào immutable in-memory indexes, không dùng database/JPA/Spring Security/Redis/Kafka. Java 21 và Spring Boot 4.1.2 là lựa chọn phù hợp với skeleton và máy hiện tại; máy có JDK 21, trong khi `JAVA_HOME` đang trỏ JDK 26. Spring Boot 4.1.2 chính thức hỗ trợ Java 17–27, nhưng target Java 21 giúp môi trường build/deploy ổn định hơn.

## 2. Workspace & Documentation Inventory

### 2.1. Cấu trúc thực tế

| Đường dẫn | Hiện trạng đã kiểm tra | Tác động |
|---|---|---|
| `backend/` | Có Maven/Spring Boot skeleton, source main/test và dataset | Không khởi tạo project mới; ổn định project hiện có |
| `backend/hoalich_data_v1/hoalich_data_v1/` | Dataset bị lồng hai cấp cùng tên | Data path phải externalize; không hard-code giả định một cấp |
| `datahandoff/` | Có ba tài liệu bàn giao chính | Nguồn giải thích khoa học và provenance |
| `mvp_bussinessRule/` | Có đủ bảy tài liệu đặc tả v0.1 | Nguồn yêu cầu/API/UI/technical plan |
| `frontend/` | Thư mục rỗng | Không có frontend implementation để kiểm tra contract usage |
| `README.md`, `Hello.txt` | File rỗng | Không có hướng dẫn root-level bổ sung |
| `docs/backend/` | Chưa tồn tại trước Task 01 | Được tạo chỉ để chứa báo cáo này |

Git worktree sạch tại thời điểm bắt đầu phân tích. Không có `AGENTS.md` trong repository. Không có file báo cáo cùng tên trước khi tạo.

### 2.2. Tài liệu yêu cầu đã đọc

Tất cả tài liệu bắt buộc đều có mặt:

1. `mvp_bussinessRule/HoaLich_00_AI_README.md`
2. `mvp_bussinessRule/HoaLich_01_Product_Vision_and_Scope_v0.1.md`
3. `mvp_bussinessRule/HoaLich_02_User_Stories_v0.1.md`
4. `mvp_bussinessRule/HoaLich_03_Functional_Nonfunctional_Requirements_v0.1.md`
5. `mvp_bussinessRule/HoaLich_04_API_Data_Contract_v0.1.md`
6. `mvp_bussinessRule/HoaLich_05_UIUX_User_Flow_Wireframe_v0.1.md`
7. `mvp_bussinessRule/HoaLich_06_Technical_Design_Implementation_Plan_v0.1.md`
8. `datahandoff/HANDOFF_CONTEXT.md`
9. `datahandoff/HUONG_DAN_CHUAN_HOA_MODIS_VIIRS.md`
10. `datahandoff/hoalich_README.md`
11. `backend/hoalich_data_v1/hoalich_data_v1/README.md`
12. `backend/hoalich_data_v1/hoalich_data_v1/summary.json`

Hai bản `hoalich_README.md` có cùng SHA-256, nên là cùng một nội dung. Không có tài liệu bắt buộc nào trong danh sách Task 01 bị thiếu.

### 2.3. Tài liệu/artifact được dẫn chiếu nhưng không có trong workspace

Các file sau được handoff nhắc đến nhưng không tìm thấy: `K_VALIDATION_REPORT.md`, `tune_shrinkage.py`, `export_harmonized_with_detections.py` và `harmonized_with_detections.json` khoảng 1,08 GB. Việc thiếu JSON lớn không chặn MVP và phù hợp chủ trương không load raw/original detections. Việc thiếu báo cáo tuning làm cho đề xuất `k_cell=100` chỉ có thể được ghi nhận theo handoff, không thể kiểm tra sâu trong Task 01.

### 2.4. Backend skeleton và môi trường phát triển

**Đã có:**

- `backend/pom.xml`: Spring Boot `4.1.2`, target Java `21`.
- `BackendApplication.java`: chỉ có entry point `@SpringBootApplication`.
- `BackendApplicationTests.java`: chỉ có `contextLoads()`.
- `application.properties`: chỉ có `spring.application.name=backend`.
- Không có controller, service, DTO, loader, exception handler hoặc API implementation.

**Vấn đề hiện tại:**

- `pom.xml` cùng lúc dùng `spring-boot-starter-webmvc` và `spring-boot-starter-webflux`; MVP chỉ cần Spring MVC.
- Có `spring-boot-starter-session-jdbc` và test tương ứng dù không có login/session/database.
- Các starter test bị tách theo MVC/WebFlux/JDBC Session thay vì một test setup tối giản.
- `backend/mvnw.cmd -version` thất bại với lỗi PowerShell `Cannot index into a null array`; system Maven 3.9.16 vẫn có mặt nhưng chưa chạy build vì Task 01 không được tạo `target/`.
- Máy có JDK 21.0.12 và JDK 26.0.2; `JAVA_HOME`, `java`, `javac`, Maven hiện dùng JDK 26.0.2. POM target 21.

**[Khuyến nghị]** Giữ Java target 21; giữ Spring Boot 4.1.2 vì đây là bản stable hiện có và tương thích Java 17–27 theo [Spring Boot System Requirements](https://docs.spring.io/spring-boot/system-requirements.html). Phase 1 phải làm cho Wrapper chạy được và pin môi trường CI/container về JDK 21.

### 2.5. Kiểm định đã thực hiện trong Task 01

Các kiểm tra chỉ-đọc đã thực hiện:

- Đếm file, kích thước, header/schema, row count, unique key, null/empty và zero trên sáu artifact chính.
- Kiểm tra tập 587 cell khớp giữa bốn vị trí dữ liệu.
- Kiểm tra mỗi cell có đúng 313 bản ghi tháng; mỗi vùng có 1.901 pentad khả dụng.
- Đối chiếu tổng năm CSV ô–tháng với `harmonized_national_year.csv`.
- Đối chiếu tổng năm vùng chẩn đoán với `ToanQuoc` theo từng pentad; sai khác tối đa 0,02 do làm tròn.
- Đối chiếu source sequence của JSON với CSV vùng; không có mismatch.
- Tính SHA-256 của sáu artifact chính để dùng làm bằng chứng snapshot trong báo cáo.

`verify_outputs.py` đã được gọi nhưng không chạy được vì Python hiện tại thiếu `numpy`; lỗi thực tế là `ModuleNotFoundError: No module named 'numpy'`. Vì vậy Task 01 **không tuyên bố script kiểm định đã PASS trong môi trường hiện tại**. `summary.json` và handoff ghi Gate 2/PASS là kết quả do đội dữ liệu bàn giao, không phải kết quả test mới của backend.

## 3. Product and Backend Requirements Understanding

### 3.1. Vấn đề sản phẩm và người dùng

**[Tài liệu]** MODIS và VIIRS khác nhau về độ phân giải, độ nhạy, quỹ đạo và coverage. Ghép thô số phát hiện tạo bước nhảy giả quanh thời điểm xuất hiện S-NPP. Hỏa Lịch chuyển chuỗi nhiều cảm biến về một thước đo có thể so sánh hơn và trình bày nó qua lịch mùa vụ, bản đồ ô lưới và xu hướng lịch sử.

Nhóm người dùng mục tiêu:

- Primary: cán bộ quản lý rừng/môi trường, người lập kế hoạch giám sát.
- Secondary: nhà nghiên cứu, sinh viên và người quan tâm lịch sử hoạt động cháy.
- **[Chưa chốt]** Hai nhóm này là giả định sản phẩm, chưa được xác nhận bằng phỏng vấn/nghiên cứu người dùng.

### 3.2. Phạm vi MVP

**Must-have:**

- Chọn `ToanQuoc`, 5 vùng chẩn đoán hoặc một cell hợp lệ.
- Lọc năm và month/pentad trong phạm vi snapshot.
- Calendar hoạt động cháy theo month/pentad.
- Map heatmap theo ô 0,25°.
- Trends/so sánh lịch sử cùng metric.
- Metadata, nguồn, phương pháp, giới hạn và trạng thái partial/missing.
- Loading/empty/error/partial semantics nhất quán với frontend.

**Should-have, sau core:** anomaly cùng mùa (US06/FR08), chi tiết cell (US08/FR09), minh chứng harmonization (FR11).

**Could-have:** export CSV (US09/FR10).

**Ngoài MVP:** AI forecasting, real-time alert, risk score tương lai, xác định số vụ cháy thật, burned area, thay thế hệ thống giám sát chính thức, authentication/authorization, ranh giới tỉnh/huyện, truy vấn raw detections khoảng 1 GB.

### 3.3. User Stories phụ thuộc backend

| User Story | FR liên quan | Backend dependency | Endpoint dự kiến | Mức sẵn sàng |
|---|---|---|---|---|
| US01 chọn khu vực | FR01, FR07 | Danh mục area/cell và validation quan hệ type–id | `/api/v1/areas`, mọi endpoint có area filter | Sẵn sàng từ `cells_025.csv` |
| US02 lọc thời gian | FR02, FR07 | Dataset range, validation month/pentad/year, partial flags | `/metadata`, `/calendar`, `/map/cells`, `/trends` | Sẵn sàng nhưng cần chốt partial schema |
| US03 calendar | FR03 | Query month/pentad theo area; bảo toàn missing/zero | `/calendar` | Sẵn sàng; region-month cần aggregation |
| US04 map | FR04 | Slice 587 cell theo một kỳ; bounds và status | `/map/cells` | Sẵn sàng |
| US05 trends | FR05 | Chuỗi month/year cùng metric; cảnh báo partial | `/trends` | Sẵn sàng; response schema chưa đủ chi tiết |
| US06 anomaly | FR08 | Baseline cùng mùa, ngưỡng, minimum years | `/anomalies` | Chưa được phê duyệt rule; không làm core |
| US07 nguồn/phương pháp | FR06, FR11 | Metadata/version/method limitations | `/metadata` và nội dung tĩnh frontend | Core metadata sẵn sàng; version fields cần chốt |
| US08 cell detail | FR09 | Cell metadata + một ô–tháng | `/cells/{cellId}` | Có thể làm sau core |
| US09 export | FR10 | Reuse filter/query service, CSV metadata | `/export.csv` | Có thể làm nhưng Could |

### 3.4. Functional requirements tác động backend

- FR01–FR05 và FR06 là core backend trực tiếp.
- FR07 chủ yếu là frontend state, nhưng backend phải dùng cùng vocabulary/filter validation trên mọi endpoint.
- FR08 không được bật trước khi baseline, minimum sample và threshold được chốt.
- FR09 có dữ liệu cell/month; không được nâng độ chính xác địa lý thành điểm cháy.
- FR10 phải tái sử dụng đúng query result của chart; không tự biến null thành zero.
- FR11 có thể dùng các số đối chứng trong `summary.json`/evidence, nhưng chưa có response schema chính thức.

### 3.5. Non-functional requirements tác động backend

| NFR | Hệ quả backend |
|---|---|
| NFR01 p95 ≤ 2 giây, 5 concurrent requests | Load/index một lần; không đọc toàn file mỗi request; benchmark trên máy demo trước khi công bố |
| NFR03 consistency ±0,01 | Dùng precomputed aggregate khi có; test đối chiếu actual row; định nghĩa rounding rõ |
| NFR05 resilience | Fail fast khi dataset startup sai; log có ngữ cảnh; trả error payload, không trả zero giả |
| NFR06 public read-only | Validate enum/id/range; rate limit ở reverse proxy/platform; không cần Spring Security cho MVP |
| NFR07 reproducibility | Externalize data path/version, kiểm hash/manifest, công bố `k_cell=60` và `dataThrough` |
| NFR04/NFR08 explainability/accessibility | API phải trả unit, warning/status dạng text/data; frontend không phụ thuộc riêng vào màu |
| NFR02 responsive UI | Chủ yếu frontend; backend cần payload đủ nhỏ cho mobile và không gửi toàn bộ history khi không cần |

### 3.6. Yêu cầu khoa học/dữ liệu chưa được xác minh độc lập

- Chất lượng mô hình so với ground truth ngoài thực địa chưa được chứng minh; validation chủ yếu là so với S-NPP/chuỗi vệ tinh.
- Static mask có thể loại cháy thực cùng ô 0,01° với nguồn nhiệt tĩnh.
- Exposure/outage là suy luận thống kê, không phải cloud/coverage mask chính thức.
- Pentad lịch sử trước S-NPP được phân bổ từ tháng xuống ngày, không có cùng mức xác thực với quan sát S-NPP.
- Anomaly baseline/ngưỡng chưa chốt.
- `k_cell=100` chỉ là đề xuất tuning; sản phẩm thực tế vẫn là `k_cell=60`.
- `lo90`/`hi90` là phân vị sai số thực nghiệm; không phải bảo đảm coverage 90% cho mọi cell/kỳ.
- Người dùng mục tiêu và usefulness chưa được nghiên cứu thực địa.

### 3.7. Mâu thuẫn hoặc độ lệch giữa tài liệu và hiện trạng

| Vấn đề | Bằng chứng | Cách xử lý đề xuất |
|---|---|---|
| Task nói chưa tạo Spring Boot app, workspace đã có app | `backend/pom.xml`, main/test class | Bảo toàn, ổn định skeleton; không tạo project thứ hai |
| Skeleton có stack thừa so với quyết định tối giản | MVC + WebFlux + JDBC Session | Phase 1 chỉ giữ Spring MVC và test cần thiết |
| Tài liệu design gọi `regions_pentad.csv` | File thực là `harmonized_regions_pentad.csv` | Loader dùng tên thực; sửa tài liệu sau khi được duyệt, không tự rename file |
| Contract yêu cầu `dataVersion`, `modelVersion` | Artifact không có hai field canonical; ví dụ contract dùng `v1-k60` | Product/Data chốt string chính thức hoặc manifest |
| `src_codes` trong JSON chỉ mô tả 1–4 | `src` thực tế có code `0` tại 70 pentad ngoài coverage | Chốt `0 = missing/outside snapshot`, bổ sung contract/metadata trước code |
| `partial` chưa có thuật toán chung | 2000 chỉ từ 01/11; 2026 tới 13/11; pentad 64/2026 mới có 2 ngày; 2012 là transition | Định nghĩa partial theo year/period và warning matrix |
| `src` ở CSV tháng là nhãn cấp toàn miền | Có thể bị hiểu nhầm là provenance riêng từng cell | Không expose như per-cell provenance; chỉ trả limitation hoặc source cấp phù hợp |
| NFR03 yêu cầu tổng khớp trong 0,01 nhưng source cell đã làm tròn | Tổng năm cộng từ cell-month lệch tối đa 0,96 so với bảng national-year | Chỉ định source/cấp đối chiếu và tolerance theo phép tổng hợp; dùng precomputed aggregate khi có |
| API contract mới có JSON đầy đủ cho `/calendar` | Các endpoint khác chỉ mô tả high-level | Freeze response/error schemas cùng frontend trước controller |
| README nói verify PASS | Script hiện không chạy do thiếu `numpy` | Ghi nhận blocker môi trường; không tuyên bố test mới PASS |

Quyết định Java Spring Boot ngày 14/11/2026 là tài liệu mới nhất và có hiệu lực cao hơn các đề xuất cũ.

## 4. Actual Dataset Inventory & Schema Analysis

### 4.1. Tổng quan snapshot

Dataset root thực tế: `backend/hoalich_data_v1/hoalich_data_v1/`.

| Artifact | Kích thước | Records/shape | Vai trò backend |
|---|---:|---:|---|
| `web_cells_pentad.json` | 4.778.612 bytes (~4,78 MB) | 587 cell × 27 year × 73 pentad | Calendar cell-pentad, map pentad |
| `tables/harmonized_025_month.csv` | 6.902.487 bytes (~6,90 MB) | 183.731 data rows | Calendar/map/trends month |
| `tables/harmonized_regions_pentad.csv` | 473.066 bytes (~0,47 MB) | 11.406 rows | Calendar/trends pentad cho national/region |
| `tables/harmonized_national_year.csv` | 1.231 bytes | 27 rows | National yearly trends và đối chứng |
| `tables/cells_025.csv` | 27.854 bytes | 587 rows | Area list, center/bounds, region membership |
| `summary.json` | 29.330 bytes | 29 top-level fields | Metadata, model, coverage, validation summary |

Raw footprint của sáu artifact core chỉ khoảng 12,21 MB; in-memory indexing là hợp lý cho MVP. Không cần load `grid_025_*`, NPZ daily cube hoặc original detections vào runtime API core.

### 4.2. `web_cells_pentad.json`

**Đường dẫn:** `backend/hoalich_data_v1/hoalich_data_v1/web_cells_pentad.json`  
**SHA-256:** `24F00AC5FE28B0BF2A77583FB1459A34A2613BF5E60150E4004344FB46934343`

**Cấu trúc thực tế:**

- `meta`: object gồm `unit` (string), `grid_deg` (number), `model` (string), `years` (27 integers), mô tả pentad, `src_codes` và bảng uncertainty.
- `cells`: array 587 object `{id: string, lat: number, lon: number}`.
- `src`: array `[27][73]` gồm integer code; đây là sequence nguồn theo thời gian dùng chung, không phải object per-cell.
- `pentad`: object có 587 key là `cellId`; mỗi value là array `[27][73]` gồm number hoặc `null`.

**Record thực đã kiểm tra:**

```json
{
  "cell": "34_419",
  "year": 2000,
  "pentad": 62,
  "value": 0.0,
  "src": 1
}
```

Cell `34_419`, năm 2026, pentad 65 có `value: null`, `src: 0`. Cell cùng kỳ pentad 64 có `value: 0.0`, `src: 4` nhưng kỳ 64 chỉ mới có dữ liệu đến 13/11/2026 nên phải gắn partial, không được hiểu là đủ 5 ngày.

**Phạm vi/null/zero:**

- 1.156.977 slots tổng; 1.115.887 number và 41.090 `null`.
- 689.731 giá trị zero hợp lệ trong các slot có dữ liệu.
- Null pattern giống nhau ở toàn bộ 587 cell: 2000 pentad 1–61 và 2026 pentad 65–73, tổng 70 kỳ/cell.
- Min 0,0; max 850,2; số được làm tròn một chữ số thập phân.
- `src`: code 0 có 70 kỳ, code 1 có 127, code 2 có 692, code 3 có 1.070, code 4 có 12.

**Phụ thuộc endpoint:** `/calendar` cell+pentad, `/map/cells` pentad, `/trends` pentad nếu sau này contract cho phép. Phải join `cells_025.csv` để có region và bounds.

### 4.3. `harmonized_025_month.csv`

**Đường dẫn:** `backend/hoalich_data_v1/hoalich_data_v1/tables/harmonized_025_month.csv`  
**SHA-256:** `C6C93DCFB96B8820D237E8513463E56861B66A7CC577E2968F00FF3CB31F3197`

**Schema logic:** `cell:string`, `year:int`, `month:int`, `snpp_eq:decimal`, `lo90:decimal`, `hi90:decimal`, `src:enum-string`.

**Record thực:**

```text
cell=35_419, year=2024, month=3, snpp_eq=1.0,
lo90=1.0, hi90=1.0, src=snpp
```

Một zero thực: `34_419,2002,8,0.0,0.0,1.67,aqua_hieu_chuan`.

**Phạm vi/null/zero:**

- 183.731 row, unique key `(cell,year,month)`, không duplicate.
- 587 cell; mỗi cell đúng 313 tháng: 11–12/2000, toàn bộ 2001–2025, 1–11/2026.
- Không có empty field trong các row hiện hữu; absence ngoài phạm vi snapshot mới là missing.
- 54.023 row có `snpp_eq=0`; đây là zero hợp lệ.
- `snpp_eq` 0,0–1.184,46.
- Source rows: 12.327 `terra_noi_chuoi`, 66.918 `aqua_hieu_chuan`, 103.899 `snpp`, 587 `noaa20_quy_doi`.

**Phụ thuộc endpoint:** map tháng, calendar cell-tháng, trends tháng/cell; có thể aggregate theo region/national bằng membership trong `cells_025.csv`. Không cộng `lo90`/`hi90` một cách cơ học nếu chưa có quy tắc uncertainty aggregation.

### 4.4. `harmonized_regions_pentad.csv`

**Đường dẫn:** `backend/hoalich_data_v1/hoalich_data_v1/tables/harmonized_regions_pentad.csv`  
**SHA-256:** `77F741D51BD54E809DAAC7A9CBD77AEDF7F4D2584BCCB2D89FD1F6FD7AEDCD6A`

**Schema logic:** `vung:string-enum`, `year:int`, `pentad:int`, `snpp_eq:decimal`, `lo90:decimal`, `hi90:decimal`, `src:enum-string`.

**Record thực:**

```text
vung=TayNguyen, year=2024, pentad=15, snpp_eq=552.0,
lo90=552.0, hi90=552.0, src=snpp
```

Record latest national: `ToanQuoc,2026,64,6.93,6.93,6.93,noaa20_quy_doi`.

**Phạm vi/null/zero:**

- 11.406 row; 6 area (`ToanQuoc`, `DBSCL`, `DBSH`, `TayNguyen`, `TayBac`, `Khac`).
- Mỗi area có 1.901 kỳ: pentad 62–73/2000, 73 kỳ/năm 2001–2025, pentad 1–64/2026.
- Không empty field trong row hiện hữu; không có row ngoài coverage.
- 565 row có `snpp_eq=0`; max 9.199,16.
- Tổng 5 vùng so với `ToanQuoc` lệch tối đa 0,02 theo kỳ do rounding.

**Phụ thuộc endpoint:** calendar national/diagnostic-region pentad; trends/aggregation pentad; nguồn ưu tiên thay vì cộng lại cell khi cần số vùng chính thức.

### 4.5. `harmonized_national_year.csv`

**Đường dẫn:** `backend/hoalich_data_v1/hoalich_data_v1/tables/harmonized_national_year.csv`  
**SHA-256:** `01173AB52342BDF8C68B4F43AA0405CC42092ED1057712E0617B0456A5F1E3B6`

**Schema logic:**

- `year:int`
- `hai_hoa_snpp_eq:decimal`
- `kich_ban_cua_so_som_2012_16:nullable-decimal`
- `du_phong_ti_so_theo_o:nullable-decimal`
- `aqua_tho_ngay`, `terra_tho_ngay`, `snpp_tho_ngay`, `ghep_tho_moi_ve_tinh`: integer counts

**Record thực:** năm 2026 có `hai_hoa_snpp_eq=43794.9`, nhưng là tổng partial tới 13/11/2026. Hai cột kịch bản để trống ở 18/27 năm; empty này không được đổi thành zero.

**Phạm vi:** 27 unique year 2000–2026. Bảng là nguồn ưu tiên cho national yearly trend. Tổng từ CSV cell-month lệch tối đa 0,96 so với bảng này do rounding per-cell, nên không nên tái tổng hợp nếu endpoint có thể dùng giá trị chính thức đã xuất.

### 4.6. `cells_025.csv`

**Đường dẫn:** `backend/hoalich_data_v1/hoalich_data_v1/tables/cells_025.csv`  
**SHA-256:** `F10C77B7DEFA784F5204E6489744B8F354FA92380F5C62ACB994B1D31D953420`

**Schema logic:** `cell:string`, `cy:int`, `cx:int`, `lat:number`, `lon:number`, `lat_s:number`, `lon_w:number`, `region:enum-string`.

**Record thực:**

```text
cell=60_432, cy=60, cx=432, lat=15.125, lon=108.125,
lat_s=15.0, lon_w=108.0, region=TayNguyen
```

**Coverage:** 587 unique cell; center latitude 8,625–23,375; center longitude 102,125–109,375. Region membership: DBSCL 71, DBSH 33, TayNguyen 122, TayBac 99, Khac 262. `lat_s`/`lon_w` là mép nam/tây; mép bắc/đông có thể suy ra `+0.25`, nhưng contract cần thống nhất cách serialize `bounds`.

Các region là khung chẩn đoán, không phải tỉnh/huyện hay polygon hành chính.

### 4.7. `summary.json`

**Đường dẫn:** `backend/hoalich_data_v1/hoalich_data_v1/summary.json`  
**SHA-256:** `8493C9C8ED03BFF94302967950C479EC3DCBD04FD1B5DCA8633B09F793E9E3A0`

**Cấu trúc:** 29 top-level field, gồm scalar (`pipeline_version`, `grid_deg`, `unit`, `chosen_model`), object (`counts`, `records`, `model`, `source_months`, validation summaries, `gate2`) và array (`inputs`, gaps, validation/coverage). Có bốn nested null; null trong summary không đại diện trực tiếp cho calendar missing.

**Giá trị thực tiêu biểu:**

- `pipeline_version = "1.0"`
- `chosen_model = "lai_clim_s2"`
- `model.shrinkage.k_cell = 60`
- `counts.total = 2150162`, `duplicates_removed = 0`
- `counts.date_min = "2000-11-01 03:23:00"`
- `counts.date_max = "2026-11-13 08:39:00"`
- `source_months = {terra_noi_chuoi:21, aqua_hieu_chuan:114, snpp:177, noaa20_quy_doi:1}`
- `gate2` chứa bốn giá trị `PASS` do data pipeline bàn giao.

**Phụ thuộc endpoint:** `/metadata`, nguồn/warnings/method notes và regression fixtures. File không có canonical `dataVersion`, `modelVersion` hay manifest hash; backend không nên tự suy diễn các tên này mà không có quyết định contract.

### 4.8. Quy tắc dữ liệu đã xác nhận

- `snpp_eq` là count tương đương và có thể là số thập phân do ước lượng.
- Pipeline chọn một nguồn theo ô–ngày: Terra nối chuỗi → Aqua hiệu chuẩn → S-NPP → NOAA-20 quy đổi khi cần; không cộng thô vệ tinh chồng lấn.
- NOAA-21 dùng đối chứng/gap detection, chưa là nhánh cuối của chuỗi v1.
- Missing khác zero. JSON dùng null ngoài coverage; CSV dùng absence ngoài coverage; zero trong record phải giữ nguyên.
- 2000 và 2026 là partial; 2012 là năm transition S-NPP, không nhất thiết là partial toàn năm.
- Month và pentad là hai mức tổng hợp khác nhau; pentad 1–73 theo ngày-trong-năm, không phải tuần/tháng.
- Pentad 73 chứa ngày 361–365 và cả ngày 366 ở năm nhuận.
- Cell ID là `cy_cx`, 0,25°; tọa độ là center/bounds của ô, không phải tọa độ fire estimate.
- Snapshot hiện tại dùng `k_cell=60`; không thay bằng 100 nếu chưa rerun toàn pipeline.

## 5. API Contract Feasibility Matrix

Base path giữ nguyên `/api/v1`. Không đổi endpoint, enum hoặc field đã có trong Document 04.

### 5.1. Core endpoints

| Endpoint | Mục đích/US | Parameters và validation bắt buộc | Nguồn, filter/aggregation | Missing/partial/error | Feasibility |
|---|---|---|---|---|---|
| `GET /metadata` | US07/FR06 | Không có query param | `summary.json`, README/handoff, runtime manifest | Nêu 2000/2012/2026 warnings; 500 nếu snapshot load thất bại | **Có thể làm ngay**, sau khi chốt response schema và version strings |
| `GET /areas?type=` | US01/FR01 | `type` nếu có phải là `national`, `diagnostic_region`, `cell` | `cells_025.csv`; thêm `ToanQuoc` và 5 region | Empty list chỉ khi type hợp lệ nhưng không có; 400 enum sai | **Có thể làm ngay**; top-level response schema chưa được mô tả |
| `GET /calendar` | US02–US03/FR02–FR03 | Require `areaType`, `areaId`, `year`, `granularity`; type/id phải tương thích; year 2000–2026; granularity month/pentad | Region/national pentad đọc CSV vùng; cell pentad đọc JSON; cell month đọc CSV; region/national month sum cell theo region | Trả `value:null,status:missing` cho kỳ ngoài coverage; partial warning cho 2000/2026 và kỳ cuối; 400/404/422 theo contract | **Có thể**, nhưng region-month aggregation và partial flags phải test/chốt |
| `GET /map/cells` | US04/US08, FR04/FR09 | Require `year` và **đúng một** trong `month`/`pentad`; areaType/areaId đi cùng nhau; range 1–12 hoặc 1–73 | Month từ CSV; pentad từ JSON; join bounds/region từ cells CSV; area filter chọn subset cell | Null/status cho cell-period missing; partial warning; 422 nếu tổ hợp không khả dụng | **Có thể làm ngay**; response wrapper/bounds schema cần chốt |
| `GET /trends` | US05/FR05 | Require area type/id, startYear/endYear, granularity year/month; `startYear<=endYear`; within range | National-year dùng bảng năm; cell-month trực tiếp; region/national month aggregate; region/cell year aggregate cùng quy tắc | Point-level partial/coverage; không so 2026 như full year; missing giữ null | **Có thể**, nhưng schema series/coverage và year aggregation source cần chốt |

### 5.2. Optional endpoints

| Endpoint | Nguồn/logic | Trạng thái |
|---|---|---|
| `GET /cells/{cellId}?year=&month=` | `cells_025.csv` + monthly CSV; validate cell/year/month | Dữ liệu đủ; Should, triển khai sau core |
| `GET /anomalies` | History cùng area/season; median/threshold/min years | **Chưa implementable theo requirement đã duyệt** vì rule và threshold chưa chốt |
| `GET /export.csv` | Tái sử dụng query result của calendar/trends, thêm unit/version | Technically feasible; Could; cần size/column contract |

### 5.3. Expected response và contract gaps

**Đã có contract rõ nhất:** `/calendar` có `area`, `metric`, `granularity`, `year`, `values[{period,value,status}]`, `meta`.

**High-level fields đã được nêu:**

- Map cell: `cellId`, `bounds`, `snpp_eq`, `status`.
- Mọi response: `meta {dataVersion, modelVersion, dataThrough, partial, warnings, units}` hoặc tham chiếu metadata.
- Metric key phải là `snpp_eq`; display name và unit phải nhất quán.
- Error class: 400 invalid filter, 404 unsupported area, 422 unprocessable filter combination, 500 internal error.

**[Chưa chốt]** Document 04 chưa định nghĩa chính xác wrapper và field names cho `/metadata`, `/areas`, `/map/cells`, `/trends`, error body, pagination/ordering, `bounds` order, point-level `partial`, hoặc whether `lo90/hi90/src` xuất hiện. Đây là contract gap, không phải quyền cho backend tự đặt tên.

### 5.4. Validation matrix đề xuất để frontend/backend thống nhất

- `areaType=national` chỉ chấp nhận `areaId=ToanQuoc`.
- `areaType=diagnostic_region` chỉ chấp nhận 5 ID chính xác, case-sensitive.
- `areaType=cell` chỉ chấp nhận ID tồn tại trong `cells_025.csv`.
- Enum/range sai → 400; ID đúng format nhưng không tồn tại → 404.
- Filter hợp lệ về cú pháp nhưng artifact/granularity không thể phục vụ → 422.
- `/map/cells`: both `month` and `pentad`, hoặc thiếu cả hai → 400.
- Năm/kỳ ngoài snapshot → 400; kỳ nằm trong năm nhưng ngoài coverage snapshot nên trả missing/null hay 422 cần Product/API chốt. Khuyến nghị trả 200 với missing để calendar có đủ 12/73 slots, nhưng không tự coi đây là contract đã duyệt.
- Empty/missing data không được trả fabricated zero.

## 6. Proposed Spring Boot Architecture

### 6.1. Kiến trúc tối giản

```text
REST Controller -> Query Service -> Immutable DatasetSnapshot / Indexes
       |                 |                       |
       v                 v                       v
DTO + Validation   Area/Time Resolver      Startup Dataset Loader
       |
Global Exception Handler -> stable 4xx/5xx payload
```

**[Khuyến nghị]** Một application Spring MVC, không reactive, không persistence layer kiểu JPA. “Data access” ở đây là loader/index đọc file, không phải database repository.

### 6.2. Package/module đề xuất

Giữ base package hiện có `com.se201411.mvc.backend` để tránh rename không cần thiết trong MVP:

- `config`: `DatasetProperties`, CORS/configuration.
- `data`: CSV/JSON parser, `DatasetLoader`, immutable `DatasetSnapshot`, startup validator.
- `data.index`: indexes theo cell/area/year/month/pentad.
- `domain`: internal records cho cell, monthly value, pentad value, metadata.
- `service`: `AreaService`, `CalendarService`, `MapService`, `TrendService`, `MetadataService`.
- `web`: controllers và request parameter validation.
- `web.dto`: API DTO tách khỏi file schema.
- `web.error`: exception taxonomy và `@RestControllerAdvice`.
- `src/test`: loader fixtures, data integrity tests, MockMvc contract tests.

Không tạo `repository` JPA chỉ vì convention.

### 6.3. Loading và indexing

- Externalize root qua `hoalich.dataset.root`/environment variable; không hard-code đường dẫn lồng hiện tại.
- Load một lần khi startup; publish snapshot immutable chỉ sau khi tất cả validation pass.
- Parse JSON bằng Jackson và CSV bằng một parser chuẩn; không `split(',')` thủ công.
- Không đọc lại file mỗi request.
- Fail startup nếu thiếu file core, duplicate key, unknown cell/source, giá trị âm, `lo90 > snpp_eq`, `hi90 < snpp_eq`, hoặc cell sets lệch nhau.
- Cho phép `src=0` chỉ sau khi contract định nghĩa rõ missing code.

Indexes tối thiểu:

- `Map<CellId, CellMetadata>` cho area/bounds/region.
- `(cell,year) -> MonthlyValue[12]` và `(year,month) -> List<CellMonthlyValue>` dùng chung object references.
- `(area,year) -> PentadValue[73]` từ CSV vùng.
- `(cell,year) -> Double[73]` từ JSON pentad.
- `year -> NationalYearValue`.
- Precomputed cell IDs theo diagnostic region.

Raw core chỉ ~12,21 MB; kể cả object overhead, in-memory vẫn phù hợp máy demo. Nếu memory profiling sau này cho thấy JSON object graph quá lớn, có thể chuyển sang primitive arrays như nguồn NPZ/preconverted binary, nhưng không cần SQLite/database ở MVP.

### 6.4. Aggregation rules

- Ưu tiên precomputed `ToanQuoc`/region pentad và national-year khi có.
- Month region/national: sum `snpp_eq` của mỗi cell đúng một lần theo region membership.
- Không sum `src`; provenance phải được mô tả ở đúng cấp.
- Không sum interval endpoints `lo90`/`hi90` nếu Data team chưa duyệt phương pháp.
- Mọi aggregate phải giữ distinction: absent/null vs numeric zero.
- Rounding chỉ ở serialization/UI; service dùng precision đủ và regression tolerance theo source.

### 6.5. Stable API contract

- DTO explicit, không serialize trực tiếp CSV rows/internal classes.
- Centralize canonical enums/metric/unit/status/warning codes.
- Contract fixtures/MockMvc JSON assertions cho field names, order-independent structure và error body.
- Tạo một quyết định contract bổ sung thay vì tự sửa Document 04 trong code.
- Frontend dùng `/metadata` để giới hạn filter; không hard-code năm/cell list riêng.

### 6.6. Version, dependencies và deployment

- Java target 21; Spring Boot 4.1.2; Maven Wrapper phải hoạt động trên Windows và CI.
- Runtime dependencies core: Spring MVC, Bean Validation, JSON, một CSV parser. Không Session JDBC, WebFlux, JPA, Security.
- Dataset mount read-only ngoài JAR/container; config gồm root, expected data version, expected hashes và data-through.
- Deploy backend thành một container/JAR; frontend static hosting riêng; CORS giới hạn demo origin.
- Rate limit/gzip/cache headers ưu tiên ở reverse proxy/platform để tránh thêm framework phức tạp.
- Một replica là đủ cho demo; mọi state là immutable/read-only nên scale ngang đơn giản nếu cần.

## 7. Implementation Phases & Priorities

### Phase 1 — Stabilize Existing Project Initialization

**Mục tiêu:** làm skeleton hiện có build/test được, chỉ còn stack tối thiểu và có cấu hình dataset/version rõ ràng.

**Dependencies:** quyết định giữ Java 21 + Boot 4.1.2; không phụ thuộc API business.

**Files/modules dự kiến:** `pom.xml`, Maven Wrapper files nếu cần, `application.properties`/profile test, `DatasetProperties`, test context tối thiểu, README backend ngắn.

**US/FR:** nền tảng cho US01–US07; NFR05, NFR07.

**Acceptance criteria:**

- `mvnw test` chạy trên Windows và CI/JDK 21.
- Chỉ có Spring MVC web stack; không có JDBC Session/WebFlux/JPA/Security.
- Dataset path/version/data-through externalized.
- Chưa có endpoint business hoặc thuật toán harmonization.

**Tests:** wrapper version, clean test, context load, configuration binding failure/success.

**Risks/blockers:** Wrapper hiện lỗi; active JDK là 26 dù target 21; cần pin CI. Không được xóa skeleton/user changes không liên quan.

### Phase 2 — Data Integration and Immutable Indexes

**Mục tiêu:** load sáu artifact core, validate snapshot và xây indexes một lần.

**Dependencies:** Phase 1; quyết định `src=0`, canonical version strings và partial matrix.

**Files/modules dự kiến:** `data/*`, `domain/*`, fixtures nhỏ dưới test resources, integrity tests.

**US/FR:** US01–US05, US07; FR01–FR06; NFR01, NFR03, NFR05, NFR07.

**Acceptance criteria:**

- Loader thấy 587 cells, 183.731 month rows, 11.406 region-pentad rows, 27 national-year rows.
- Tập cell khớp bốn nguồn; duplicate/unknown/negative/bad interval fail startup.
- Null và zero được giữ riêng.
- Không đọc lại file khi service query.
- Data snapshot immutable và query concurrent an toàn.

**Tests:** actual-data smoke, schema corruption fixtures, null/zero fixture, 2000/2012/2026 coverage, three known records, hash/version mismatch.

**Risks/blockers:** object memory overhead; CSV rounding; path lồng; thiếu manifest chính thức; `verify_outputs.py` dependency chưa cài.

### Phase 3 — Core REST APIs

**Mục tiêu:** triển khai Must endpoints theo contract đã freeze: metadata, areas, calendar, map/cells, trends.

**Dependencies:** Phase 2; frontend/backend thống nhất response/error schema.

**Files/modules dự kiến:** `service/*`, `web/*`, DTOs, validation annotations/custom validators, exception handler, MockMvc tests.

**US/FR:** US01–US05, US07; FR01–FR07.

**Acceptance criteria:**

- URI/params/field/enum không đổi khỏi contract đã duyệt.
- Invalid range/type → 400; unsupported area → 404; unsupported combination → 422; internal data error → 500.
- 2026 response có partial warning; 2000 không có fabricated periods; transition 2012 có warning phù hợp.
- Month map record khớp source trong 0,01; national yearly trend dùng precomputed table.
- Không endpoint nào trả raw 1 GB hoặc fake coordinate.

**Tests:** API-T01–T06; controller integration; same-filter consistency; empty/missing/zero; Vietnamese UTF-8; concurrent read smoke.

**Risks/blockers:** incomplete response schema; aggregate interval/provenance; response payload của 587 cells cần đo nhưng vẫn nhỏ cho MVP.

### Phase 4 — Data Verification and Testing

**Mục tiêu:** chứng minh API phản ánh đúng artifact và xử lý các kỳ giới hạn.

**Dependencies:** Phase 3; Python environment hoặc independent Java checks.

**Files/modules dự kiến:** regression fixtures, data verification tests, performance test script/config; không sửa dataset.

**US/FR:** toàn bộ Must; NFR01, NFR03, NFR05, NFR07.

**Acceptance criteria:**

- Ít nhất ba sample xuyên 2000/2012/2024/2026 khớp source.
- Sum checks đạt tolerance đã định nghĩa; không dùng tolerance để che logic sai.
- `verify_outputs.py` chạy được trong môi trường data riêng hoặc kết quả handoff được lưu có provenance.
- p95 được đo thật trên máy demo với 5 concurrent requests trước khi tuyên bố NFR01 pass.

**Tests:** source-vs-API regression, boundary/partial, malformed data, startup failure, serialization of null, load/performance.

**Risks/blockers:** thiếu `numpy`/`pandas`; validation khoa học không tương đương ground-truth validation.

### Phase 5 — Frontend Integration, Optimization and Deployment

**Mục tiêu:** hoàn thành luồng demo Must, container/deploy ổn định và chỉ tối ưu theo số đo.

**Dependencies:** core API stable; demo frontend có client integration.

**Files/modules dự kiến:** CORS/deploy config, Dockerfile nếu team chọn container, API examples, operational README.

**US/FR:** US01–US05, US07; NFR01–NFR08 ở phạm vi liên quan backend.

**Acceptance criteria:**

- Demo Tây Nguyên 2024 chạy calendar → map → trends → metadata.
- Loading/empty/error/partial được frontend thể hiện từ API thật.
- Dataset mount read-only, startup validate, không có secret trong frontend.
- Smoke test deploy và rehearsal offline thành công.

**Tests:** frontend E2E phối hợp, CORS, payload size, cold-start, deployment smoke.

**Risks/blockers:** hosting owner/domain chưa chốt; CORS origin; memory limit của platform.

### Backlog sau Must

- **Should:** cell detail; anomaly chỉ sau khi approve baseline; harmonization evidence view.
- **Could:** export CSV.
- Không đưa Should/Could vào critical path của core demo.

## 8. Data Accuracy and Scientific Constraints

1. **Đơn vị:** luôn dùng “Số phát hiện tương đương S-NPP”; không dùng “số vụ cháy”.
2. **Harmonized vs original:** `snpp_eq` là chuỗi chọn/quy đổi nguồn; detections gốc từ nhiều vệ tinh không được cộng để tái tạo nó.
3. **Không double-count:** khi S-NPP hợp lệ thì dùng S-NPP; NOAA-20 chỉ fallback/quy đổi; Terra/Aqua là nhánh nối/ước lượng theo thời kỳ.
4. **Missing khác zero:** null/absence/status missing không được serialize thành `0`. Zero có trong artifact là giá trị hợp lệ.
5. **Partial:** dữ liệu bắt đầu 01/11/2000 và tới 13/11/2026. Pentad 64/2026 (12–16/11) chỉ có một phần; 2026 không so trực tiếp với full year.
6. **Transition 2012:** S-NPP bắt đầu 20/01/2012; đây là chuyển nguồn, cần warning/provenance phù hợp nhưng không mặc định gọi cả năm là thiếu.
7. **Thời gian:** `acq_date` là UTC; pentad theo day-of-year. Backend không được diễn giải pentad như tháng/tuần.
8. **Không gian:** cell 0,25° là vùng tổng hợp; center không phải điểm cháy. Không tạo tọa độ cho phần mô hình ước lượng.
9. **Diagnostic regions:** năm vùng là khung phân tích hình chữ nhật/cell grouping, không phải ranh giới hành chính.
10. **Provenance:** `src` tháng v1 là nhãn chiếm đa số cấp toàn miền; không trình bày như source chính xác của cell/ngày. Truy vết chi tiết cần daily cube, không phải core API.
11. **Uncertainty:** `lo90`/`hi90` là empirical error quantiles; không gọi là bảo đảm 90%. Không sum endpoints tùy ý.
12. **Model version:** snapshot thực dùng blend `lai_clim_s2`, `k_cell=60`; đề xuất 100 chưa được áp dụng.
13. **Data gaps:** coverage flags là suy luận thống kê; không phát hiện không đồng nghĩa không cháy.
14. **Sensor limitations:** lịch phản ánh khung giờ bay qua khoảng 13:30; FRP/brightness/confidence chưa được harmonize xuyên cảm biến.
15. **Raw artifact:** không load hoặc expose `harmonized_with_detections.json` ~1,08 GB cho MVP.

## 9. Open Questions, Risks & Blockers

### 9.1. Cần Product/Frontend/API chốt trước controllers

1. JSON schema chính xác cho metadata, areas, map, trends và errors là gì?
2. `bounds` dùng object `{south,west,north,east}` hay array, và field nào là canonical?
3. Period ngoài coverage nhưng nằm trong year được trả 200 + missing slots hay 422?
4. `partial` là một boolean toàn response, per point, hay cả hai? Warning codes/text là gì?
5. `dataVersion`/`modelVersion` chính thức là `v1-k60`/`lai_clim_s2` hay tên khác?
6. `src=0` có được chính thức hóa thành missing/outside coverage không?
7. Có expose `lo90`, `hi90`, `src` trong core endpoints không? Nếu có, aggregation rule là gì?
8. Ordering của areas/cells/trend points và numeric rounding cần cố định thế nào?
9. NFR03 `0,01` áp cho record cùng cấp hay cả aggregate được cộng từ các cell đã làm tròn; tolerance chính thức cho aggregate là bao nhiêu?

### 9.2. Cần Data/Science chốt

1. Partial/transition matrix chính thức cho 2000, 2012, 2026 và pentad 64/2026.
2. Cách aggregate uncertainty cho region/national month, nếu UI cần interval.
3. Có dùng national-year precomputed cho trends và chấp nhận rounding difference từ cell-month không?
4. Quy tắc anomaly: median/mean, baseline years, minimum years, threshold và insufficient-data semantics.
5. Manifest/hash chính thức cho snapshot; owner chịu trách nhiệm khi dataset được tái xuất.
6. Có cần hạn chế/cảnh báo fallback Aqua sau 2022 theo issue trong handoff không?

### 9.3. Engineering blockers/risks

- Maven Wrapper Windows đang lỗi; chưa có build/test pass của skeleton.
- Active JDK 26 khác target JDK 21; CI/container chưa pin.
- Dependencies hiện có gây auto-configuration/database/session không cần thiết.
- `verify_outputs.py` không chạy vì thiếu `numpy`; không cài dependency trong Task 01.
- Dataset path lồng và nằm trực tiếp dưới backend; cần externalized path cho deploy.
- Frontend rỗng, nên chưa thể xác minh client đang phụ thuộc field nào.
- NFR p95 chưa đo; không được tuyên bố pass chỉ từ kích thước file.
- Thiếu formal manifest và một số tài liệu tuning được handoff dẫn chiếu.

### 9.4. Đánh giá readiness cuối

- **Ready:** ổn định skeleton; cấu hình dataset; xây loader/index; viết integrity tests; thảo luận contract với frontend/data.
- **Conditionally ready:** core endpoints sau khi chín contract questions ở 9.1 được freeze ở mức tối thiểu.
- **Not ready:** anomaly, scientific release mới với `k_cell=100`, province/district boundaries, raw detections API.

## 10. Recommendation for the First Implementation Task

### TASK 02 — Stabilize Spring Boot Skeleton & Freeze Core Dataset Contract

Đây nên là task implementation đầu tiên, không phải tạo một Spring Boot project mới.

**Phạm vi đề xuất:**

1. Giữ Java 21 + Spring Boot 4.1.2; sửa Maven Wrapper và pin JDK trong hướng dẫn/CI.
2. Tối giản `pom.xml` còn Spring MVC, validation và test cần thiết; bỏ WebFlux/JDBC Session.
3. Thêm typed external configuration cho dataset root, expected version, data-through và optional expected hashes.
4. Chốt một contract addendum với frontend/data cho response schemas, error body, partial/status, bounds, `src=0` và version strings.
5. Viết configuration/context tests; chưa implement business endpoints hoặc harmonization.

**Definition of Done:** Wrapper test chạy bằng JDK 21; context khởi động không cần database; cấu hình dataset validate rõ; contract addendum được team đồng ý; worktree không chứa generated build artifacts hoặc dataset bị sửa.

Sau TASK 02, TASK 03 nên là **Dataset Loader, Validation & In-memory Indexes**, rồi mới tới core REST controllers.
