"""Build the region membership table from the pre-2025 Viet Nam COD-AB shapefile."""

import argparse
import csv
import hashlib
from pathlib import Path
from zipfile import ZipFile

import shapefile
from shapely import make_valid, union_all
from shapely.geometry import Point, box, shape


BOUNDARY_SHA256 = "7bd797108611f0d3d51d6b9743b36ad1ef6eefd89858394c309011bef6066a9c"
PROVINCES = {
    "TrungDuMienNuiPhiaBac": "201 203 205 207 209 211 213 215 217 221 301 302 303 305",
    "DongBangSongHong": "101 103 104 106 107 109 111 113 115 117 225",
    "BacTrungBo": "401 403 405 407 409 411",
    "DuyenHaiNamTrungBo": "501 503 505 507 509 511 705 715",
    "TayNguyenKTXH": "601 603 605 606 607",
    "DongNamBo": "701 707 709 711 713 717",
    "DongBangSongCuuLong": "801 803 805 807 809 811 813 815 816 817 819 821 823",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("boundaries", type=Path, help="Original vnm.shp.zip with 63 ADM1 units")
    parser.add_argument("cells", type=Path, help="Snapshot cells_025.csv")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    if hashlib.sha256(args.boundaries.read_bytes()).hexdigest() != BOUNDARY_SHA256:
        parser.error("The boundary archive does not match the documented pre-2025 snapshot")

    with ZipFile(args.boundaries) as archive, shapefile.Reader(
        shp=archive.open("vnm_adm1.shp"), dbf=archive.open("vnm_adm1.dbf")
    ) as provinces:
        geometry = {
            item.record["ADM1_PCODE"]: make_valid(shape(item.shape.__geo_interface__))
            for item in provinces.iterShapeRecords()
        }
    province_codes = ["VN" + code for codes in PROVINCES.values() for code in codes.split()]
    if len(province_codes) != len(geometry) or set(province_codes) != geometry.keys():
        parser.error("The grouping must include each province exactly once")
    regions = {
        region: union_all([geometry["VN" + code] for code in codes.split()])
        for region, codes in PROVINCES.items()
    }

    rows = []
    counts = dict.fromkeys(PROVINCES, 0)
    methods = {"center": 0, "overlap": 0, "outside": 0}
    with args.cells.open(encoding="utf-8-sig", newline="") as source:
        for cell in csv.DictReader(source):
            point = Point(float(cell["lon"]), float(cell["lat"]))
            west, south = float(cell["lon_w"]), float(cell["lat_s"])
            footprint = box(west, south, west + 0.25, south + 0.25)
            covered = [region for region, boundary in regions.items() if boundary.covers(point)]
            if len(covered) == 1:
                region, method = covered[0], "center"
            else:
                candidates = covered or list(regions)
                overlap = {region: regions[region].intersection(footprint).area for region in candidates}
                region = max(overlap, key=overlap.__getitem__)
                region, method = (region, "overlap") if overlap[region] > 0 else (None, "outside")
            methods[method] += 1
            if region:
                rows.append((cell["cell"], region))
                counts[region] += 1

    with args.output.open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(("cellId", "regionId"))
        writer.writerows(rows)
    print(counts)
    print(methods)


if __name__ == "__main__":
    main()
