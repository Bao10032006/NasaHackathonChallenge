package com.se201411.mvc.backend.domain.area;

/**
 * One 0.25-degree grid cell of the dataset, as listed in {@code tables/cells_025.csv}.
 * Bounds are derived from the south-west corner and the grid size declared in the manifest.
 */
public record CellArea(
		String cellId,
		int cy,
		int cx,
		double centerLat,
		double centerLon,
		double south,
		double west,
		double north,
		double east,
		String diagnosticRegion) {

	public CellArea {
		if (cellId == null || cellId.isBlank()) {
			throw new IllegalArgumentException("cellId must not be blank");
		}
		if (diagnosticRegion == null || diagnosticRegion.isBlank()) {
			throw new IllegalArgumentException("diagnosticRegion must not be blank");
		}
		if (!(south < north) || !(west < east)) {
			throw new IllegalArgumentException("cell bounds must be non-empty: " + cellId);
		}
	}
}
