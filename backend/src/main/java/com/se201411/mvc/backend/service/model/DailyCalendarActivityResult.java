package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;

import java.time.LocalDate;
import java.util.List;

public record DailyCalendarActivityResult(
		SpatialSelection selection,
		int year,
		int month,
		List<Value> values,
		Summary summary,
		DatasetManifest manifest,
		List<String> warnings) {

	public DailyCalendarActivityResult {
		values = values == null ? List.of() : List.copyOf(values);
		warnings = warnings == null ? List.of() : List.copyOf(warnings);
	}

	public record Value(
			LocalDate date,
			Double value,
			ValueStatus valueStatus,
			boolean partial,
			ActivityOrigin origin,
			List<String> warnings) {

		public Value {
			warnings = warnings == null ? List.of() : List.copyOf(warnings);
		}
	}

	public record Summary(
			Double totalValue,
			ValueStatus valueStatus,
			Coverage coverage,
			DatePeak peakDate) {
	}

	public record DatePeak(LocalDate date, double value) {
	}
}
