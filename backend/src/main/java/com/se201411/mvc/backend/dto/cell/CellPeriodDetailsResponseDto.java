package com.se201411.mvc.backend.dto.cell;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.se201411.mvc.backend.dto.area.AreaDto;
import com.se201411.mvc.backend.dto.common.ResponseMetaDto;
import com.se201411.mvc.backend.dto.common.SourceCompositionDto;
import com.se201411.mvc.backend.dto.common.TemporalSelectorDto;

import java.util.List;

/** OpenAPI v0.4 {@code CellPeriodDetailsResponse}: value and origin are required and may be null. */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record CellPeriodDetailsResponseDto(
		AreaDto cell,
		TemporalSelectorDto temporalSelector,
		Double value,
		String valueStatus,
		String origin,
		List<SourceCompositionDto> sourceComposition,
		ResponseMetaDto meta) {
}
