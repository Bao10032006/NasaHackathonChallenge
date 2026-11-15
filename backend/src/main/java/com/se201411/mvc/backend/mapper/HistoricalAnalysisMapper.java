package com.se201411.mvc.backend.mapper;

import com.se201411.mvc.backend.dto.analysis.SeasonalityResponseDto;
import com.se201411.mvc.backend.dto.analysis.TrendsResponseDto;
import com.se201411.mvc.backend.dto.common.CoverageDto;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.SeasonalityResult;
import com.se201411.mvc.backend.service.model.TrendResult;
import org.springframework.stereotype.Component;

@Component
public final class HistoricalAnalysisMapper {

	private final SpatialSelectionMapper spatialSelectionMapper;
	private final ResponseMetaMapper responseMetaMapper;

	public HistoricalAnalysisMapper(
			SpatialSelectionMapper spatialSelectionMapper,
			ResponseMetaMapper responseMetaMapper) {
		this.spatialSelectionMapper = spatialSelectionMapper;
		this.responseMetaMapper = responseMetaMapper;
	}

	public TrendsResponseDto toDto(TrendResult result) {
		return new TrendsResponseDto(
				spatialSelectionMapper.toDto(result.selection()),
				result.granularity().apiValue(),
				result.period(),
				result.points().stream().map(point -> new TrendsResponseDto.PointDto(
						point.year(),
						point.period(),
						point.value(),
						point.valueStatus().name(),
						point.partial(),
						point.origin() == null ? null : point.origin().name(),
						toDto(point.coverage()))).toList(),
				responseMetaMapper.toDto(result.manifest(), result.warnings()));
	}

	public SeasonalityResponseDto toDto(SeasonalityResult result) {
		return new SeasonalityResponseDto(
				spatialSelectionMapper.toDto(result.selection()),
				result.granularity().apiValue(),
				result.referenceStartYear(),
				result.referenceEndYear(),
				result.minimumSampleSize(),
				result.periods().stream().map(period -> new SeasonalityResponseDto.PeriodDto(
						period.period(),
						period.sampleSize(),
						period.mean(),
						period.median(),
						period.valueStatus().name())).toList(),
				responseMetaMapper.toDto(result.manifest(), result.warnings()));
	}

	private static CoverageDto toDto(Coverage coverage) {
		return new CoverageDto(
				coverage.requestedStartDate(), coverage.requestedEndDate(),
				coverage.coveredStartDate(), coverage.coveredEndDate(),
				coverage.expectedDayCount(), coverage.coveredDayCount(), coverage.uncoveredDayCount(),
				coverage.partial());
	}
}
