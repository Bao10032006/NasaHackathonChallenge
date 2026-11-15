package com.se201411.mvc.backend.domain.area;

public enum SocioeconomicRegion {
	NORTHERN_MIDLANDS_AND_MOUNTAINS("TrungDuMienNuiPhiaBac", "Trung du và miền núi phía Bắc"),
	RED_RIVER_DELTA("DongBangSongHong", "Đồng bằng sông Hồng"),
	NORTH_CENTRAL("BacTrungBo", "Bắc Trung Bộ"),
	SOUTH_CENTRAL_COAST("DuyenHaiNamTrungBo", "Duyên hải Nam Trung Bộ"),
	CENTRAL_HIGHLANDS("TayNguyenKTXH", "Tây Nguyên"),
	SOUTHEAST("DongNamBo", "Đông Nam Bộ"),
	MEKONG_DELTA("DongBangSongCuuLong", "Đồng bằng sông Cửu Long");

	private final String id;
	private final String displayName;

	SocioeconomicRegion(String id, String displayName) {
		this.id = id;
		this.displayName = displayName;
	}

	public String id() {
		return id;
	}

	public String displayName() {
		return displayName;
	}
}
