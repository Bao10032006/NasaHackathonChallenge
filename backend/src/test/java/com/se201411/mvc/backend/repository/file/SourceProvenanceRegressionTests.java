package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.CellActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.AreaType;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;
import static org.assertj.core.api.Assertions.tuple;

/**
 * TASK 03B2A A2: provenance semantics of the activity query engine on the committed v1.0 snapshot.
 * The repository returns raw per-source composition; classifying it as DIRECT, SCALED, MODEL or
 * MIXED is the service's job, so these tests check that the composition is complete and truthful.
 */
class SourceProvenanceRegressionTests {

	private static final Path DATASET_ROOT = Path.of("hoalich_data_v1", "hoalich_data_v1");

	private static FileDailyActivityRepository daily;
	private static FileAreaRepository areas;
	private static FileActivityQueryRepository queries;
	private static List<String> national;
	private static LocalDate firstDay;
	private static LocalDate lastDay;

	@BeforeAll
	static void openCommittedSnapshot() {
		daily = FileDailyActivityRepository.open(DATASET_ROOT, JsonMapper.builder().findAndAddModules().build());
		areas = FileAreaRepository.open(DATASET_ROOT, daily.getManifest());
		queries = new FileActivityQueryRepository(daily, areas);
		national = areas.findArea(AreaType.NATIONAL, "ToanQuoc").orElseThrow().cellIds();
		firstDay = LocalDate.parse(daily.getManifest().dateRange().start());
		lastDay = LocalDate.parse(daily.getManifest().dateRange().end());
	}

	@Test
	void fullRangeCompositionMatchesTheManifestSourceCatalog() {
		ActivityAggregate all = queries.summarize(national, firstDay, lastDay);

		assertThat(all.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays)
				.containsExactlyElementsOf(daily.getManifest().sourceCodes().stream()
						.map(definition -> tuple(definition.code(), definition.cellDays()))
						.toList());
		assertThat(all.sources()).allSatisfy(source -> assertThat(source.cellCount()).isEqualTo(587L));
		assertThat(all.sources().stream().mapToLong(SourceComposition::cellDays).sum())
				.isEqualTo(587L * 9509L);
	}

	@Test
	void eachSourceStartsAndEndsOnTheDatesDeclaredInTheManifest() {
		for (DatasetManifest.SourceCodeDefinition definition : daily.getManifest().sourceCodes()) {
			LocalDate first = LocalDate.parse(definition.firstDate());
			LocalDate last = LocalDate.parse(definition.lastDate());

			assertThat(codes(queries.summarize(national, first, first))).contains(definition.code());
			assertThat(codes(queries.summarize(national, last, last))).contains(definition.code());
			if (first.isAfter(firstDay)) {
				assertThat(codes(queries.summarize(national, firstDay, first.minusDays(1))))
						.doesNotContain(definition.code());
			}
			if (last.isBefore(lastDay)) {
				assertThat(codes(queries.summarize(national, last.plusDays(1), lastDay)))
						.doesNotContain(definition.code());
			}
		}
	}

	@Test
	void directObservationValuesEqualTheirSnppInputCounts() {
		ActivityAggregate year = queries.summarize(national, LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31));
		SourceComposition snpp = source(year, 3);

		assertThat(snpp.cellDays()).isEqualTo(202000L);
		assertThat(snpp.value()).isEqualTo((double) snpp.inputObservationCount()).isEqualTo(50991.0);
	}

	@Test
	void scaledObservationValuesAreNoaa20CountsDividedByTheManifestDivisor() {
		double divisor = daily.getManifest().sourceCodes().stream()
				.filter(definition -> definition.code() == 4)
				.findFirst().orElseThrow()
				.scaleDivisor();
		ActivityAggregate year = queries.summarize(national, LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31));
		SourceComposition noaa20 = source(year, 4);

		assertThat(noaa20.cellDays()).isEqualTo(12842L);
		assertThat(noaa20.inputObservationCount()).isEqualTo(776L);
		assertThat(noaa20.value()).isCloseTo(noaa20.inputObservationCount() / divisor, offset(0.0001));
	}

	@Test
	void modelRedistributedValuesCanBePositiveWithZeroInputOnTheSameDay() {
		LocalDate day = LocalDate.of(2005, 3, 25);
		CellActivityAggregate cell = queries.summarizeCells(List.of("34_420"), day, day).getFirst();

		assertThat(cell.value()).isCloseTo(0.008256311528384686, offset(0.000000001));
		assertThat(cell.sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellDays,
						SourceComposition::inputObservationCount, SourceComposition::sourceInputValidCellDays)
				.containsExactly(tuple(2, 1L, 0L, 1L));
	}

	@Test
	void aquaFallbackAfterOrbitDriftIsVisibleInTheComposition() {
		ActivityAggregate sinceDrift = queries.summarize(national, LocalDate.of(2022, 1, 1), lastDay);
		SourceComposition aqua = source(sinceDrift, 2);

		assertThat(aqua.cellDays()).isEqualTo(328L);
		assertThat(aqua.cellCount()).isEqualTo(328L);

		LocalDate fallbackDay = LocalDate.of(2026, 11, 6);
		assertThat(queries.summarize(national, fallbackDay, fallbackDay).sources())
				.extracting(SourceComposition::sourceCode, SourceComposition::cellCount, SourceComposition::cellDays,
						SourceComposition::sourceInputValidCellDays)
				.containsExactly(
						tuple(2, 328L, 328L, 328L),
						tuple(4, 259L, 259L, 259L));
	}

	@Test
	void zeroValuedCellDaysStayInTheCompositionAsRealZeros() {
		LocalDate day = LocalDate.of(2024, 7, 1);
		List<String> bbox = List.of("48_428", "49_428");
		CellActivityAggregate zeroCell = queries.summarizeCells(bbox, day, day).stream()
				.filter(cell -> cell.value() == 0.0)
				.findFirst()
				.orElseThrow();

		assertThat(zeroCell.sources()).hasSize(1);
		assertThat(zeroCell.sources().getFirst().cellDays()).isEqualTo(1L);
		assertThat(zeroCell.sources().getFirst().value()).isZero();
	}

	@Test
	void compositionIsCompleteForRandomSelectionsAndRanges() {
		Random random = new Random(20261114L);
		List<String> pool = new ArrayList<>(national);
		for (int sample = 0; sample < 40; sample++) {
			Collections.shuffle(pool, random);
			List<String> selection = List.copyOf(pool.subList(0, 1 + random.nextInt(60)));
			int startOffset = random.nextInt(9509);
			int length = 1 + random.nextInt(Math.min(400, 9509 - startOffset));
			LocalDate start = firstDay.plusDays(startOffset);
			LocalDate end = start.plusDays(length - 1L);

			ActivityAggregate aggregate = queries.summarize(selection, start, end);

			double sourceTotal = aggregate.sources().stream().mapToDouble(SourceComposition::value).sum();
			assertThat(sourceTotal).isCloseTo(aggregate.value(), offset(1e-6 * Math.max(1.0, aggregate.value())));
			assertThat(aggregate.sources().stream().mapToLong(SourceComposition::cellDays).sum())
					.isEqualTo((long) selection.size() * length);
			assertThat(aggregate.sources().stream().mapToLong(SourceComposition::cellCount).sum())
					.isGreaterThanOrEqualTo(selection.size());
			assertThat(aggregate.sources()).allSatisfy(source -> {
				assertThat(source.cellCount()).isBetween(1L, Math.min(selection.size(), source.cellDays()));
				assertThat(source.sourceInputValidCellDays()).isLessThanOrEqualTo(source.cellDays());
			});
		}
	}

	private static List<Integer> codes(ActivityAggregate aggregate) {
		return aggregate.sources().stream().map(SourceComposition::sourceCode).toList();
	}

	private static SourceComposition source(ActivityAggregate aggregate, int code) {
		return aggregate.sources().stream()
				.filter(source -> source.sourceCode() == code)
				.findFirst()
				.orElseThrow();
	}
}
