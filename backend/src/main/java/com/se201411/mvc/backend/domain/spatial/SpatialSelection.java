package com.se201411.mvc.backend.domain.spatial;

import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.CellArea;

import java.util.List;

public record SpatialSelection(
		SelectionType type,
		SelectionRule selectionRule,
		AreaDefinition area,
		Bounds requestedBounds,
		Bounds selectedBounds,
		List<CellArea> cells) {

	public SpatialSelection {
		if (type == null || selectionRule == null || selectedBounds == null) {
			throw new IllegalArgumentException("selection type, rule and selected bounds are required");
		}
		cells = cells == null ? List.of() : List.copyOf(cells);
		if (cells.isEmpty()) {
			throw new IllegalArgumentException("selection must contain at least one cell");
		}
		if (type == SelectionType.NAMED_AREA && area == null) {
			throw new IllegalArgumentException("named-area selection requires an area");
		}
		if (type == SelectionType.BOUNDING_BOX && requestedBounds == null) {
			throw new IllegalArgumentException("bounding-box selection requires requested bounds");
		}
	}

	public List<String> cellIds() {
		return cells.stream().map(CellArea::cellId).toList();
	}
}
