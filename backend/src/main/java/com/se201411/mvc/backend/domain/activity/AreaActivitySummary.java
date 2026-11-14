package com.se201411.mvc.backend.domain.activity;

import com.se201411.mvc.backend.domain.area.AreaType;

import java.time.LocalDate;
import java.util.List;

/**
 * Sum of daily snpp_eq over all cells of an area and all days of an inclusive date range,
 * with the source composition that produced it (only source codes present in the range).
 */
public record AreaActivitySummary(
		AreaType areaType,
		String areaId,
		LocalDate startDate,
		LocalDate endDate,
		int cellCount,
		int dayCount,
		double value,
		List<SourceComposition> sources) {

	public AreaActivitySummary {
		if (areaType == null || areaId == null || startDate == null || endDate == null) {
			throw new IllegalArgumentException("area and dates must not be null");
		}
		if (endDate.isBefore(startDate)) {
			throw new IllegalArgumentException("endDate must not be before startDate");
		}
		sources = sources == null ? List.of() : List.copyOf(sources);
	}
}
