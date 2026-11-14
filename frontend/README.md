# Frontend Hỏa Lịch — khung dữ liệu thô

Giao diện hiện là **khung dữ liệu thô** (raw-data scaffold): mọi trường mà API v0.4 trả về đều được hiển thị dưới dạng HTML trơn (bảng, danh sách, `dl`), chưa có CSS. Mục tiêu là chốt **đủ và đúng thông tin** trước; bước làm đẹp UI chỉ thay phần trình bày, không được làm rơi dữ liệu hay ngữ nghĩa (trạng thái, origin, coverage, cảnh báo).

Nguồn sự thật: `mvp_bussinessRule/HoaLich_OpenAPI_v0.4.yaml`, `HoaLich_05_UIUX_User_Flow_Wireframe_v0.4.md`, `HoaLich_08_Frontend_Integration_Examples_v0.4.md`.

## Chạy

Cần Node.js 20.19+ (dòng 20) hoặc 22.12+.

```sh
cd frontend
npm ci
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # ra frontend/dist/
```

### Hai nguồn dữ liệu (chọn ngay trên header)

| Chế độ | Khi nào dùng | Ghi chú |
|---|---|---|
| **Dữ liệu mẫu** (mặc định) | Làm UI không cần backend | Đọc fixture trong `src/mocks/`. Bộ lọc ngoài kịch bản demo sẽ báo "Chưa có dữ liệu mẫu", không bịa số. |
| **API thật** | Kiểm tra với backend | Vite chuyển `/api` sang `http://localhost:8080`. Chạy backend trước (`backend/`, `mvnw spring-boot:run` hoặc JAR). |

Đặt chế độ mặc định bằng biến môi trường: `VITE_DATA_SOURCE=api npm run dev`.

**Kịch bản demo có đủ dữ liệu mẫu** (Document 08): khung `west=107, south=12, east=108, north=13` (13 ô Tây Nguyên)
- năm 2024 (cả năm, 12 tháng, pentad 15, 73 pentad), từng ngày tháng 3/2024;
- tháng 11/2026 (thiếu dữ liệu, có đến 13/11) và từng ngày 01–13/11/2026; năm 2026;
- so sánh cùng tháng 2005 với 2024 (12 tháng);
- chi tiết từng ô trong 13 ô (12 tháng 2024, cả năm 2024, pentad 15, 18/03/2024, 03/2005, 11/2026, 13/11/2026);
- toàn quốc và Tây Nguyên (vùng có sẵn) tháng 3/2024; lỗi thật: ngày ngoài phạm vi (422), khung không có ô (422), chọn cả tháng lẫn pentad (400).

### Dữ liệu mẫu đến từ đâu

`tools/frontend/build_mock_fixtures.py` tạo `src/mocks/fixtures/*.json` và `src/mocks/index.json`. Mỗi fixture ghi `provenance`:

- `backend@<commit>`: phản hồi **nguyên văn** của backend thật cho các API đã có (`/metadata`, `/areas`, `/map/cells`, `/calendar`, `/calendar/days`, `/daily`).
- `generated:…`: cho các API OpenAPI v0.4 đã định nghĩa nhưng backend **chưa** triển khai (TASK 03B3: `/trends`, `/seasonality`, `/cells/{cellId}/period-details`; tùy chọn `/harmonization/comparison`). Script tính từ chính file nhị phân thật theo đúng schema và quy tắc của backend (cắt coverage, origin theo đóng góp dương / đa số ô-ngày, baseline tối thiểu 5 năm). Khi TASK 03B3 xong, chạy lại script để thay bằng phản hồi thật.

```sh
# backend đang chạy ở 8080 trên snapshot đã commit
python tools/frontend/build_mock_fixtures.py --api http://localhost:8080
```

Không dùng số trong fixture làm hằng số production (Contract v0.4 §8).

## Cấu trúc

```text
src/
├── api/
│   ├── types.ts      kiểu TypeScript khớp từng schema OpenAPI v0.4
│   ├── client.ts     gọi API (spatial/temporal → query), khóa cache, Problem → ApiError
│   ├── errors.ts     ApiError (kind: problem | network | mock-missing, code ổn định)
│   └── mock.ts       adapter đọc fixture theo path + query
├── state/
│   ├── AppState.tsx  một filter state chung (FR08): vùng, năm, kiểu kỳ, tháng/pentad/ngày, ô đang chọn; state So sánh
│   └── Metadata.tsx  /metadata và /areas tải một lần, warningCatalog dùng chung
├── lib/
│   ├── format.ts     định dạng số/ngày và toàn bộ câu chữ (wireframe §10, origin, lỗi theo code)
│   ├── time.ts       tháng, pentad (pentad 73 có 6 ngày năm nhuận), ngày
│   ├── compare.ts    quy tắc tương thích hai bản đồ (Contract v0.4 §7)
│   └── useApi.ts     hook tải dữ liệu: loading / error / success, cache, thử lại
├── components/raw.tsx  khối hiển thị thô dùng chung (coverage, origin, trạng thái, cảnh báo, nguồn, lỗi)
├── explore/          màn Khám phá theo thứ tự mobile của wireframe
├── compare/          màn So sánh hai bản đồ
└── datanotes/        màn Nguồn dữ liệu (Data Notes)
```

## Bảng đối chiếu: trường API → khối giao diện

Khi làm đẹp UI, mỗi trường dưới đây phải còn hiển thị (có thể đổi hình thức).

| API | Trường | Khối |
|---|---|---|
| `/metadata` | `meta.*`, `dateRange`, `yearRange`, `gridDegrees`, `supportedGranularities`, `capabilities`, `sourceCodes`, `limitations`, `warningCatalog`, `daily.*` | Nguồn dữ liệu; `yearRange`/`dateRange` còn giới hạn bộ lọc; `warningCatalog` cấp câu chữ cho mọi cảnh báo |
| `/areas` | `type`, `id`, `name`, `cellCount`, `diagnosticRegion`, `center`, `bounds` | Bộ lọc (hiển thị `name`, gửi `id`) |
| `/map/cells` | `selection.*` (type, rule, area, requested/selected bounds, cellCount, cellIds) | Vùng và kỳ đang xem |
| | `temporalSelector.*` + `coverage` | Vùng và kỳ đang xem |
| | `summary.totalValue/valueStatus/origin/coverage/minCellValue/maxCellValue` | Tóm tắt kỳ; min/max = thang màu bản đồ |
| | `cells[].cellId/center/bounds/value/valueStatus/partial/origin` (+ `sourceCode/source/inputObservationCount/sourceInputValid` khi chọn ngày) | Bản đồ lưới |
| `/calendar` | `values[]` (period, start/end, value, status, partial, origin, coverage), `summary` (total, status, coverage, `peakPeriod`), `baseline` (method, năm tham chiếu, `excludesTargetYear`, `values[]` value/sampleSize/status) | Bảng 12 tháng / 73 pentad + mức lịch sử; tháng cao nhất ở Tóm tắt (chế độ năm) |
| `/calendar/days` | `values[]` (date, value, status, partial, origin, warnings), `summary` (total, status, coverage, `peakDate`) | Lịch ngày; ngày cao nhất ở Tóm tắt (chế độ tháng) |
| `/daily` | `value`, `valueStatus`, `origin`, `partial`, `sourceComposition[]` (8 trường), `cells[]` | Tóm tắt kỳ (chế độ ngày) |
| `/trends` | `points[]` (year, period, value, status, partial, origin, coverage) | Phân tích lịch sử |
| `/seasonality` | `referenceStart/EndYear`, `minimumSampleSize`, `periods[]` (mean, median, sampleSize, status) | Phân tích lịch sử |
| `/cells/{id}/period-details` | `cell.*`, `temporalSelector`, `value`, `valueStatus`, `origin`, `sourceComposition[]` | Chi tiết ô lưới |
| `/harmonization/comparison` | `series[]` (seriesType, label, metric, unit, points), `explanationKeys` | Nguồn dữ liệu (tùy chọn) |
| mọi phản hồi | `meta.dataVersion/modelVersion/dataThrough/metric/unit/timeZone/warnings` | "Phiên bản và cảnh báo" của từng khối |
| lỗi | `Problem.code/status/detail` | Khối lỗi; câu chữ theo `code`, không parse `detail` |

## Quy tắc không được phá khi làm đẹp

- `0` là dữ liệu thật; `MISSING`, `OUTSIDE_DATASET_RANGE`, lỗi API không bao giờ hiển thị thành `0`.
- Luôn hiển thị origin cạnh giá trị theo ngày; câu chữ origin ở `lib/format.ts`.
- Kỳ partial phải kèm khoảng đã có dữ liệu; đỉnh của kỳ partial ghi "trong khoảng đã có dữ liệu".
- Chấm trên bản đồ là tâm ô lưới 0,25°, không phải điểm cháy thực.
- Chênh lệch so với mức lịch sử là thống kê, không gắn nhãn "bất thường".
- So sánh hai bản đồ chỉ hiện chênh lệch khi `compareMaps` báo tương thích; tổng A/B lấy từ `summary.totalValue`, không cộng lại từ ô.
- Vùng phân tích không phải ranh giới hành chính.
