package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;

import java.time.LocalDate;
import java.util.List;

public record DailyActivityResult(
		SpatialSelection selection,
		LocalDate date,
		double value,
		ValueStatus valueStatus,
		ActivityOrigin origin,
		boolean partial,
		List<SourceContribution> sourceComposition,
		List<MapActivityResult.CellValue> cells,
		DatasetManifest manifest,
		List<String> warnings) {

	public DailyActivityResult {
		sourceComposition = sourceComposition == null ? List.of() : List.copyOf(sourceComposition);
		cells = cells == null ? null : List.copyOf(cells);
		warnings = warnings == null ? List.of() : List.copyOf(warnings);
	}
}
