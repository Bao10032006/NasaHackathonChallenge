# TASK 03A — Báo cáo export artifact ngày (Người 1)

- Người thực hiện: HoangAnh250
- Ngày: 14/11/2026
- Spec: `docs/backend/TASK_03A_ARTIFACT_SPEC.md` (`1.0.0-draft.2`), manifest `schemaVersion = 1.0.0`
- Exporter: `tools/data/export_daily_artifacts.py`; môi trường: `tools/data/requirements.txt`
- Môi trường đã chạy: Windows, Python 3.15.0, numpy 2.5.4, pandas 3.1.1

## 1. Kết quả

| Hạng mục | Kết quả |
|---|---|
| Artifact thật (snapshot pipeline 1.0) | `backend/hoalich_data_v1/hoalich_data_v1/derived/` — 4 file nhị phân + manifest |
| Fixture tự chứa | `backend/src/test/resources/fixtures/daily-mini/` |
| Kiểm định export E1–E15 | **15/15 PASS** |
| Regression R1–R7 | **7/7 PASS** |
| Thời gian chạy | khoảng 7,5 giây |

## 2. File xuất (snapshot 1.0)

| File | Byte | SHA-256 |
|---|---:|---|
| `daily-values.f32` | 22.327.132 | `a506c77fe331bc47c68b62483608feaeb90c2b8419c097114d032b91af88e50c` |
| `daily-source.u8` | 5.581.783 | `d3da2a41043fe41b8c6376133fcd14aaad63cfa5c0c4f2b859166b11579bf29c` |
| `daily-input-count.i16` | 11.163.566 | `48e050b07f03e293c97ac15d6cf74e3ced4f52493e49ed54408f061f400a0b09` |
| `daily-source-input-valid.u8` | 5.581.783 | `9c1cddb29b8e47f49b16862b3da9762bd294ef92048f34076a973c92f5fed76f` |
| `dataset-manifest.json` | ~26 KB | không tự chứa hash (đổi theo `generatedAt`) |

Tổng nhị phân 44.654.264 B. Nguồn: hash 6 file nguồn ghi trong `manifest.sources`, khớp spec §7.

## 3. Kiểm định export (snapshot 1.0)

| # | Kiểm tra | Quan sát |
|---|---|---|
| E1 | Hash NPZ | `ce62f017…0b93` |
| E2 | Ngày liên tục | 9.509 ngày, 2000-11-01 → 2026-11-13 |
| E3 | Thứ tự cell (lat/lon) | 587/587 |
| E4 | Giá trị hữu hạn, không âm | 0 NaN, 0 âm, max 705,8286 |
| E5 | Source code theo thời gian | 1..4; 0 code 1 từ 2002-08; 0 code 3|4 trước 2012-01-20 |
| E6 | Code 3 = S-NPP | 3.129.684 cell-day khớp tuyệt đối |
| E7 | Code 4 = N20 / hệ số | hệ số đo được 1,0105795 (lệch tương đối max 4,8e-8); so với 1,0106: 2,0e-5 |
| E8 | Ngày → bảng tháng | lệch max 0,004999 |
| E9 | Ngày → vùng-pentad | lệch max 0,004995 |
| E10 | Ngày → `web_cells_pentad.json` | lệch max 0,05 (làm tròn 1 chữ số) |
| E11 | `null` web JSON | 0 trong range, 41.090 ngoài range |
| E12 | Input count | 0 … 154 |
| E13 | Cờ hợp lệ | 28.763 giá trị 0, toàn bộ ở code 1 |
| E14 | Đọc lại nguyên bit | khớp cả 4 file |
| E15 | Regression | R1–R7 PASS |

Regression (spec §8.3):

| # | Quan sát |
|---|---|
| R1 TayNguyen 2005-03-25 (Aqua) | 171,6355988; code {2}; input 21; valid 122/122 |
| R2 ToanQuoc 2012-03-06 (S-NPP) | 2275,0; code {3}; input 2275; valid 587/587 |
| R3 ToanQuoc 2026-04-29 (NOAA-20) | 193,9481320; code {4}; input 196; valid 587/587 |
| R4 cell 59_430 2019-01-07 | 2,0 (`0x40000000`); code 3; input 2; valid 1 |
| R5 cell 87_422 2024-09-27 | 0,98953128 (`0x3F7D51EC`); code 4; input 1; valid 1 |
| R6 2026-11-06 | 328 cell-day code 2 |
| R7 Seasonality TayNguyen pentad 15 | n 23; mean 1672,6; median 1373,0 |

Manifest tính từ dữ liệu: `periods.partial` = năm 2000, năm 2026, tháng 11/2026, pentad 64/2026; `transitions` = 2002-08-01 `TERRA_TO_AQUA`, 2012-01-20 `SNPP_START`, 2026-11-02 `SNPP_END_NOAA20_PRIMARY`.

## 4. Kiểm tra hành vi exporter

| Tình huống | Kết quả |
|---|---|
| Chạy lại khi `derived/` đã có, không `--replace` | thoát mã 1, báo lỗi rõ; `derived/` giữ nguyên; không còn thư mục tạm |
| Chạy lại với `--replace` | file nhị phân **giống từng byte** lần trước (export tất định) |
| Đọc kiểu Java chỉ từ manifest (memmap little-endian) | `cellIds` khớp `cells_025.csv`; `byteSize` và SHA-256 khớp; R2 = 2275,0 |
| Snapshot mới mà giữ `dataVersion` mặc định | exporter từ chối (spec §10) — **chưa thử thực tế** vì chưa có snapshot khác |

## 5. Fixture `daily-mini`

Dữ liệu tổng hợp theo spec §11, tự chứa (có `tables/cells_025.csv` 4 dòng riêng). File nhị phân:

| File | Byte | SHA-256 |
|---|---:|---|
| `daily-values.f32` | 64 | `ad85f1a4a6691f525963187e4fb942b2685cda57a3086c142f33cd1a4a07933e` |
| `daily-source.u8` | 16 | `392c6febc8389d87da170c82bbecc25f2b03d0e70ee2b3f0430bdd737128fff6` |
| `daily-input-count.i16` | 32 | `0b0284669008ff0348f9012018e613ca2bf8a212732d57b5340429d04745c668` |
| `daily-source-input-valid.u8` | 16 | `106343421449959baae061338df80ed926918f37bfea7617a613a460c813a1de` |

`fixture-expected.json` chứa: 16 giá trị cell-day (kèm bit float32), tổng theo ngày `157.0, 257.5, 5.0, 9.0`, tổng/origin theo vùng (ví dụ TayNguyen 2026-11-13 = 5,0 `MIXED`; DBSCL 2026-11-13 = 4,0 `MODEL_REDISTRIBUTED`, valid 0/2), probe endian (`02 01` tại offset 14 của `.i16`; `00 40 7f 43` tại offset 28 của `.f32`), `periods` (năm 2026, tháng 11/2026, pentad 63 và 64; transitions rỗng). Manifest fixture dùng `generatedAt` cố định nên chạy lại cho kết quả giống hệt.

## 6. Chạy lại

```bash
pip install -r tools/data/requirements.txt
python tools/data/export_daily_artifacts.py --dataset-root backend/hoalich_data_v1/hoalich_data_v1 --replace
python tools/data/export_daily_artifacts.py --fixture backend/src/test/resources/fixtures/daily-mini --cells-source backend/hoalich_data_v1/hoalich_data_v1/tables/cells_025.csv --replace
```

## 7. Ghi chú cho backend

- Artifact thật commit vào Git cho MVP theo thỏa thuận; snapshot sau nên phát hành riêng.
- `daily-source.u8` đọc **không dấu** trong Java (`Byte.toUnsignedInt`).
- Cờ hợp lệ 0 chỉ xuất hiện ở code 1; giá trị vẫn `AVAILABLE`.
- `scaleDivisor` của NOAA-20 trong manifest là 1,0105795 (đo được); không dùng để tính lại giá trị — giá trị đã có sẵn trong `daily-values.f32`.
