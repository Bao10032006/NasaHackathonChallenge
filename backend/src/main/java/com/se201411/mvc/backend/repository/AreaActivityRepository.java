package com.se201411.mvc.backend.repository;

import com.se201411.mvc.backend.domain.activity.AreaActivitySummary;
import com.se201411.mvc.backend.domain.activity.AreaDailySeries;
import com.se201411.mvc.backend.domain.area.AreaDefinition;

import java.time.LocalDate;

/**
 * Area-level aggregation of the daily cube without materialising one object per cell-day.
 * Dates are inclusive and must lie inside the dataset range; otherwise an IllegalArgumentException is thrown.
 * Values are summed in double precision directly from the float32 cell-day values.
 */
public interface AreaActivityRepository {

	AreaActivitySummary summarize(AreaDefinition area, LocalDate startInclusive, LocalDate endInclusive);

	AreaDailySeries dailySeries(AreaDefinition area, LocalDate startInclusive, LocalDate endInclusive);
}
