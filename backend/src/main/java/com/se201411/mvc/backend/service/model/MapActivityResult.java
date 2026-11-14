package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;

import java.util.List;

public record MapActivityResult(
		SpatialSelection selection,
		TemporalSelection temporalSelection,
		Summary summary,
		List<CellValue> cells,
		DatasetManifest manifest,
		List<String> warnings) {

	public MapActivityResult {
		cells = cells == null ? List.of() : List.copyOf(cells);
		warnings = warnings == null ? List.of() : List.copyOf(warnings);
	}

	public record Summary(
			Double totalValue,
			ValueStatus valueStatus,
			ActivityOrigin origin,
			Coverage coverage,
			Double minCellValue,
			Double maxCellValue) {
	}

	public record CellValue(
			CellArea cell,
			Double value,
			ValueStatus valueStatus,
			boolean partial,
			ActivityOrigin origin,
			Integer sourceCode,
			String source,
			Integer inputObservationCount,
			Boolean sourceInputValid) {
	}
}
