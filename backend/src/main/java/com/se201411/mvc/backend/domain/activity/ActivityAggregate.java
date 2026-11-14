package com.se201411.mvc.backend.domain.activity;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Sum of daily snpp_eq over a cell selection and an inclusive date range, independent of how the
 * selection was made (named area or bounding box).
 *
 * @param startDate first day of the aggregated range (inside the dataset)
 * @param endDate   last day of the aggregated range (inside the dataset)
 * @param cellCount number of selected cells
 * @param dayCount  number of days in the range, equal to {@code endDate - startDate + 1}
 * @param value     total harmonized snpp_eq, summed in double precision and not rounded
 * @param sources   composition per source code, ascending by code, containing only codes with at
 *                  least one cell-day; enough for the service to derive DIRECT, SCALED, MODEL or MIXED
 */
public record ActivityAggregate(
		LocalDate startDate,
		LocalDate endDate,
		int cellCount,
		int dayCount,
		double value,
		List<SourceComposition> sources) {

	public ActivityAggregate {
		if (startDate == null || endDate == null) {
			throw new IllegalArgumentException("startDate and endDate must not be null");
		}
		if (endDate.isBefore(startDate)) {
			throw new IllegalArgumentException("endDate must not be before startDate");
		}
		if (cellCount < 1) {
			throw new IllegalArgumentException("cellCount must be positive");
		}
		if (dayCount != ChronoUnit.DAYS.between(startDate, endDate) + 1) {
			throw new IllegalArgumentException("dayCount must match the inclusive date range");
		}
		if (!Double.isFinite(value) || value < 0) {
			throw new IllegalArgumentException("value must be finite and non-negative");
		}
		sources = sources == null ? List.of() : List.copyOf(sources);
	}
}
