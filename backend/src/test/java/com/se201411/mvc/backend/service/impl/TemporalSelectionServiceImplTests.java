package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.service.model.CalendarGranularity;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.TemporalSelection;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;
import com.se201411.mvc.backend.service.model.TemporalSelectionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TemporalSelectionServiceImplTests {

	private TemporalSelectionServiceImpl service;

	@BeforeEach
	void setUp() {
		DatasetManifest manifest = new DatasetManifest(
				"1.0.0",
				"test-data",
				"test-model",
				"test-pipeline",
				"fixture",
				"snpp_eq",
				"unit",
				"UTC",
				new DatasetManifest.DateRange("2000-11-01", "2026-11-13", 9509),
				"2026-11-13",
				new DatasetManifest.Grid(0.25, 1, "cells.csv", List.of("cell")),
				new DatasetManifest.Layout("row-major[date][cell]", "little-endian", "none"),
				List.of(),
				List.of(),
				new DatasetManifest.Periods(List.of(), List.of()),
				List.of(),
				new DatasetManifest.Capabilities(List.of()),
				List.of(),
				List.of(),
				null,
				null);
		service = new TemporalSelectionServiceImpl(() -> manifest);
	}

	@Test
	void resolvesAllFourMapTemporalSelectors() {
		TemporalSelection date = service.resolveMap(
				new TemporalSelectionCriteria(LocalDate.of(2024, 3, 18), null, null, null));
		TemporalSelection year = service.resolveMap(new TemporalSelectionCriteria(null, 2024, null, null));
		TemporalSelection month = service.resolveMap(new TemporalSelectionCriteria(null, 2024, 2, null));
		TemporalSelection pentad = service.resolveMap(new TemporalSelectionCriteria(null, 2024, null, 73));

		assertThat(date.type()).isEqualTo(TemporalSelectionType.DATE);
		assertThat(date.coverage().expectedDayCount()).isEqualTo(1);
		assertThat(year.type()).isEqualTo(TemporalSelectionType.YEAR);
		assertThat(year.startDate()).isEqualTo("2024-01-01");
		assertThat(year.endDate()).isEqualTo("2024-12-31");
		assertThat(month.type()).isEqualTo(TemporalSelectionType.MONTH);
		assertThat(month.endDate()).isEqualTo("2024-02-29");
		assertThat(pentad.type()).isEqualTo(TemporalSelectionType.PENTAD);
		assertThat(pentad.startDate()).isEqualTo("2024-12-26");
		assertThat(pentad.endDate()).isEqualTo("2024-12-31");
	}

	@Test
	void computesPartialAndOutsideCoverageWithoutInventingValues() {
		Coverage startEdge = service.coverage(LocalDate.of(2000, 1, 1), LocalDate.of(2000, 12, 31));
		Coverage endEdge = service.coverage(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30));
		Coverage outside = service.coverage(LocalDate.of(1999, 1, 1), LocalDate.of(1999, 1, 31));

		assertThat(startEdge.coveredStartDate()).isEqualTo("2000-11-01");
		assertThat(startEdge.coveredDayCount()).isEqualTo(61);
		assertThat(startEdge.partial()).isTrue();
		assertThat(endEdge.coveredEndDate()).isEqualTo("2026-11-13");
		assertThat(endEdge.coveredDayCount()).isEqualTo(13);
		assertThat(endEdge.partial()).isTrue();
		assertThat(outside.coveredStartDate()).isNull();
		assertThat(outside.coveredEndDate()).isNull();
		assertThat(outside.coveredDayCount()).isZero();
		assertThat(outside.uncoveredDayCount()).isEqualTo(31);
	}

	@Test
	void keepsPentad73AtFiveDaysInCommonYearsAndSixDaysInLeapYears() {
		var common = service.period(2023, CalendarGranularity.PENTAD, 73);
		var leap = service.period(2024, CalendarGranularity.PENTAD, 73);

		assertThat(common.startDate()).isEqualTo("2023-12-27");
		assertThat(common.endDate()).isEqualTo("2023-12-31");
		assertThat(leap.startDate()).isEqualTo("2024-12-26");
		assertThat(leap.endDate()).isEqualTo("2024-12-31");
	}

	@Test
	void rejectsInvalidCombinationsAndExactDatesOutsideTheDataset() {
		assertCode(new TemporalSelectionCriteria(null, null, null, null), "INVALID_TEMPORAL_SELECTOR");
		assertCode(new TemporalSelectionCriteria(LocalDate.of(2024, 1, 1), 2024, null, null),
				"INVALID_TEMPORAL_SELECTOR");
		assertCode(new TemporalSelectionCriteria(null, 2024, 3, 15), "INVALID_TEMPORAL_SELECTOR");
		assertCode(new TemporalSelectionCriteria(null, 2024, 13, null), "INVALID_PARAMETER");
		assertCode(new TemporalSelectionCriteria(LocalDate.of(2027, 1, 1), null, null, null),
				"DATE_OUTSIDE_DATASET_RANGE");
	}

	private void assertCode(TemporalSelectionCriteria criteria, String code) {
		assertThatThrownBy(() -> service.resolveMap(criteria))
				.isInstanceOf(ApiException.class)
				.extracting(exception -> ((ApiException) exception).code())
				.isEqualTo(code);
	}
}
