package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.exception.ApiException;

/** Granularity of {@code GET /trends}. Daily trends are not part of contract v0.4. */
public enum TrendGranularity {
	YEAR("year", null),
	MONTH("month", CalendarGranularity.MONTH),
	PENTAD("pentad", CalendarGranularity.PENTAD);

	private final String apiValue;
	private final CalendarGranularity periodGranularity;

	TrendGranularity(String apiValue, CalendarGranularity periodGranularity) {
		this.apiValue = apiValue;
		this.periodGranularity = periodGranularity;
	}

	public String apiValue() {
		return apiValue;
	}

	/** Month or pentad period type; null for {@link #YEAR}, which has no period. */
	public CalendarGranularity periodGranularity() {
		return periodGranularity;
	}

	public static TrendGranularity fromApiValue(String value) {
		if (value != null) {
			for (TrendGranularity granularity : values()) {
				if (granularity.apiValue.equals(value)) {
					return granularity;
				}
			}
		}
		throw ApiException.invalidParameter("granularity must be year, month or pentad");
	}
}
