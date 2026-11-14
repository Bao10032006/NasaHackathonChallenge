package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.CellActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.AreaType;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Path;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

/**
 * Golden regression for the bbox {@code west=107,south=12,east=108,north=13} on the committed v1.0
 * snapshot (Document 08 v0.4, TASK 03B2 plan A3). The 13 cell IDs are the CENTER_INCLUSIVE result
 * of that bbox; resolving bboxes belongs to the service layer.
 */
class RealActivityQueryRegressionTests {

	private static final Path DATASET_ROOT = Path.of("hoalich_data_v1", "hoalich_data_v1");
	private static final Offset<Double> EXACT = Offset.offset(0.000001);
	private static final List<String> BBOX_CELLS = List.of(
			"48_428", "48_429", "48_430", "48_431",
			"49_428", "49_429", "49_430", "49_431",
			"50_430", "50_431", "51_429", "51_430", "51_431");

	private static FileDailyActivityRepository daily;
	private static FileAreaRepository areas;
	private static FileActivityQueryRepository queries;

	@BeforeAll
	static void openCommittedSnapshot() {
		daily = FileDailyActivityRepository.open(DATASET_ROOT, JsonMapper.builder().findAndAddModules().build());
		areas = FileAreaRepository.open(DATASET_ROOT, daily.getManifest());
		queries = new FileActivityQueryRepository(daily, areas);
	}

	@Test
	void matchesTheAnnual2024BboxTotalAndSources() {
		ActivityAggregate year = queries.summarize(BBOX_CELLS, LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31));

		assertThat(year.value()).isCloseTo(2182.780156, EXACT);
		assertThat(year.dayCount()).isEqualTo(366);
		assertThat(year.cellCount()).isEqualTo(13);
		assertThat(year.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(
						tuple(3, 13L, 4485L, 2162L, 4485L),
						tuple(4, 13L, 273L, 21L, 273L));
	}

	@Test
	void matchesTheMonthly2024SeriesAndItsFebruaryPeak() {
		double[] expected = {
				494.790625, 893.0, 450.0, 266.0, 31.0, 19.0, 0.0, 14.0, 1.0, 0.0, 6.989531, 7.0};
		double[] months = new double[12];
		for (int month = 1; month <= 12; month++) {
			YearMonth period = YearMonth.of(2024, month);
			months[month - 1] = queries.summarize(BBOX_CELLS, period.atDay(1), period.atEndOfMonth()).value();
		}

		for (int index = 0; index < 12; index++) {
			assertThat(months[index]).as("month %d", index + 1).isCloseTo(expected[index], EXACT);
		}
		int peak = 0;
		for (int index = 1; index < 12; index++) {
			if (months[index] > months[peak]) {
				peak = index;
			}
		}
		assertThat(peak + 1).isEqualTo(2);
	}

	@Test
	void matchesTheMarch2024DayCalendarAndExactDate() {
		double[] expected = {
				9, 21, 9, 16, 13, 4, 10, 27, 11, 0, 4, 21, 26, 6, 16, 18,
				25, 53, 31, 18, 4, 30, 23, 6, 8, 23, 5, 1, 0, 9, 3};
		LocalDate start = LocalDate.of(2024, 3, 1);

		assertThat(queries.dailySeries(BBOX_CELLS, start, LocalDate.of(2024, 3, 31)).values())
				.containsExactly(expected, EXACT);
		assertThat(queries.summarize(BBOX_CELLS, start, LocalDate.of(2024, 3, 31)).value()).isCloseTo(450.0, EXACT);

		LocalDate day = LocalDate.of(2024, 3, 18);
		ActivityAggregate exact = queries.summarize(BBOX_CELLS, day, day);
		assertThat(exact.value()).isCloseTo(53.0, EXACT);
		assertThat(exact.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays,
						SourceComposition::value, SourceComposition::inputObservationCount,
						SourceComposition::sourceInputValidCellDays)
				.containsExactly(tuple(3, 13L, 13L, 53.0, 53L, 13L));
		double cellSum = queries.summarizeCells(BBOX_CELLS, day, day).stream()
				.mapToDouble(CellActivityAggregate::value)
				.sum();
		assertThat(cellSum).isCloseTo(53.0, EXACT);
	}

	@Test
	void matchesTheMarch2005VersusMarch2024DualMapCells() {
		double[] march2005 = {
				185.077867, 757.173214, 463.340691, 432.395214, 0.010864, 132.642979, 317.438563,
				387.635774, 76.424433, 258.575795, 2.523358, 13.958186, 11.964253};
		double[] march2024 = {2, 34, 47, 50, 0, 6, 26, 69, 76, 28, 1, 33, 78};

		List<CellActivityAggregate> cells2005 = queries.summarizeCells(
				BBOX_CELLS, LocalDate.of(2005, 3, 1), LocalDate.of(2005, 3, 31));
		List<CellActivityAggregate> cells2024 = queries.summarizeCells(
				BBOX_CELLS, LocalDate.of(2024, 3, 1), LocalDate.of(2024, 3, 31));

		assertThat(cells2005).extracting(CellActivityAggregate::cellId).containsExactlyElementsOf(BBOX_CELLS);
		assertThat(cells2024).extracting(CellActivityAggregate::cellId).containsExactlyElementsOf(BBOX_CELLS);
		for (int index = 0; index < BBOX_CELLS.size(); index++) {
			assertThat(cells2005.get(index).value()).as(BBOX_CELLS.get(index)).isCloseTo(march2005[index], EXACT);
			assertThat(cells2024.get(index).value()).as(BBOX_CELLS.get(index)).isCloseTo(march2024[index], EXACT);
		}

		ActivityAggregate aggregate2005 = queries.summarize(
				BBOX_CELLS, LocalDate.of(2005, 3, 1), LocalDate.of(2005, 3, 31));
		assertThat(aggregate2005.value()).isCloseTo(3039.161190, EXACT);
		assertThat(aggregate2005.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(tuple(2, 13L, 403L, 426L, 403L));
	}

	@Test
	void namedAreaAndShuffledSelectionOfTheSameCellsAreIdentical() {
		List<String> tayNguyen = areas.findArea(AreaType.DIAGNOSTIC_REGION, "TayNguyen").orElseThrow().cellIds();
		List<String> shuffled = new ArrayList<>(tayNguyen);
		Collections.shuffle(shuffled, new Random(20261114L));
		LocalDate start = LocalDate.of(2024, 1, 1);
		LocalDate end = LocalDate.of(2024, 12, 31);

		assertThat(queries.summarize(shuffled, start, end)).isEqualTo(queries.summarize(tayNguyen, start, end));
		assertThat(queries.dailySeries(shuffled, start, end)).isEqualTo(queries.dailySeries(tayNguyen, start, end));
	}

	@Test
	void precomputedTablesMatchOnDemandAggregationOnRealData() {
		FileActivityQueryRepository onDemand = new FileActivityQueryRepository(daily, List.of());
		List<String> national = areas.findArea(AreaType.NATIONAL, "ToanQuoc").orElseThrow().cellIds();
		List<String> tayNguyen = areas.findArea(AreaType.DIAGNOSTIC_REGION, "TayNguyen").orElseThrow().cellIds();
		LocalDate first = LocalDate.parse(daily.getManifest().dateRange().start());
		LocalDate last = LocalDate.parse(daily.getManifest().dateRange().end());

		assertThat(onDemand.summarize(national, first, last)).isEqualTo(queries.summarize(national, first, last));
		assertThat(onDemand.summarize(tayNguyen, LocalDate.of(2005, 3, 25), LocalDate.of(2005, 3, 25)))
				.isEqualTo(queries.summarize(tayNguyen, LocalDate.of(2005, 3, 25), LocalDate.of(2005, 3, 25)));
		assertThat(onDemand.dailySeries(tayNguyen, LocalDate.of(2012, 1, 1), LocalDate.of(2012, 12, 31)))
				.isEqualTo(queries.dailySeries(tayNguyen, LocalDate.of(2012, 1, 1), LocalDate.of(2012, 12, 31)));
	}
}
