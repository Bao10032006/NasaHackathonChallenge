package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.exception.ApiException;

public enum CalendarGranularity {
	MONTH("month", 12),
	PENTAD("pentad", 73);

	private final String apiValue;
	private final int periodCount;

	CalendarGranularity(String apiValue, int periodCount) {
		this.apiValue = apiValue;
		this.periodCount = periodCount;
	}

	public String apiValue() {
		return apiValue;
	}

	public int periodCount() {
		return periodCount;
	}

	public static CalendarGranularity fromApiValue(String value) {
		if (value == null || value.isBlank()) {
			throw ApiException.invalidParameter("granularity must be month or pentad");
		}
		for (CalendarGranularity granularity : values()) {
			if (granularity.apiValue.equals(value)) {
				return granularity;
			}
		}
		throw ApiException.invalidParameter("granularity must be month or pentad");
	}
}
