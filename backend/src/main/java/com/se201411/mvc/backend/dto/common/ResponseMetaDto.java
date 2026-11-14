package com.se201411.mvc.backend.dto.common;

import java.time.LocalDate;
import java.util.List;

public record ResponseMetaDto(
		String dataVersion,
		String modelVersion,
		LocalDate dataThrough,
		String metric,
		String unit,
		String timeZone,
		List<String> warnings) {

	public ResponseMetaDto {
		warnings = warnings == null ? List.of() : List.copyOf(warnings);
	}
}
