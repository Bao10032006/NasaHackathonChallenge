package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.AreaActivitySummary;
import com.se201411.mvc.backend.domain.activity.AreaDailySeries;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.AreaType;
import com.se201411.mvc.backend.domain.area.SocioeconomicRegion;
import com.se201411.mvc.backend.domain.methodology.NationalYearComparison;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

/** Regression samples on the committed v1.0 snapshot (TASK_03A_ARTIFACT_SPEC.md section 8.3). */
class RealAreaActivityRegressionTests {

	private static final Path DATASET_ROOT = Path.of("hoalich_data_v1", "hoalich_data_v1");

	private static FileAreaRepository areas;
	private static FileAreaActivityRepository activity;
	private static FileHarmonizationComparisonRepository comparison;

	@BeforeAll
	static void openCommittedSnapshot() {
		FileDailyActivityRepository daily = FileDailyActivityRepository.open(
				DATASET_ROOT, JsonMapper.builder().findAndAddModules().build());
		areas = FileAreaRepository.open(DATASET_ROOT, daily.getManifest());
		activity = new FileAreaActivityRepository(daily, areas);
		comparison = FileHarmonizationComparisonRepository.open(DATASET_ROOT, daily.getManifest());
	}

	@Test
	void exposesTheFiveDiagnosticRegionsWithTheirCellCounts() {
		assertThat(areas.findAllCells()).hasSize(587);
		assertThat(areas.findDiagnosticRegionIds())
				.containsExactlyInAnyOrder("DBSCL", "DBSH", "Khac", "TayBac", "TayNguyen");
		assertThat(cellCount("DBSCL")).isEqualTo(71);
		assertThat(cellCount("DBSH")).isEqualTo(33);
		assertThat(cellCount("Khac")).isEqualTo(262);
		assertThat(cellCount("TayBac")).isEqualTo(99);
		assertThat(cellCount("TayNguyen")).isEqualTo(122);
	}

	@Test
	void resolvesSevenSocioeconomicRegionsWithoutDoubleCounting() {
		List<AreaDefinition> regions = Arrays.stream(SocioeconomicRegion.values())
				.map(region -> areas.findArea(AreaType.SOCIOECONOMIC_REGION, region.id()).orElseThrow())
				.toList();
		assertThat(regions).extracting(region -> region.cellIds().size())
				.containsExactly(161, 41, 103, 82, 84, 40, 72);

		List<String> assignedCells = regions.stream().flatMap(region -> region.cellIds().stream()).toList();
		assertThat(assignedCells).doesNotHaveDuplicates();
		Set<String> assignedIds = Set.copyOf(assignedCells);
		List<String> nationalIds = national().cellIds();
		assertThat(nationalIds.stream().filter(id -> !assignedIds.contains(id)).toList())
				.containsExactly("54_429", "58_429", "78_415", "82_413");
		for (AreaDefinition region : regions) {
			Set<String> ids = Set.copyOf(region.cellIds());
			assertThat(region.cellIds()).containsExactlyElementsOf(nationalIds.stream().filter(ids::contains).toList());
		}
	}

	@Test
	void matchesR1ThroughTheAreaIndex() {
		AreaActivitySummary summary = activity.summarize(
				region("TayNguyen"), LocalDate.of(2005, 3, 25), LocalDate.of(2005, 3, 25));

		assertThat(summary.value()).isCloseTo(171.635599, Offset.offset(0.000001));
		assertThat(summary.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(tuple(2, 122L, 21L, 122L));
	}

	@Test
	void matchesR2ThroughTheAreaIndex() {
		AreaActivitySummary summary = activity.summarize(
				national(), LocalDate.of(2012, 3, 6), LocalDate.of(2012, 3, 6));

		assertThat(summary.value()).isCloseTo(2275.0, Offset.offset(0.000000001));
		assertThat(summary.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(tuple(3, 587L, 2275L, 587L));
	}

	@Test
	void matchesR7SeasonalityFromDailyValues() {
		double[] pentad15 = new double[23];
		for (int year = 2003; year <= 2025; year++) {
			LocalDate start = LocalDate.ofYearDay(year, 71);
			pentad15[year - 2003] = activity.summarize(region("TayNguyen"), start, start.plusDays(4)).value();
		}
		double[] sorted = pentad15.clone();
		Arrays.sort(sorted);
		double mean = Arrays.stream(pentad15).average().orElseThrow();

		assertThat(sorted[11]).isCloseTo(1373.0, Offset.offset(0.000001));
		assertThat(mean).isCloseTo(1672.6, Offset.offset(0.05));
	}

	@Test
	void monthlyTotalFromDailyValuesMatchesThePipelineAggregation() {
		AreaActivitySummary march2012 = activity.summarize(
				national(), LocalDate.of(2012, 3, 1), LocalDate.of(2012, 3, 31));

		assertThat(march2012.dayCount()).isEqualTo(31);
		assertThat(march2012.value()).isCloseTo(26089.757095, Offset.offset(0.000001));
	}

	@Test
	void dailySeriesAgreesWithSummary() {
		LocalDate day = LocalDate.of(2005, 3, 25);
		AreaDailySeries series = activity.dailySeries(region("TayNguyen"), day, day.plusDays(2));

		assertThat(series.size()).isEqualTo(3);
		assertThat(series.valueAt(0)).isEqualTo(activity.summarize(region("TayNguyen"), day, day).value());
	}

	@Test
	void readsTheVerifiedNationalComparisonTable() {
		assertThat(comparison.isAvailable()).isTrue();
		List<NationalYearComparison> rows = comparison.findAll();

		assertThat(rows).hasSize(27);
		assertThat(rows.getFirst().year()).isEqualTo(2000);
		assertThat(rows.getLast().year()).isEqualTo(2026);
		assertThat(rows.getFirst())
				.extracting(NationalYearComparison::harmonizedSnppEq, NationalYearComparison::terraRawDaytime,
						NationalYearComparison::rawMergedAllDetections)
				.containsExactly(3046.1, 171L, 181L);
		NationalYearComparison year2015 = rows.stream().filter(row -> row.year() == 2015).findFirst().orElseThrow();
		assertThat(year2015)
				.extracting(NationalYearComparison::harmonizedSnppEq, NationalYearComparison::aquaRawDaytime,
						NationalYearComparison::terraRawDaytime, NationalYearComparison::snppRawDaytime,
						NationalYearComparison::rawMergedAllDetections)
				.containsExactly(88898.0, 14703L, 5440L, 88898L, 124575L);
	}

	private static int cellCount(String region) {
		return region(region).cellIds().size();
	}

	private static AreaDefinition region(String id) {
		return areas.findArea(AreaType.DIAGNOSTIC_REGION, id).orElseThrow();
	}

	private static AreaDefinition national() {
		return areas.findArea(AreaType.NATIONAL, AreaDefinition.NATIONAL_ID).orElseThrow();
	}
}
