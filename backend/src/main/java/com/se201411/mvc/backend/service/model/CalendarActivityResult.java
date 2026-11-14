package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;

import java.time.LocalDate;
import java.util.List;

public record CalendarActivityResult(
		SpatialSelection selection,
		int year,
		CalendarGranularity granularity,
		List<Value> values,
		Summary summary,
		Baseline baseline,
		DatasetManifest manifest,
		List<String> warnings) {

	public CalendarActivityResult {
		values = values == null ? List.of() : List.copyOf(values);
		warnings = warnings == null ? List.of() : List.copyOf(warnings);
	}

	public record Value(
			int period,
			LocalDate startDate,
			LocalDate endDate,
			Double value,
			ValueStatus valueStatus,
			boolean partial,
			ActivityOrigin origin,
			Coverage coverage) {
	}

	public record Summary(
			Double totalValue,
			ValueStatus valueStatus,
			Coverage coverage,
			PeriodPeak peakPeriod) {
	}

	public record PeriodPeak(int period, double value) {
	}

	public record Baseline(
			String method,
			int referenceStartYear,
			int referenceEndYear,
			boolean excludesTargetYear,
			List<BaselineValue> values) {

		public Baseline {
			values = values == null ? List.of() : List.copyOf(values);
		}
	}

	public record BaselineValue(int period, Double value, int sampleSize, ValueStatus valueStatus) {
	}
}
