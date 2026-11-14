package com.se201411.mvc.backend.dto.activity;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.se201411.mvc.backend.dto.common.CoverageDto;
import com.se201411.mvc.backend.dto.common.MapCellValueDto;
import com.se201411.mvc.backend.dto.common.ResponseMetaDto;
import com.se201411.mvc.backend.dto.common.SpatialSelectionDto;
import com.se201411.mvc.backend.dto.common.TemporalSelectorDto;

import java.util.List;

public record MapCellsResponseDto(
		SpatialSelectionDto selection,
		TemporalSelectorDto temporalSelector,
		SummaryDto summary,
		List<MapCellValueDto> cells,
		ResponseMetaDto meta) {

	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record SummaryDto(
			Double totalValue,
			String valueStatus,
			String origin,
			CoverageDto coverage,
			Double minCellValue,
			Double maxCellValue) {
	}
}
