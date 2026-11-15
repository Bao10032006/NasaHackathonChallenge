package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;

import java.util.List;

/**
 * Result of {@code GET /cells/{cellId}/period-details}: one cell, one temporal selector, the harmonized
 * value over the covered days and where it came from. No raw detection coordinates or timestamps.
 */
public record CellPeriodDetailResult(
		CellArea cell,
		TemporalSelection temporalSelection,
		Double value,
		ValueStatus valueStatus,
		ActivityOrigin origin,
		List<SourceContribution> sourceComposition,
		DatasetManifest manifest,
		List<String> warnings) {

	public CellPeriodDetailResult {
		if (cell == null || temporalSelection == null || valueStatus == null || manifest == null) {
			throw new IllegalArgumentException("cell, temporalSelection, valueStatus and manifest must not be null");
		}
		if ((value == null) != (valueStatus != ValueStatus.AVAILABLE)) {
			throw new IllegalArgumentException("only AVAILABLE results carry a value");
		}
		sourceComposition = sourceComposition == null ? List.of() : List.copyOf(sourceComposition);
		warnings = warnings == null ? List.of() : List.copyOf(warnings);
	}
}
