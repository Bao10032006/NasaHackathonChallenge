package com.se201411.mvc.backend.service.model;

public record SpatialSelectionCriteria(
		String areaType,
		String areaId,
		Double west,
		Double south,
		Double east,
		Double north) {

	public static SpatialSelectionCriteria national() {
		return new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null);
	}
}
