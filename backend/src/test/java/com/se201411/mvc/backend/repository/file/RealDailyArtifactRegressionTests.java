package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.DailyActivityDay;
import com.se201411.mvc.backend.domain.activity.DailyCellActivity;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class RealDailyArtifactRegressionTests {

	private static final Path DATASET_ROOT = Path.of("hoalich_data_v1", "hoalich_data_v1");
	private static FileDailyActivityRepository repository;
	private static List<String> tayNguyenCells;

	@BeforeAll
	static void openCommittedSnapshot() throws IOException {
		repository = FileDailyActivityRepository.open(
				DATASET_ROOT,
				JsonMapper.builder().findAndAddModules().build());
		tayNguyenCells = readRegionCells(DATASET_ROOT.resolve("tables/cells_025.csv"), "TayNguyen");
	}

	@Test
	void matchesTayNguyenModelRedistributedRegressionSampleR1() {
		DailyActivityDay day = repository.findByDate(LocalDate.of(2005, 3, 25), tayNguyenCells);

		assertThat(day.cells()).hasSize(122);
		assertThat(total(day)).isCloseTo(171.635599, within(0.000001));
		assertThat(sourceCodes(day)).containsExactly(2);
		assertThat(totalInputCount(day)).isEqualTo(21);
		assertThat(validCellCount(day)).isEqualTo(122);
	}

	@Test
	void matchesNationwideDirectObservationRegressionSampleR2() {
		DailyActivityDay day = allCellsOn(LocalDate.of(2012, 3, 6));

		assertThat(day.cells()).hasSize(587);
		assertThat(total(day)).isEqualTo(2275.0);
		assertThat(sourceCodes(day)).containsExactly(3);
		assertThat(totalInputCount(day)).isEqualTo(2275);
		assertThat(validCellCount(day)).isEqualTo(587);
	}

	@Test
	void matchesNationwideScaledObservationRegressionSampleR3() {
		DailyActivityDay day = allCellsOn(LocalDate.of(2026, 4, 29));

		assertThat(total(day)).isCloseTo(193.948132, within(0.000001));
		assertThat(sourceCodes(day)).containsExactly(4);
		assertThat(totalInputCount(day)).isEqualTo(196);
		assertThat(validCellCount(day)).isEqualTo(587);
	}

	@Test
	void matchesCellLevelRegressionSamplesR4AndR5() {
		DailyCellActivity snpp = repository.findByDate(
				LocalDate.of(2019, 1, 7), List.of("59_430")).cells().getFirst();
		assertThat(snpp.value()).isEqualTo(2.0f);
		assertThat(Float.floatToRawIntBits(snpp.value())).isEqualTo(0x40000000);
		assertThat(snpp.sourceCode()).isEqualTo(3);
		assertThat(snpp.inputObservationCount()).isEqualTo(2);
		assertThat(snpp.sourceInputValid()).isTrue();

		DailyCellActivity noaa20 = repository.findByDate(
				LocalDate.of(2024, 9, 27), List.of("87_422")).cells().getFirst();
		assertThat(noaa20.value()).isEqualTo(0.9895312786102295f);
		assertThat(Float.floatToRawIntBits(noaa20.value())).isEqualTo(0x3F7D51EC);
		assertThat(noaa20.sourceCode()).isEqualTo(4);
		assertThat(noaa20.inputObservationCount()).isEqualTo(1);
		assertThat(noaa20.sourceInputValid()).isTrue();
	}

	@Test
	void matchesAquaFallbackCodeCountRegressionSampleR6() {
		DailyActivityDay day = allCellsOn(LocalDate.of(2026, 11, 6));

		assertThat(day.cells().stream().filter(cell -> cell.sourceCode() == 2).count()).isEqualTo(328);
	}

	private static DailyActivityDay allCellsOn(LocalDate date) {
		return repository.findByDate(date, repository.getManifest().grid().cellIds());
	}

	private static double total(DailyActivityDay day) {
		return day.cells().stream().mapToDouble(DailyCellActivity::value).sum();
	}

	private static int totalInputCount(DailyActivityDay day) {
		return day.cells().stream().mapToInt(DailyCellActivity::inputObservationCount).sum();
	}

	private static long validCellCount(DailyActivityDay day) {
		return day.cells().stream().filter(DailyCellActivity::sourceInputValid).count();
	}

	private static Set<Integer> sourceCodes(DailyActivityDay day) {
		return day.cells().stream()
				.map(DailyCellActivity::sourceCode)
				.collect(Collectors.toSet());
	}

	private static List<String> readRegionCells(Path cellsCsv, String region) throws IOException {
		try (var lines = Files.lines(cellsCsv)) {
			return lines.skip(1)
					.map(line -> line.split(",", -1))
					.filter(columns -> columns.length > 7 && region.equals(columns[7]))
					.map(columns -> columns[0])
					.toList();
		}
	}

	private static org.assertj.core.data.Offset<Double> within(double value) {
		return org.assertj.core.data.Offset.offset(value);
	}
}
