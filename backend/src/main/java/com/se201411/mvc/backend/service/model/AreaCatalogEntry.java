package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.CellArea;

public record AreaCatalogEntry(
		AreaDefinition area,
		CellArea cell,
		String displayName) {

	public AreaCatalogEntry {
		if ((area == null) == (cell == null)) {
			throw new IllegalArgumentException("exactly one of area or cell is required");
		}
	}

	public static AreaCatalogEntry area(AreaDefinition area, String displayName) {
		return new AreaCatalogEntry(area, null, displayName);
	}

	public static AreaCatalogEntry cell(CellArea cell) {
		return new AreaCatalogEntry(null, cell, null);
	}
}
