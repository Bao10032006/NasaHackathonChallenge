package com.se201411.mvc.backend.repository;

import com.se201411.mvc.backend.domain.activity.DailyActivityDay;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface DailyActivityRepository {

	DailyActivityDay findByDate(LocalDate date, Collection<String> cellIds);

	List<DailyActivityDay> findByDateRange(
			LocalDate startInclusive,
			LocalDate endInclusive,
			Collection<String> cellIds);
}
