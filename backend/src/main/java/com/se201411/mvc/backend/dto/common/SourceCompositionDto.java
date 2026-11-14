package com.se201411.mvc.backend.dto.common;

public record SourceCompositionDto(
		int sourceCode,
		String source,
		String origin,
		long cellCount,
		long contributingCellDayCount,
		double harmonizedValue,
		long inputObservationCount,
		long sourceInputValidCellCount) {
}
