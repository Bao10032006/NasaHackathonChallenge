package com.se201411.mvc.backend.domain.activity;

import java.time.LocalDate;
import java.util.List;

public record DailyActivityDay(LocalDate date, List<DailyCellActivity> cells) {

	public DailyActivityDay {
		if (date == null) {
			throw new IllegalArgumentException("date must not be null");
		}
		cells = cells == null ? List.of() : List.copyOf(cells);
	}
}
