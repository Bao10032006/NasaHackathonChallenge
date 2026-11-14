package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.CellActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

/** Expected values recomputed independently from the daily-mini fixture (TASK_03A_ARTIFACT_SPEC.md section 11). */
class FileActivityQueryRepositoryFixtureTests {

	private static final LocalDate FIRST = LocalDate.of(2026, 11, 10);
	private static final LocalDate LAST = LocalDate.of(2026, 11, 13);
	private static final List<String> ALL_CELLS = List.of("34_419", "34_420", "45_428", "45_429");

	private FileDailyActivityRepository daily;
	private FileActivityQueryRepository queries;

	@BeforeEach
	void openFixture() throws URISyntaxException {
		Path fixtureRoot = Path.of(Objects.requireNonNull(
				getClass().getResource("/fixtures/daily-mini"),
				"daily-mini fixture must exist").toURI());
		daily = FileDailyActivityRepository.open(fixtureRoot, JsonMapper.builder().findAndAddModules().build());
		queries = new FileActivityQueryRepository(daily, FileAreaRepository.open(fixtureRoot, daily.getManifest()));
	}

	@Test
	void summarizesAllCellsWithDistinctCellAndCellDayCounts() {
		ActivityAggregate aggregate = queries.summarize(ALL_CELLS, FIRST, LAST);

		assertThat(aggregate.value()).isEqualTo(428.5);
		assertThat(aggregate.cellCount()).isEqualTo(4);
		assertThat(aggregate.dayCount()).isEqualTo(4);
		assertThat(aggregate.startDate()).isEqualTo(FIRST);
		assertThat(aggregate.endDate()).isEqualTo(LAST);
		assertThat(aggregate.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays,
						SourceComposition::value, SourceComposition::inputObservationCount,
						SourceComposition::sourceInputValidCellDays)
				.containsExactly(
						tuple(1, 2L, 2L, 4.0, 0L, 0L),
						tuple(2, 3L, 3L, 2.0, 1L, 3L),
						tuple(3, 4L, 5L, 162.0, 162L, 5L),
						tuple(4, 4L, 6L, 260.5, 264L, 6L));
	}

	@Test
	void inputOrderDoesNotChangeAnAggregate() {
		List<String> reversed = ALL_CELLS.reversed();

		assertThat(queries.summarize(reversed, FIRST, LAST)).isEqualTo(queries.summarize(ALL_CELLS, FIRST, LAST));
		assertThat(queries.dailySeries(reversed, FIRST, LAST)).isEqualTo(queries.dailySeries(ALL_CELLS, FIRST, LAST));
	}

	@Test
	void aggregatesASelectionThatCrossesDiagnosticRegions() {
		List<String> crossRegion = List.of("34_420", "45_428");

		ActivityAggregate aggregate = queries.summarize(crossRegion, FIRST, LAST);

		assertThat(aggregate.value()).isEqualTo(10.5);
		assertThat(aggregate.cellCount()).isEqualTo(2);
		assertThat(aggregate.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays,
						SourceComposition::value, SourceComposition::inputObservationCount,
						SourceComposition::sourceInputValidCellDays)
				.containsExactly(
						tuple(1, 1L, 1L, 3.75, 0L, 0L),
						tuple(2, 2L, 2L, 1.5, 1L, 2L),
						tuple(3, 2L, 2L, 3.0, 3L, 2L),
						tuple(4, 2L, 3L, 2.25, 3L, 3L));
		assertThat(queries.dailySeries(crossRegion, FIRST, LAST).values()).containsExactly(3.0, 2.25, 1.5, 3.75);
	}

	@Test
	void summarizesCellsInInputOrder() {
		List<CellActivityAggregate> cells = queries.summarizeCells(List.of("45_429", "34_419"), FIRST, LAST);

		assertThat(cells).extracting(CellActivityAggregate::cellId).containsExactly("45_429", "34_419");
		assertThat(cells.get(0).value()).isEqualTo(417.25);
		assertThat(cells.get(0).sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays,
						SourceComposition::value, SourceComposition::inputObservationCount,
						SourceComposition::sourceInputValidCellDays)
				.containsExactly(
						tuple(3, 1L, 2L, 159.0, 159L, 2L),
						tuple(4, 1L, 2L, 258.25, 261L, 2L));
		assertThat(cells.get(1).value()).isEqualTo(0.75);
		assertThat(cells.get(1).sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays, SourceComposition::value,
						SourceComposition::sourceInputValidCellDays)
				.containsExactly(
						tuple(1, 1L, 0.25, 0L),
						tuple(2, 1L, 0.5, 1L),
						tuple(3, 1L, 0.0, 1L),
						tuple(4, 1L, 0.0, 1L));
	}

	@Test
	void exactDateCellsCarryTheirSingleSource() {
		List<CellActivityAggregate> cells = queries.summarizeCells(List.of("45_428", "34_419"), LAST, LAST);

		assertThat(cells.get(0).value()).isZero();
		assertThat(cells.get(0).sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(tuple(2, 1L, 0L, 1L));
		assertThat(cells.get(1).value()).isEqualTo(0.25);
		assertThat(cells.get(1).sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(tuple(1, 1L, 0L, 0L));
	}

	@Test
	void cellTotalsAddUpToTheSelectionTotal() {
		double sumOfCells = queries.summarizeCells(ALL_CELLS, FIRST, LAST).stream()
				.mapToDouble(CellActivityAggregate::value)
				.sum();

		assertThat(sumOfCells).isEqualTo(queries.summarize(ALL_CELLS, FIRST, LAST).value());
	}

	@Test
	void precomputedAndOnDemandPathsAreIdentical() {
		FileActivityQueryRepository onDemand = new FileActivityQueryRepository(daily, List.of());
		List<List<String>> selections = List.of(ALL_CELLS, List.of("34_419", "34_420"), List.of("45_428", "45_429"));

		for (List<String> selection : selections) {
			for (LocalDate start = FIRST; !start.isAfter(LAST); start = start.plusDays(1)) {
				assertThat(onDemand.summarize(selection, start, LAST))
						.isEqualTo(queries.summarize(selection, start, LAST));
				assertThat(onDemand.dailySeries(selection, start, LAST))
						.isEqualTo(queries.dailySeries(selection, start, LAST));
			}
		}
	}

	@Test
	void rejectsInvalidSelectionsAndDates() {
		assertThatThrownBy(() -> queries.summarize(List.of(), FIRST, LAST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.summarize(null, FIRST, LAST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.summarize(Arrays.asList("34_419", null), FIRST, LAST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.summarize(List.of(" "), FIRST, LAST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.summarize(List.of("34_419", "34_419"), FIRST, LAST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.summarizeCells(List.of("1_1"), FIRST, LAST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.dailySeries(ALL_CELLS, LAST, FIRST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.summarize(ALL_CELLS, FIRST.minusDays(1), LAST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.summarize(ALL_CELLS, FIRST, LAST.plusDays(1)))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> queries.summarize(ALL_CELLS, null, LAST))
				.isInstanceOf(IllegalArgumentException.class);
	}
}
