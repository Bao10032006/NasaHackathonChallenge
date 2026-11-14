# Frontend Hỏa Lịch

- **Khám phá (Explore)**: màn tương tác hoàn chỉnh — bản đồ ô lưới trên nền NASA GIBS, khoanh vùng bằng chuột, biểu đồ 12 tháng / 73 kỳ với mức lịch sử, lịch ngày, tóm tắt, chi tiết nguồn của ô, phân tích lịch sử và hướng dẫn đọc dữ liệu.
- **So sánh** và **Nguồn dữ liệu**: vẫn là khung dữ liệu thô (HTML trơn, đủ mọi trường), sẽ hoàn thiện ở bước sau.

Nguồn sự thật: `mvp_bussinessRule/HoaLich_OpenAPI_v0.4.yaml`, `HoaLich_05_UIUX_User_Flow_Wireframe_v0.4.md`, `HoaLich_08_Frontend_Integration_Examples_v0.4.md`.

## Bản đồ

- Thư viện **Leaflet 1.9.4** (không dùng plugin).
- Ảnh nền từ **NASA GIBS** (WMTS công khai, Web Mercator): `BlueMarble_ShadedRelief_Bathymetry`, `Coastlines_15m`, `Reference_Labels_15m`. GIBS **không cần API key**.
- **Không dùng FIRMS MAP_KEY**: key đó để tải điểm cháy thô, trong khi contract cấm hiển thị điểm cháy gốc (`capabilities.rawDetectionPointsAvailable=false`), và NFR06 cấm đưa secret vào frontend. Không commit bất kỳ key nào vào repo.
- Mỗi hình chữ nhật là một ô 0,25°; màu theo `snpp_eq` trên thang căn bậc hai từ 0 đến `summary.maxCellValue`; 0 và “ngoài phạm vi” có kiểu riêng và nhãn chữ trong chú giải.
- “Khoanh vùng trên bản đồ”: kéo chuột để vẽ khung; khung được làm tròn theo lưới 0,25° rồi gửi `west/south/east/north`. Viền nét đứt = khung yêu cầu; viền liền = phạm vi thực tế (`selection.selectedBounds`). Khi backend trả `NO_CELLS_IN_BOUNDS`, khung được giữ để khoanh lại. Esc để hủy.

## Luồng Khám phá đã kiểm

Toàn quốc (năm 2024) → khung Tây Nguyên hoặc kéo khung → bản đồ năm + biểu đồ 12 tháng (tháng nổi bật từ `summary.peakPeriod`) → bấm tháng → lịch ngày (ngày nổi bật từ `summary.peakDate`) → bấm ngày → tổng và nguồn của ngày → bấm ô → chi tiết nguồn của ô → lịch sử cùng tháng và mẫu hình mùa vụ.

Ca biên có dữ liệu mẫu: ngày bằng 0 (10/03/2024), ngày ngoài phạm vi (14–30/11/2026), tháng chưa đầy đủ (11/2026, chênh lệch lịch sử bị ẩn kèm lý do), ngày ước lượng (06/11/2026, Aqua dự phòng), không có ngày nổi bật (07/2024, mọi ngày bằng 0), lỗi API (khung ngoài biển → 422, mất kết nối backend).

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
| **API thật** | Kiểm tra với backend | Vite chuyển `/api` sang `http://localhost:8080`. Chạy backend trước (`backend/`, `mvnw spring-boot:run` hoặc JAR). Endpoint backend chưa có (TASK 03B3: trends, seasonality, chi tiết ô) tự lùi về dữ liệu mẫu cùng hợp đồng và được gắn nhãn “Dữ liệu mẫu · backend chưa có API này”. |

Đặt chế độ mặc định bằng biến môi trường: `VITE_DATA_SOURCE=api npm run dev`.

**Dữ liệu mẫu có sẵn** (441 fixture):
- **Toàn quốc**: năm 2024, 12 tháng 2024 (bản đồ + lịch ngày), kỳ 15, ngày 18/03/2024, năm 2026 và tháng 11/2026; xu hướng 12 tháng, mẫu hình mùa vụ.
- **Khung Tây Nguyên** `west=107, south=12, east=108, north=13` (Document 08, 13 ô): năm 2024, 12 tháng, kỳ 15, 73 kỳ, từng ngày 3/2024 và 01–13/11/2026, năm 2026; 12 tháng 2005 (So sánh); chi tiết từng ô theo tháng/năm/kỳ; xu hướng và mùa vụ.
- Chi tiết ô **theo một ngày** được suy ra chính xác từ bản đồ ngày (mỗi ô-ngày có đúng một nguồn), nên bấm ô nào trên bản đồ ngày cũng có dữ liệu.
- Tây Nguyên (vùng có sẵn) tháng 3/2024; lỗi thật: ngày ngoài phạm vi (422), khung không có ô (422), chọn cả tháng lẫn kỳ (400).
- Khung kéo tay ở chế độ mẫu chỉ có dữ liệu khi trùng khung Tây Nguyên; dùng chế độ API thật để khoanh tự do.

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
├── components/raw.tsx  khối hiển thị thô cho màn So sánh / Nguồn dữ liệu
├── explore/
│   ├── ExploreScreen.tsx   bố cục: bộ lọc · bản đồ + tóm tắt · biểu đồ · lịch ngày + lịch sử · ngăn kéo
│   ├── FilterBar.tsx       phạm vi (toàn quốc / vùng / ô / khung) và kiểu kỳ (năm / tháng / kỳ 5 ngày / ngày)
│   ├── ExploreMap.tsx      Leaflet + NASA GIBS, ô lưới, chú giải, kéo khung
│   ├── SummaryCard.tsx     tổng, coverage, origin, kỳ nổi bật, nguồn của ngày
│   ├── PeriodChart.tsx     12 tháng / 73 kỳ + mức lịch sử (bấm để chọn)
│   ├── DayCalendarGrid.tsx lịch ngày 28–31 ô
│   ├── HistoryPanel.tsx    đối chiếu baseline, cùng kỳ qua các năm, mẫu hình mùa vụ
│   ├── CellDetailsDrawer.tsx / DataGuideDrawer.tsx  ngăn kéo chi tiết ô và hướng dẫn đọc dữ liệu
│   ├── LineChart.tsx       biểu đồ SVG dùng chung (hình điểm = origin, bảng số liệu thay thế)
│   └── ui.tsx, requests.ts nhãn trạng thái/nguồn dữ liệu; request dùng chung một filter state
├── styles.css        giao diện (bảng màu, bố cục responsive, ngăn kéo)
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
