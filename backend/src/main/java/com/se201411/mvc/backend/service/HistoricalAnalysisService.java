package com.se201411.mvc.backend.service;

import com.se201411.mvc.backend.service.model.SeasonalityResult;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import com.se201411.mvc.backend.service.model.TrendResult;

/**
 * Historical analysis of the harmonized activity (TASK 03B3B): same-period values across years and
 * seasonal statistics. Descriptive only; no anomaly classification.
 */
public interface HistoricalAnalysisService {

	TrendResult getTrends(
			SpatialSelectionCriteria spatial,
			int startYear,
			int endYear,
			String granularity,
			Integer period);

	SeasonalityResult getSeasonality(
			SpatialSelectionCriteria spatial,
			String granularity,
			Integer startYear,
			Integer endYear);
}
