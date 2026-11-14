package com.se201411.mvc.backend.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SpatialSelectionDto(
		String type,
		String selectionRule,
		AreaRefDto area,
		BoundsDto requestedBounds,
		BoundsDto selectedBounds,
		int cellCount,
		List<String> cellIds) {

	public record AreaRefDto(String type, String id) {
	}
}
