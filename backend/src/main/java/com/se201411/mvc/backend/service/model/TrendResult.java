package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;

import java.util.List;

/** Result of {@code GET /trends}: one point per year of the inclusive range, in ascending year order. */
public record TrendResult(
		SpatialSelection selection,
		TrendGranularity granularity,
		Integer period,
		List<Point> points,
		DatasetManifest manifest,
		List<String> warnings) {

	public TrendResult {
		if (selection == null || granularity == null || manifest == null) {
			throw new IllegalArgumentException("selection, granularity and manifest must not be null");
		}
		if ((granularity == TrendGranularity.YEAR) != (period == null)) {
			throw new IllegalArgumentException("period must be absent for year and present for month or pentad");
		}
		points = points == null ? List.of() : List.copyOf(points);
		warnings = warnings == null ? List.of() : List.copyOf(warnings);
	}

	/**
	 * @param value  aggregate over the covered days; null only when the period has no dataset coverage
	 * @param origin derived from the real source composition; null when there is no value
	 */
	public record Point(
			int year,
			Integer period,
			Double value,
			ValueStatus valueStatus,
			boolean partial,
			ActivityOrigin origin,
			Coverage coverage) {

		public Point {
			if (valueStatus == null || coverage == null) {
				throw new IllegalArgumentException("valueStatus and coverage must not be null");
			}
			if ((value == null) != (valueStatus != ValueStatus.AVAILABLE)) {
				throw new IllegalArgumentException("only AVAILABLE points carry a value");
			}
		}
	}
}
