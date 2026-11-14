package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.AreaActivitySummary;
import com.se201411.mvc.backend.domain.activity.AreaDailySeries;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.AreaType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

/** Expected values follow the synthetic fixture table in TASK_03A_ARTIFACT_SPEC.md section 11. */
class FileAreaActivityRepositoryFixtureTests {

	private static final LocalDate FIRST = LocalDate.of(2026, 11, 10);
	private static final LocalDate LAST = LocalDate.of(2026, 11, 13);

	private FileAreaRepository areas;
	private FileAreaActivityRepository activity;

	@BeforeEach
	void openFixture() throws URISyntaxException {
		Path fixtureRoot = Path.of(Objects.requireNonNull(
				getClass().getResource("/fixtures/daily-mini"),
				"daily-mini fixture must exist").toURI());
		FileDailyActivityRepository daily = FileDailyActivityRepository.open(
				fixtureRoot, JsonMapper.builder().findAndAddModules().build());
		areas = FileAreaRepository.open(fixtureRoot, daily.getManifest());
		activity = new FileAreaActivityRepository(daily, areas);
	}

	@Test
	void summarizesTheNationalAreaWithSourceComposition() {
		AreaActivitySummary summary = activity.summarize(area(AreaType.NATIONAL, "ToanQuoc"), FIRST, LAST);

		assertThat(summary.value()).isEqualTo(428.5);
		assertThat(summary.cellCount()).isEqualTo(4);
		assertThat(summary.dayCount()).isEqualTo(4);
		assertThat(summary.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays, SourceComposition::value,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(
						tuple(1, 2L, 4.0, 0L, 0L),
						tuple(2, 3L, 2.0, 1L, 3L),
						tuple(3, 5L, 162.0, 162L, 5L),
						tuple(4, 6L, 260.5, 264L, 6L));
	}

	@Test
	void returnsNationalDailyTotalsMatchingTheFixtureTable() {
		AreaDailySeries series = activity.dailySeries(area(AreaType.NATIONAL, "ToanQuoc"), FIRST, LAST);

		assertThat(series.values()).containsExactly(157.0, 257.5, 5.0, 9.0);
		assertThat(series.startDate()).isEqualTo(FIRST);
		assertThat(series.endDate()).isEqualTo(LAST);
	}

	@Test
	void reportsMixedSourcesForTayNguyenOnTheEdgeDate() {
		AreaActivitySummary summary = activity.summarize(area(AreaType.DIAGNOSTIC_REGION, "TayNguyen"), LAST, LAST);

		assertThat(summary.value()).isEqualTo(5.0);
		assertThat(summary.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays, SourceComposition::value,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(
						tuple(2, 1L, 0.0, 0L, 1L),
						tuple(3, 1L, 5.0, 5L, 1L));
	}

	@Test
	void keepsInvalidTerraInputAsAnAvailableValue() {
		AreaActivitySummary summary = activity.summarize(area(AreaType.DIAGNOSTIC_REGION, "DBSCL"), LAST, LAST);

		assertThat(summary.value()).isEqualTo(4.0);
		assertThat(summary.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays,
						SourceComposition::sourceInputValidCellDays)
				.containsExactly(tuple(1, 2L, 0L));
	}

	@Test
	void aggregatesASingleCellOnDemand() {
		AreaActivitySummary summary = activity.summarize(area(AreaType.CELL, "45_429"), FIRST, LAST);

		assertThat(summary.value()).isEqualTo(417.25);
		assertThat(summary.cellCount()).isEqualTo(1);
		assertThat(summary.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays, SourceComposition::value,
						SourceComposition::inputObservationCount)
				.containsExactly(
						tuple(3, 2L, 159.0, 159L),
						tuple(4, 2L, 258.25, 261L));

		AreaDailySeries series = activity.dailySeries(area(AreaType.CELL, "45_429"), LocalDate.of(2026, 11, 11), LAST);
		assertThat(series.values()).containsExactly(255.25, 3.0, 5.0);
	}

	@Test
	void regionTotalsAddUpToTheNationalTotal() {
		double dbscl = activity.summarize(area(AreaType.DIAGNOSTIC_REGION, "DBSCL"), FIRST, LAST).value();
		double tayNguyen = activity.summarize(area(AreaType.DIAGNOSTIC_REGION, "TayNguyen"), FIRST, LAST).value();

		assertThat(dbscl).isEqualTo(7.75);
		assertThat(tayNguyen).isEqualTo(420.75);
		assertThat(dbscl + tayNguyen).isEqualTo(428.5);
	}

	@Test
	void rejectsDatesOutsideTheDatasetAndReversedRanges() {
		AreaDefinition national = area(AreaType.NATIONAL, "ToanQuoc");

		assertThatThrownBy(() -> activity.summarize(national, LocalDate.of(2026, 11, 9), LAST))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> activity.summarize(national, FIRST, LocalDate.of(2026, 11, 14)))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> activity.dailySeries(national, LAST, FIRST))
				.isInstanceOf(IllegalArgumentException.class);
	}

	private AreaDefinition area(AreaType type, String id) {
		return areas.findArea(type, id).orElseThrow();
	}
}
