package com.se201411.mvc.backend.mapper;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.dto.metadata.MetadataResponseDto;
import com.se201411.mvc.backend.service.model.MetadataOverview;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public final class MetadataMapper {

	private static final List<String> MAP_GRANULARITIES = List.of("day", "year", "month", "pentad");

	private final ResponseMetaMapper responseMetaMapper;

	public MetadataMapper(ResponseMetaMapper responseMetaMapper) {
		this.responseMetaMapper = responseMetaMapper;
	}

	public MetadataResponseDto toDto(MetadataOverview overview) {
		DatasetManifest manifest = overview.manifest();
		LocalDate start = LocalDate.parse(manifest.dateRange().start());
		LocalDate end = LocalDate.parse(manifest.dateRange().end());
		return new MetadataResponseDto(
				responseMetaMapper.toDto(manifest),
				new MetadataResponseDto.DateRangeDto(start, end),
				new MetadataResponseDto.YearRangeDto(start.getYear(), end.getYear()),
				manifest.grid().degrees(),
				new MetadataResponseDto.SupportedGranularitiesDto(
						List.of("month", "pentad"),
						MAP_GRANULARITIES,
						List.of("year", "month", "pentad"),
						List.of("month", "pentad")),
				new MetadataResponseDto.CapabilitiesDto(
						List.of("NAMED_AREA", "BOUNDING_BOX"),
						MAP_GRANULARITIES,
						true,
						false,
						overview.harmonizationComparisonAvailable(),
						false),
				manifest.sourceCodes().stream().map(MetadataMapper::sourceCode).toList(),
				manifest.limitations().stream().map(DatasetManifest.Limitation::description).toList(),
				manifest.warningCatalog().stream().map(warning ->
						new MetadataResponseDto.WarningCatalogItemDto(
								warning.code(), warning.description(), warning.appliesTo())).toList(),
				new MetadataResponseDto.DailyMetadataDto(
						true,
						false,
						"Daily values are verified for use with published scientific limitations."));
	}

	private static MetadataResponseDto.SourceCodeDto sourceCode(
			DatasetManifest.SourceCodeDefinition definition) {
		return new MetadataResponseDto.SourceCodeDto(
				definition.code(),
				definition.source(),
				definition.origin(),
				switch (definition.code()) {
					case 1 -> "Terra monthly estimate redistributed to days";
					case 2 -> "Calibrated Aqua monthly estimate redistributed to days";
					case 3 -> "Direct S-NPP daytime detections";
					case 4 -> "NOAA-20 detections scaled to S-NPP equivalent";
					default -> "Dataset source";
				});
	}
}
