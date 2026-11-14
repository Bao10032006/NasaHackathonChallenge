package com.se201411.mvc.backend.service.model;

public record SourceContribution(
		int sourceCode,
		String source,
		ActivityOrigin origin,
		long cellCount,
		long contributingCellDayCount,
		double harmonizedValue,
		long inputObservationCount,
		long sourceInputValidCellCount) {

	public SourceContribution {
		if (sourceCode < 1 || sourceCode > 4 || source == null || source.isBlank() || origin == null
				|| origin == ActivityOrigin.MIXED) {
			throw new IllegalArgumentException("source identity must be valid and non-mixed");
		}
		if (cellCount < 1 || contributingCellDayCount < 1 || cellCount > contributingCellDayCount
				|| inputObservationCount < 0 || sourceInputValidCellCount < 0
				|| sourceInputValidCellCount > contributingCellDayCount
				|| !Double.isFinite(harmonizedValue) || harmonizedValue < 0) {
			throw new IllegalArgumentException("source contribution values are invalid");
		}
	}
}
