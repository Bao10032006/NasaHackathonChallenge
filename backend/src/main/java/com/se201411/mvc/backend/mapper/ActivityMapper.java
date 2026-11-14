package com.se201411.mvc.backend.mapper;

import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.dto.activity.CalendarResponseDto;
import com.se201411.mvc.backend.dto.activity.DailyCalendarResponseDto;
import com.se201411.mvc.backend.dto.activity.DailyResponseDto;
import com.se201411.mvc.backend.dto.activity.MapCellsResponseDto;
import com.se201411.mvc.backend.dto.common.BoundsDto;
import com.se201411.mvc.backend.dto.common.CoordinatesDto;
import com.se201411.mvc.backend.dto.common.CoverageDto;
import com.se201411.mvc.backend.dto.common.MapCellValueDto;
import com.se201411.mvc.backend.dto.common.SourceCompositionDto;
import com.se201411.mvc.backend.dto.common.SpatialSelectionDto;
import com.se201411.mvc.backend.dto.common.TemporalSelectorDto;
import com.se201411.mvc.backend.service.model.CalendarActivityResult;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.DailyActivityResult;
import com.se201411.mvc.backend.service.model.DailyCalendarActivityResult;
import com.se201411.mvc.backend.service.model.MapActivityResult;
import com.se201411.mvc.backend.service.model.SourceContribution;
import com.se201411.mvc.backend.service.model.TemporalSelection;
import org.springframework.stereotype.Component;

@Component
public final class ActivityMapper {

	private final SpatialSelectionMapper spatialSelectionMapper;
	private final ResponseMetaMapper responseMetaMapper;

	public ActivityMapper(SpatialSelectionMapper spatialSelectionMapper, ResponseMetaMapper responseMetaMapper) {
		this.spatialSelectionMapper = spatialSelectionMapper;
		this.responseMetaMapper = responseMetaMapper;
	}

	public MapCellsResponseDto toDto(MapActivityResult result) {
		MapActivityResult.Summary summary = result.summary();
		return new MapCellsResponseDto(
				spatialSelectionMapper.toDto(result.selection()),
				toDto(result.temporalSelection()),
				new MapCellsResponseDto.SummaryDto(
						summary.totalValue(),
						summary.valueStatus().name(),
						summary.origin() == null ? null : summary.origin().name(),
						toDto(summary.coverage()),
						summary.minCellValue(),
						summary.maxCellValue()),
				result.cells().stream().map(this::toDto).toList(),
				responseMetaMapper.toDto(result.manifest(), result.warnings()));
	}

	public CalendarResponseDto toDto(CalendarActivityResult result) {
		CalendarActivityResult.Summary summary = result.summary();
		CalendarActivityResult.Baseline baseline = result.baseline();
		return new CalendarResponseDto(
				spatialSelectionMapper.toDto(result.selection()),
				result.year(),
				result.granularity().apiValue(),
				result.values().stream().map(value -> new CalendarResponseDto.ValueDto(
						value.period(), value.startDate(), value.endDate(), value.value(),
						value.valueStatus().name(), value.partial(),
						value.origin() == null ? null : value.origin().name(), toDto(value.coverage()))).toList(),
				new CalendarResponseDto.SummaryDto(
						summary.totalValue(), summary.valueStatus().name(), toDto(summary.coverage()),
						summary.peakPeriod() == null ? null : new CalendarResponseDto.PeriodPeakDto(
								summary.peakPeriod().period(), summary.peakPeriod().value())),
				baseline == null ? null : new CalendarResponseDto.BaselineDto(
						baseline.method(), baseline.referenceStartYear(), baseline.referenceEndYear(),
						baseline.excludesTargetYear(), baseline.values().stream()
								.map(value -> new CalendarResponseDto.BaselineValueDto(
										value.period(), value.value(), value.sampleSize(), value.valueStatus().name()))
								.toList()),
				responseMetaMapper.toDto(result.manifest(), result.warnings()));
	}

	public DailyCalendarResponseDto toDto(DailyCalendarActivityResult result) {
		DailyCalendarActivityResult.Summary summary = result.summary();
		return new DailyCalendarResponseDto(
				spatialSelectionMapper.toDto(result.selection()),
				result.year(), result.month(),
				result.values().stream().map(value -> new DailyCalendarResponseDto.ValueDto(
						value.date(), value.value(), value.valueStatus().name(), value.partial(),
						value.origin() == null ? null : value.origin().name(), value.warnings())).toList(),
				new DailyCalendarResponseDto.SummaryDto(
						summary.totalValue(), summary.valueStatus().name(), toDto(summary.coverage()),
						summary.peakDate() == null ? null : new DailyCalendarResponseDto.DatePeakDto(
								summary.peakDate().date(), summary.peakDate().value())),
				responseMetaMapper.toDto(result.manifest(), result.warnings()));
	}

	public DailyResponseDto toDto(DailyActivityResult result) {
		SpatialSelectionDto selection = spatialSelectionMapper.toDto(result.selection());
		return new DailyResponseDto(
				selection,
				selection.area(),
				result.date(), result.value(), result.valueStatus().name(), result.origin().name(), result.partial(),
				result.sourceComposition().stream().map(this::toDto).toList(),
				result.cells() == null ? null : result.cells().stream().map(this::toDto).toList(),
				responseMetaMapper.toDto(result.manifest(), result.warnings()));
	}

	private TemporalSelectorDto toDto(TemporalSelection selection) {
		return new TemporalSelectorDto(
				selection.type().name(), selection.date(), selection.year(), selection.month(), selection.pentad(),
				selection.startDate(), selection.endDate(), toDto(selection.coverage()));
	}

	private CoverageDto toDto(Coverage coverage) {
		return new CoverageDto(
				coverage.requestedStartDate(), coverage.requestedEndDate(),
				coverage.coveredStartDate(), coverage.coveredEndDate(),
				coverage.expectedDayCount(), coverage.coveredDayCount(), coverage.uncoveredDayCount(), coverage.partial());
	}

	private MapCellValueDto toDto(MapActivityResult.CellValue value) {
		CellArea cell = value.cell();
		return new MapCellValueDto(
				cell.cellId(),
				new CoordinatesDto(cell.centerLat(), cell.centerLon()),
				new BoundsDto(cell.west(), cell.south(), cell.east(), cell.north()),
				value.value(), value.valueStatus().name(), value.partial(),
				value.origin() == null ? null : value.origin().name(),
				value.sourceCode(), value.source(), value.inputObservationCount(), value.sourceInputValid());
	}

	private SourceCompositionDto toDto(SourceContribution source) {
		return new SourceCompositionDto(
				source.sourceCode(), source.source(), source.origin().name(), source.cellCount(),
				source.contributingCellDayCount(), source.harmonizedValue(), source.inputObservationCount(),
				source.sourceInputValidCellCount());
	}
}
