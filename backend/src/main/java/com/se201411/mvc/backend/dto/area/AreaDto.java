package com.se201411.mvc.backend.dto.area;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.se201411.mvc.backend.dto.common.BoundsDto;
import com.se201411.mvc.backend.dto.common.CoordinatesDto;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AreaDto(
		String type,
		String id,
		String name,
		String diagnosticRegion,
		Integer cellCount,
		CoordinatesDto center,
		BoundsDto bounds) {
}
