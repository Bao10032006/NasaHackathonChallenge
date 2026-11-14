package com.se201411.mvc.backend.domain.activity;

public record DailyCellActivity(
		String cellId,
		float value,
		int sourceCode,
		int inputObservationCount,
		boolean sourceInputValid) {

	public DailyCellActivity {
		if (cellId == null || cellId.isBlank()) {
			throw new IllegalArgumentException("cellId must not be blank");
		}
		if (!Float.isFinite(value) || value < 0) {
			throw new IllegalArgumentException("value must be finite and non-negative");
		}
		if (sourceCode < 1 || sourceCode > 4) {
			throw new IllegalArgumentException("sourceCode must be between 1 and 4");
		}
		if (inputObservationCount < 0) {
			throw new IllegalArgumentException("inputObservationCount must be non-negative");
		}
	}
}
