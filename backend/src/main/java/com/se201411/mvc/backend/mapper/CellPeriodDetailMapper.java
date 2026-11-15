package com.se201411.mvc.backend.mapper;

import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.dto.area.AreaDto;
import com.se201411.mvc.backend.dto.cell.CellPeriodDetailsResponseDto;
import com.se201411.mvc.backend.dto.common.BoundsDto;
import com.se201411.mvc.backend.dto.common.CoordinatesDto;
import com.se201411.mvc.backend.dto.common.CoverageDto;
import com.se201411.mvc.backend.dto.common.SourceCompositionDto;
import com.se201411.mvc.backend.dto.common.TemporalSelectorDto;
import com.se201411.mvc.backend.service.model.CellPeriodDetailResult;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.SourceContribution;
import com.se201411.mvc.backend.service.model.TemporalSelection;
import org.springframework.stereotype.Component;

@Component
public final class CellPeriodDetailMapper {

	private final ResponseMetaMapper responseMetaMapper;

	public CellPeriodDetailMapper(ResponseMetaMapper responseMetaMapper) {
		this.responseMetaMapper = responseMetaMapper;
	}

	public CellPeriodDetailsResponseDto toDto(CellPeriodDetailResult result) {
		return new CellPeriodDetailsResponseDto(
				toDto(result.cell()),
				toDto(result.temporalSelection()),
				result.value(),
				result.valueStatus().name(),
				result.origin() == null ? null : result.origin().name(),
				result.sourceComposition().stream().map(CellPeriodDetailMapper::toDto).toList(),
				responseMetaMapper.toDto(result.manifest(), result.warnings()));
	}

	/** Same cell shape as {@code GET /areas}. */
	private static AreaDto toDto(CellArea cell) {
		return new AreaDto(
				"cell",
				cell.cellId(),
				null,
				cell.diagnosticRegion(),
				null,
				new CoordinatesDto(cell.centerLat(), cell.centerLon()),
				new BoundsDto(cell.west(), cell.south(), cell.east(), cell.north()));
	}

	private static TemporalSelectorDto toDto(TemporalSelection selection) {
		return new TemporalSelectorDto(
				selection.type().name(), selection.date(), selection.year(), selection.month(), selection.pentad(),
				selection.startDate(), selection.endDate(), toDto(selection.coverage()));
	}

	private static CoverageDto toDto(Coverage coverage) {
		return new CoverageDto(
				coverage.requestedStartDate(), coverage.requestedEndDate(),
				coverage.coveredStartDate(), coverage.coveredEndDate(),
				coverage.expectedDayCount(), coverage.coveredDayCount(), coverage.uncoveredDayCount(),
				coverage.partial());
	}

	private static SourceCompositionDto toDto(SourceContribution source) {
		return new SourceCompositionDto(
				source.sourceCode(), source.source(), source.origin().name(), source.cellCount(),
				source.contributingCellDayCount(), source.harmonizedValue(), source.inputObservationCount(),
				source.sourceInputValidCellCount());
	}
}
