package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.ActivityDailySeries;
import com.se201411.mvc.backend.domain.activity.CellActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.AreaType;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

/**
 * TASK 03B2A A3: calendar edge cases, dataset edges, partial periods and cache isolation of the
 * activity query engine on the committed v1.0 snapshot. Expected values were recomputed
 * independently with numpy from the derived binaries (float32 summed in float64).
 */
class ActivityQueryEdgeCaseRegressionTests {

	private static final Path DATASET_ROOT = Path.of("hoalich_data_v1", "hoalich_data_v1");
	private static final Offset<Double> EXACT = Offset.offset(0.000001);
	private static final List<String> BBOX_CELLS = List.of(
			"48_428", "48_429", "48_430", "48_431",
			"49_428", "49_429", "49_430", "49_431",
			"50_430", "50_431", "51_429", "51_430", "51_431");

	private static FileDailyActivityRepository daily;
	private static FileAreaRepository areas;
	private static FileActivityQueryRepository queries;
	private static List<String> national;

	@BeforeAll
	static void openCommittedSnapshot() {
		daily = FileDailyActivityRepository.open(DATASET_ROOT, JsonMapper.builder().findAndAddModules().build());
		areas = FileAreaRepository.open(DATASET_ROOT, daily.getManifest());
		queries = new FileActivityQueryRepository(daily, areas);
		national = areas.findArea(AreaType.NATIONAL, "ToanQuoc").orElseThrow().cellIds();
	}

	@Test
	void handlesTheLeapDayAndLeapFebruary() {
		LocalDate leapDay = LocalDate.of(2024, 2, 29);
		ActivityAggregate day = queries.summarize(BBOX_CELLS, leapDay, leapDay);

		assertThat(day.value()).isCloseTo(8.0, EXACT);
		assertThat(day.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays)
				.containsExactly(tuple(3, 13L, 13L));

		ActivityDailySeries february2024 = queries.dailySeries(
				BBOX_CELLS, LocalDate.of(2024, 2, 1), leapDay);
		assertThat(february2024.size()).isEqualTo(29);
		assertThat(february2024.endDate()).isEqualTo(leapDay);
		assertThat(february2024.valueAt(28)).isCloseTo(8.0, EXACT);
		assertThat(queries.summarize(BBOX_CELLS, LocalDate.of(2024, 2, 1), leapDay).value())
				.isCloseTo(893.0, EXACT);

		ActivityAggregate february2023 = queries.summarize(
				BBOX_CELLS, LocalDate.of(2023, 2, 1), LocalDate.of(2023, 2, 28));
		assertThat(february2023.dayCount()).isEqualTo(28);
		assertThat(february2023.value()).isCloseTo(455.0, EXACT);
	}

	@Test
	void aggregatesTheCoveredPartOfNovember2026() {
		LocalDate start = LocalDate.of(2026, 11, 1);
		LocalDate dataThrough = LocalDate.of(2026, 11, 13);

		ActivityAggregate covered = queries.summarize(BBOX_CELLS, start, dataThrough);

		assertThat(covered.dayCount()).isEqualTo(13);
		assertThat(covered.value()).isCloseTo(3.185015, EXACT);
		// S-NPP is present on 2026-11-01 with value 0: origin rules must look at positive contributions only.
		assertThat(covered.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays)
				.containsExactly(
						tuple(2, 13L, 13L),
						tuple(3, 13L, 13L),
						tuple(4, 13L, 143L));
		assertThat(covered.sources().get(1).value()).isZero();
		assertThat(covered.sources().get(0).value()).isCloseTo(0.216422, EXACT);
		assertThat(covered.sources().get(2).value()).isCloseTo(2.968594, EXACT);

		double[] days = queries.dailySeries(BBOX_CELLS, start, dataThrough).values();
		assertThat(days).containsExactly(
				new double[] {0, 0, 0, 0, 0.989531, 0.216422, 0, 0, 1.979063, 0, 0, 0, 0}, EXACT);
	}

	@Test
	void coversBothDatasetEdgesAndTheWholeRange() {
		LocalDate first = LocalDate.parse(daily.getManifest().dateRange().start());
		LocalDate last = LocalDate.parse(daily.getManifest().dateRange().end());

		assertThat(queries.summarize(national, first, first).value()).isCloseTo(44.967233, EXACT);
		assertThat(queries.summarize(national, last, last).value()).isCloseTo(5.937188, EXACT);

		ActivityAggregate year2000 = queries.summarize(national, first, LocalDate.of(2000, 12, 31));
		assertThat(year2000.dayCount()).isEqualTo(61);
		assertThat(year2000.value()).isCloseTo(3046.126950, EXACT);
		assertThat(year2000.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays)
				.containsExactly(tuple(1, 587L, 35807L));

		ActivityAggregate all = queries.summarize(national, first, last);
		ActivityDailySeries series = queries.dailySeries(national, first, last);
		assertThat(all.dayCount()).isEqualTo(9509);
		assertThat(series.size()).isEqualTo(9509);
		// 9509 daily sums of ~1.8e6 in total: allow for summation-order differences (numpy pairwise vs
		// sequential vs DoubleStream compensated), still far below the 0.01 contract tolerance.
		Offset<Double> fullRange = Offset.offset(0.0001);
		assertThat(all.value()).isCloseTo(1774721.588573, fullRange);
		assertThat(Arrays.stream(series.values()).sum()).isCloseTo(all.value(), fullRange);
	}

	@Test
	void sameSizeSelectionsNeverShareACachedTable() {
		LocalDate start = LocalDate.of(2024, 1, 1);
		LocalDate end = LocalDate.of(2024, 12, 31);
		List<String> dbsh = areas.findArea(AreaType.DIAGNOSTIC_REGION, "DBSH").orElseThrow().cellIds();
		List<String> otherCells = national.stream().filter(cell -> !dbsh.contains(cell)).limit(dbsh.size()).toList();

		ActivityAggregate cachedRegion = queries.summarize(dbsh, start, end);
		ActivityAggregate sameSize = queries.summarize(otherCells, start, end);

		assertThat(otherCells).hasSize(33).doesNotContainAnyElementsOf(dbsh);
		assertThat(cachedRegion.value()).isCloseTo(696.874375, EXACT);
		assertThat(sameSize.value()).isCloseTo(2454.968594, EXACT);
		assertThat(sameSize).isEqualTo(new FileActivityQueryRepository(daily, List.of())
				.summarize(otherCells, start, end));
	}

	@Test
	void allNationalCellTotalsAddUpToTheNationalTotal() {
		LocalDate start = LocalDate.of(2024, 1, 1);
		LocalDate end = LocalDate.of(2024, 12, 31);

		List<CellActivityAggregate> cells = queries.summarizeCells(national, start, end);
		double cellSum = cells.stream().mapToDouble(CellActivityAggregate::value).sum();

		assertThat(cells).extracting(CellActivityAggregate::cellId).containsExactlyElementsOf(national);
		assertThat(queries.summarize(national, start, end).value()).isCloseTo(51758.876274, EXACT);
		assertThat(cellSum).isCloseTo(51758.876274, EXACT);
	}
}
