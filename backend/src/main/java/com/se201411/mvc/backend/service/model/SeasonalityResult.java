package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;

import java.util.List;

/** Result of {@code GET /seasonality}: 12 month or 73 pentad periods in ascending order. */
public record SeasonalityResult(
		SpatialSelection selection,
		CalendarGranularity granularity,
		int referenceStartYear,
		int referenceEndYear,
		int minimumSampleSize,
		List<Period> periods,
		DatasetManifest manifest,
		List<String> warnings) {

	public SeasonalityResult {
		if (selection == null || granularity == null || manifest == null) {
			throw new IllegalArgumentException("selection, granularity and manifest must not be null");
		}
		if (referenceStartYear > referenceEndYear) {
			throw new IllegalArgumentException("reference range must be ordered");
		}
		periods = periods == null ? List.of() : List.copyOf(periods);
		warnings = warnings == null ? List.of() : List.copyOf(warnings);
	}

	/**
	 * @param sampleSize number of reference years actually used (missing, outside and partial excluded)
	 * @param mean       arithmetic mean, null when {@code valueStatus} is INSUFFICIENT_BASELINE
	 * @param median     median, null when {@code valueStatus} is INSUFFICIENT_BASELINE
	 */
	public record Period(int period, int sampleSize, Double mean, Double median, ValueStatus valueStatus) {

		public Period {
			if (valueStatus == null || sampleSize < 0) {
				throw new IllegalArgumentException("valueStatus must be set and sampleSize non-negative");
			}
			if ((mean == null) != (median == null) || (mean == null) != (valueStatus != ValueStatus.AVAILABLE)) {
				throw new IllegalArgumentException("mean and median are both present exactly when AVAILABLE");
			}
		}
	}
}
