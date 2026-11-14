package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.ActivityDailySeries;
import com.se201411.mvc.backend.domain.activity.CellActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.AreaType;
import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.Bounds;
import com.se201411.mvc.backend.domain.spatial.SelectionRule;
import com.se201411.mvc.backend.domain.spatial.SelectionType;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;
import com.se201411.mvc.backend.repository.ActivityQueryRepository;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.service.SpatialSelectionService;
import com.se201411.mvc.backend.service.model.CalendarGranularity;
import com.se201411.mvc.backend.service.model.ActivityOrigin;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;
import com.se201411.mvc.backend.service.model.ValueStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityServiceImplTests {

	private DatasetManifest manifest;
	private SpatialSelection selection;
	private ActivityServiceImpl service;

	@BeforeEach
	void setUp() {
		manifest = manifest();
		selection = selection();
		service = serviceWithValue(1.0);
	}

	@Test
	void returnsExactDateMapWithStableCellsAndSourceFields() {
		var result = service.getMap(
				new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null),
				new TemporalSelectionCriteria(LocalDate.of(2024, 3, 18), null, null, null));

		assertThat(result.summary().totalValue()).isEqualTo(2.0);
		assertThat(result.summary().minCellValue()).isEqualTo(1.0);
		assertThat(result.summary().maxCellValue()).isEqualTo(1.0);
		assertThat(result.cells()).extracting(value -> value.cell().cellId())
				.containsExactly("cell-a", "cell-b");
		assertThat(result.cells()).allSatisfy(value -> {
			assertThat(value.sourceCode()).isEqualTo(3);
			assertThat(value.source()).isEqualTo("SNPP");
			assertThat(value.sourceInputValid()).isTrue();
		});
		assertThat(result.warnings()).containsExactly("NO_DAILY_UNCERTAINTY_INTERVAL");
	}

	@Test
	void buildsCalendarSummaryPeakAndMedianBaseline() {
		var result = service.getCalendar(
				new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null),
				2024,
				CalendarGranularity.MONTH.apiValue(),
				true,
				2003,
				2007);

		assertThat(result.values()).hasSize(12);
		assertThat(result.summary().totalValue()).isEqualTo(732.0);
		assertThat(result.summary().coverage().partial()).isFalse();
		assertThat(result.summary().peakPeriod().period()).isEqualTo(1);
		assertThat(result.summary().peakPeriod().value()).isEqualTo(62.0);
		assertThat(result.baseline().method()).isEqualTo("median");
		assertThat(result.baseline().excludesTargetYear()).isFalse();
		assertThat(result.baseline().values()).hasSize(12);
		assertThat(result.baseline().values().getFirst().sampleSize()).isEqualTo(5);
		assertThat(result.baseline().values().getFirst().value()).isEqualTo(62.0);
	}

	@Test
	void baselineExcludesTargetYearAndReportsInsufficientSampleAfterExclusion() {
		var result = service.getCalendar(
				new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null),
				2005,
				"month",
				true,
				2003,
				2007);

		assertThat(result.baseline().excludesTargetYear()).isTrue();
		assertThat(result.baseline().values().getFirst().sampleSize()).isEqualTo(4);
		assertThat(result.baseline().values().getFirst().valueStatus())
				.isEqualTo(ValueStatus.INSUFFICIENT_BASELINE);
		assertThat(result.baseline().values().getFirst().value()).isNull();
	}

	@Test
	void keepsCalendarPlaceholdersAndPartialCoverageAtDatasetStart() {
		var result = service.getCalendar(
				new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null),
				2000,
				"month",
				false,
				null,
				null);

		assertThat(result.values()).hasSize(12);
		assertThat(result.values().subList(0, 10))
				.allSatisfy(value -> {
					assertThat(value.value()).isNull();
					assertThat(value.valueStatus()).isEqualTo(ValueStatus.OUTSIDE_DATASET_RANGE);
				});
		assertThat(result.values().get(10).value()).isEqualTo(60.0);
		assertThat(result.values().get(11).value()).isEqualTo(62.0);
		assertThat(result.summary().totalValue()).isEqualTo(122.0);
		assertThat(result.summary().coverage().partial()).isTrue();
		assertThat(result.summary().peakPeriod().period()).isEqualTo(12);
		assertThat(result.warnings()).contains("PARTIAL_PERIOD");
	}

	@Test
	void returnsEveryCivilDayAndUsesEarliestDateForTiedPeak() {
		var result = service.getDailyCalendar(
				new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null),
				2024,
				2);

		assertThat(result.values()).hasSize(29);
		assertThat(result.summary().totalValue()).isEqualTo(58.0);
		assertThat(result.summary().peakDate().date()).isEqualTo("2024-02-01");
		assertThat(result.summary().peakDate().value()).isEqualTo(2.0);
	}

	@Test
	void allZeroCalendarHasNoPeak() {
		var zeroService = serviceWithValue(0.0);

		var result = zeroService.getDailyCalendar(
				new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null),
				2024,
				2);

		assertThat(result.summary().totalValue()).isZero();
		assertThat(result.summary().peakDate()).isNull();
	}

	@Test
	void dailyCanIncludeOrOmitCellsWithoutChangingTheAggregate() {
		SpatialSelectionCriteria criteria =
				new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null);

		var withoutCells = service.getDaily(criteria, LocalDate.of(2024, 3, 18), false);
		var withCells = service.getDaily(criteria, LocalDate.of(2024, 3, 18), true);

		assertThat(withoutCells.value()).isEqualTo(2.0);
		assertThat(withoutCells.cells()).isNull();
		assertThat(withCells.value()).isEqualTo(withoutCells.value());
		assertThat(withCells.cells()).hasSize(2);
		assertThat(withCells.sourceComposition()).singleElement().satisfies(source -> {
			assertThat(source.source()).isEqualTo("SNPP");
			assertThat(source.cellCount()).isEqualTo(2);
			assertThat(source.contributingCellDayCount()).isEqualTo(2);
		});
	}

	@Test
	void exactDateMapDailyAndDailyCalendarUseTheSameAggregate() {
		SpatialSelectionCriteria criteria =
				new SpatialSelectionCriteria("national", "ToanQuoc", null, null, null, null);
		LocalDate date = LocalDate.of(2024, 3, 18);

		var map = service.getMap(criteria, new TemporalSelectionCriteria(date, null, null, null));
		var daily = service.getDaily(criteria, date, false);
		var calendar = service.getDailyCalendar(criteria, 2024, 3);
		var calendarDay = calendar.values().stream()
				.filter(value -> value.date().equals(date))
				.findFirst()
				.orElseThrow();

		assertThat(map.summary().totalValue()).isEqualTo(daily.value());
		assertThat(calendarDay.value()).isEqualTo(daily.value());
		assertThat(map.summary().origin()).isEqualTo(daily.origin());
		assertThat(calendarDay.origin()).isEqualTo(daily.origin());
	}

	@Test
	void ignoresZeroValueSourcesWhenResolvingAggregateOrigin() {
		ProvenanceServiceImpl provenance = new ProvenanceServiceImpl(() -> manifest);

		assertThat(provenance.resolveOrigin(List.of(
				new SourceComposition(3, 1, 1, 0.0, 0, 1),
				new SourceComposition(4, 1, 1, 5.0, 5, 1))))
				.isEqualTo(ActivityOrigin.SCALED_OBSERVATION);
		assertThat(provenance.resolveOrigin(List.of(
				new SourceComposition(3, 1, 1, 0.0, 0, 1),
				new SourceComposition(4, 1, 1, 0.0, 0, 1))))
				.isEqualTo(ActivityOrigin.MIXED);
	}

	private ActivityServiceImpl serviceWithValue(double valuePerCellDay) {
		DatasetMetadataRepository metadata = () -> manifest;
		TemporalSelectionServiceImpl temporal = new TemporalSelectionServiceImpl(metadata);
		ProvenanceServiceImpl provenance = new ProvenanceServiceImpl(metadata);
		SpatialSelectionService spatial = new FixedSpatialSelectionService(selection);
		return new ActivityServiceImpl(
				spatial,
				temporal,
				new DeterministicActivityRepository(valuePerCellDay),
				provenance,
				metadata);
	}

	private static DatasetManifest manifest() {
		return new DatasetManifest(
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
				new DatasetManifest.Grid(0.25, 2, "cells.csv", List.of("cell-a", "cell-b")),
				new DatasetManifest.Layout("row-major[date][cell]", "little-endian", "none"),
				List.of(),
				List.of(
						new DatasetManifest.SourceCodeDefinition(
								3, "SNPP", "DIRECT_OBSERVATION", "SNPP",
								"2012-01-20", "2026-11-01", 1, null, null),
						new DatasetManifest.SourceCodeDefinition(
								4, "NOAA20", "SCALED_OBSERVATION", "NOAA20",
								"2018-01-01", "2026-11-13", 1, null, null)),
				new DatasetManifest.Periods(List.of(), List.of()),
				List.of(),
				new DatasetManifest.Capabilities(List.of()),
				List.of(),
				List.of(),
				null,
				null);
	}

	private static SpatialSelection selection() {
		List<CellArea> cells = List.of(
				new CellArea("cell-a", 0, 0, 10.125, 105.125,
						10.0, 105.0, 10.25, 105.25, "Khac"),
				new CellArea("cell-b", 0, 1, 10.125, 105.375,
						10.0, 105.25, 10.25, 105.5, "Khac"));
		return new SpatialSelection(
				SelectionType.NAMED_AREA,
				SelectionRule.NAMED_AREA_MEMBERSHIP,
				new AreaDefinition(AreaType.NATIONAL, "ToanQuoc", List.of("cell-a", "cell-b")),
				null,
				new Bounds(105.0, 10.0, 105.5, 10.25),
				cells);
	}

	private record FixedSpatialSelectionService(SpatialSelection selection)
			implements SpatialSelectionService {

		@Override
		public SpatialSelection resolve(SpatialSelectionCriteria criteria) {
			return selection;
		}

		@Override
		public SpatialSelection resolveOrNational(SpatialSelectionCriteria criteria) {
			return selection;
		}
	}

	private static final class DeterministicActivityRepository implements ActivityQueryRepository {

		private final double valuePerCellDay;

		private DeterministicActivityRepository(double valuePerCellDay) {
			this.valuePerCellDay = valuePerCellDay;
		}

		@Override
		public ActivityAggregate summarize(
				Collection<String> cellIds,
				LocalDate startInclusive,
				LocalDate endInclusive) {
			int days = dayCount(startInclusive, endInclusive);
			long cellDays = (long) cellIds.size() * days;
			double value = valuePerCellDay * cellDays;
			return new ActivityAggregate(
					startInclusive,
					endInclusive,
					cellIds.size(),
					days,
					value,
					List.of(new SourceComposition(
							3, cellIds.size(), cellDays, value, (long) value, cellDays)));
		}

		@Override
		public ActivityDailySeries dailySeries(
				Collection<String> cellIds,
				LocalDate startInclusive,
				LocalDate endInclusive) {
			double[] values = new double[dayCount(startInclusive, endInclusive)];
			java.util.Arrays.fill(values, valuePerCellDay * cellIds.size());
			return new ActivityDailySeries(startInclusive, values);
		}

		@Override
		public List<CellActivityAggregate> summarizeCells(
				Collection<String> cellIds,
				LocalDate startInclusive,
				LocalDate endInclusive) {
			int days = dayCount(startInclusive, endInclusive);
			double value = valuePerCellDay * days;
			return cellIds.stream()
					.map(cellId -> new CellActivityAggregate(
							cellId,
							startInclusive,
							endInclusive,
							value,
							List.of(new SourceComposition(3, 1, days, value, (long) value, days))))
					.toList();
		}

		private static int dayCount(LocalDate start, LocalDate end) {
			return Math.toIntExact(ChronoUnit.DAYS.between(start, end) + 1);
		}
	}
}
