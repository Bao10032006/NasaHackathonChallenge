package com.se201411.mvc.backend.dto.activity;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.se201411.mvc.backend.dto.common.MapCellValueDto;
import com.se201411.mvc.backend.dto.common.ResponseMetaDto;
import com.se201411.mvc.backend.dto.common.SourceCompositionDto;
import com.se201411.mvc.backend.dto.common.SpatialSelectionDto;

import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DailyResponseDto(
		SpatialSelectionDto selection,
		SpatialSelectionDto.AreaRefDto area,
		LocalDate date,
		double value,
		String valueStatus,
		String origin,
		boolean partial,
		List<SourceCompositionDto> sourceComposition,
		List<MapCellValueDto> cells,
		ResponseMetaDto meta) {
}
