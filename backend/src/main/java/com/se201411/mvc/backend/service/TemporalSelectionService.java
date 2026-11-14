package com.se201411.mvc.backend.service;

import com.se201411.mvc.backend.service.model.CalendarGranularity;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.TemporalSelection;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;

import java.time.LocalDate;

public interface TemporalSelectionService {

	TemporalSelection resolveMap(TemporalSelectionCriteria criteria);

	Coverage coverage(LocalDate requestedStart, LocalDate requestedEnd);

	DateRange period(int year, CalendarGranularity granularity, int period);

	void validateSupportedYear(int year);

	LocalDate datasetStartDate();

	LocalDate datasetEndDate();

	record DateRange(LocalDate startDate, LocalDate endDate) {

		public DateRange {
			if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
				throw new IllegalArgumentException("date range must be valid");
		}
	}
}
}
