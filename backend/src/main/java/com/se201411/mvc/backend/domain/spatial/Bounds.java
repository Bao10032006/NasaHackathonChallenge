package com.se201411.mvc.backend.domain.spatial;

public record Bounds(double west, double south, double east, double north) {

	public Bounds {
		if (!Double.isFinite(west) || !Double.isFinite(south)
				|| !Double.isFinite(east) || !Double.isFinite(north)) {
			throw new IllegalArgumentException("bounds must be finite");
		}
		if (!(west < east) || !(south < north)) {
			throw new IllegalArgumentException("bounds must be non-empty");
		}
	}

	public boolean containsInclusive(double latitude, double longitude) {
		return longitude >= west && longitude <= east
				&& latitude >= south && latitude <= north;
	}
}
