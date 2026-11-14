package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.area.AreaType;
import com.se201411.mvc.backend.domain.area.CellArea;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

class FileAreaRepositoryFixtureTests {

	private final ObjectMapper objectMapper = JsonMapper.builder().findAndAddModules().build();

	@Test
	void readsCellsBoundsAndDiagnosticRegionsInDatasetOrder() throws URISyntaxException {
		FileAreaRepository areas = openFixture();

		assertThat(areas.findAllCells())
				.extracting(CellArea::cellId)
				.containsExactly("34_419", "34_420", "45_428", "45_429");

		CellArea first = areas.findCell("34_419").orElseThrow();
		assertThat(first.diagnosticRegion()).isEqualTo("DBSCL");
		assertThat(first.cy()).isEqualTo(34);
		assertThat(first.cx()).isEqualTo(419);
		assertThat(first.centerLat()).isEqualTo(8.625);
		assertThat(first.centerLon()).isEqualTo(104.875);
		assertThat(first.south()).isEqualTo(8.5);
		assertThat(first.west()).isEqualTo(104.75);
		assertThat(first.north()).isEqualTo(8.75);
		assertThat(first.east()).isEqualTo(105.0);

		assertThat(areas.findDiagnosticRegionIds()).containsExactly("DBSCL", "TayNguyen");
	}

	@Test
	void resolvesNationalRegionAndCellAreas() throws URISyntaxException {
		FileAreaRepository areas = openFixture();

		assertThat(areas.findArea(AreaType.NATIONAL, "ToanQuoc").orElseThrow().cellIds())
				.containsExactly("34_419", "34_420", "45_428", "45_429");
		assertThat(areas.findArea(AreaType.DIAGNOSTIC_REGION, "TayNguyen").orElseThrow().cellIds())
				.containsExactly("45_428", "45_429");
		assertThat(areas.findArea(AreaType.CELL, "45_429").orElseThrow().cellIds())
				.containsExactly("45_429");
	}

	@Test
	void returnsEmptyForUnsupportedAreaIds() throws URISyntaxException {
		FileAreaRepository areas = openFixture();

		assertThat(areas.findArea(AreaType.NATIONAL, "VN")).isEmpty();
		assertThat(areas.findArea(AreaType.DIAGNOSTIC_REGION, "HaNoi")).isEmpty();
		assertThat(areas.findArea(AreaType.CELL, "1_1")).isEmpty();
		assertThat(areas.findArea(AreaType.CELL, null)).isEmpty();
		assertThat(areas.findCell("1_1")).isEmpty();
	}

	@Test
	void mapsApiAreaTypeValues() {
		assertThat(AreaType.fromApiValue("national")).isEqualTo(AreaType.NATIONAL);
		assertThat(AreaType.fromApiValue("diagnostic_region")).isEqualTo(AreaType.DIAGNOSTIC_REGION);
		assertThat(AreaType.fromApiValue("cell")).isEqualTo(AreaType.CELL);
	}

	private FileAreaRepository openFixture() throws URISyntaxException {
		Path fixtureRoot = Path.of(Objects.requireNonNull(
				getClass().getResource("/fixtures/daily-mini"),
				"daily-mini fixture must exist").toURI());
		FileDailyActivityRepository daily = FileDailyActivityRepository.open(fixtureRoot, objectMapper);
		return FileAreaRepository.open(fixtureRoot, daily.getManifest());
	}
}
