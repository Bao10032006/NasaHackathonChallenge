package com.se201411.mvc.backend.domain.area;

import java.util.List;

/**
 * A supported analysis area resolved to its member cells, in dataset cell order.
 * Diagnostic regions are analysis frames, not administrative boundaries.
 */
public record AreaDefinition(AreaType type, String id, List<String> cellIds) {

	public static final String NATIONAL_ID = "ToanQuoc";

	public AreaDefinition {
		if (type == null) {
			throw new IllegalArgumentException("type must not be null");
		}
		if (id == null || id.isBlank()) {
			throw new IllegalArgumentException("id must not be blank");
		}
		cellIds = cellIds == null ? List.of() : List.copyOf(cellIds);
		if (cellIds.isEmpty()) {
			throw new IllegalArgumentException("area must contain at least one cell: " + id);
		}
	}
}
