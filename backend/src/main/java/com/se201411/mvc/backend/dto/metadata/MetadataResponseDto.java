package com.se201411.mvc.backend.dto.metadata;

import com.se201411.mvc.backend.dto.common.ResponseMetaDto;

import java.time.LocalDate;
import java.util.List;

public record MetadataResponseDto(
		ResponseMetaDto meta,
		DateRangeDto dateRange,
		YearRangeDto yearRange,
		double gridDegrees,
		SupportedGranularitiesDto supportedGranularities,
		CapabilitiesDto capabilities,
		List<SourceCodeDto> sourceCodes,
		List<String> limitations,
		List<WarningCatalogItemDto> warningCatalog,
		DailyMetadataDto daily) {

	public record DateRangeDto(LocalDate start, LocalDate end) {
	}

	public record YearRangeDto(int start, int end) {
	}

	public record SupportedGranularitiesDto(
			List<String> calendar,
			List<String> map,
			List<String> trends,
			List<String> seasonality) {
	}

	public record CapabilitiesDto(
			List<String> spatialSelectors,
			List<String> mapGranularities,
			boolean calendarDaysAvailable,
			boolean rawDetectionPointsAvailable,
			boolean harmonizationComparisonAvailable,
			boolean anomalyAvailable) {
	}

	public record SourceCodeDto(int code, String source, String origin, String description) {
	}

	public record WarningCatalogItemDto(String code, String message, List<String> appliesTo) {
	}

	public record DailyMetadataDto(
			boolean available,
			boolean uncertaintyIntervalAvailable,
			String qualification) {
	}
}
