package com.se201411.mvc.backend.service;

import com.se201411.mvc.backend.service.model.CalendarActivityResult;
import com.se201411.mvc.backend.service.model.DailyActivityResult;
import com.se201411.mvc.backend.service.model.DailyCalendarActivityResult;
import com.se201411.mvc.backend.service.model.MapActivityResult;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;

import java.time.LocalDate;

public interface ActivityService {

	MapActivityResult getMap(SpatialSelectionCriteria spatial, TemporalSelectionCriteria temporal);

	CalendarActivityResult getCalendar(
			SpatialSelectionCriteria spatial,
			int year,
			String granularity,
			boolean includeBaseline,
			Integer baselineStartYear,
			Integer baselineEndYear);

	DailyCalendarActivityResult getDailyCalendar(SpatialSelectionCriteria spatial, int year, int month);

	DailyActivityResult getDaily(SpatialSelectionCriteria spatial, LocalDate date, boolean includeCells);
}
