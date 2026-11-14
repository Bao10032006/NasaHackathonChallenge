package com.se201411.mvc.backend.domain.activity;

/**
 * Contribution of one source code (1 Terra, 2 Aqua, 3 S-NPP, 4 NOAA-20) to an area over a date range.
 * {@code cellCount} is the number of distinct selected cells that use this source at least once.
 * {@code inputObservationCount} counts detections of the satellite selected by the source code; it is not snpp_eq.
 */
public record SourceComposition(
		int sourceCode,
		long cellCount,
		long cellDays,
		double value,
		long inputObservationCount,
		long sourceInputValidCellDays) {

	public SourceComposition {
		if (sourceCode < 1 || sourceCode > 4) {
			throw new IllegalArgumentException("sourceCode must be between 1 and 4");
		}
		if (cellCount < 0 || cellDays < 0 || inputObservationCount < 0 || sourceInputValidCellDays < 0) {
			throw new IllegalArgumentException("counts must be non-negative");
		}
		if (cellCount > cellDays) {
			throw new IllegalArgumentException("cellCount must not exceed cellDays");
		}
		if (!Double.isFinite(value) || value < 0) {
			throw new IllegalArgumentException("value must be finite and non-negative");
		}
	}
}
