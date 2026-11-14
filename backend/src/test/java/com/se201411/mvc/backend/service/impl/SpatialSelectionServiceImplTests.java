package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.spatial.SelectionRule;
import com.se201411.mvc.backend.domain.spatial.SelectionType;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.repository.file.FileAreaRepository;
import com.se201411.mvc.backend.repository.file.FileDailyActivityRepository;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

class SpatialSelectionServiceImplTests {

	private SpatialSelectionServiceImpl service;

	@BeforeEach
	void openFixture() throws URISyntaxException {
		Path fixtureRoot = Path.of(Objects.requireNonNull(
				getClass().getResource("/fixtures/daily-mini"),
				"daily-mini fixture must exist").toURI());
		FileDailyActivityRepository daily = FileDailyActivityRepository.open(
				fixtureRoot, JsonMapper.builder().findAndAddModules().build());
		service = new SpatialSelectionServiceImpl(FileAreaRepository.open(fixtureRoot, daily.getManifest()));
	}

	@Test
	void resolvesNamedNationalAreaInDatasetOrder() {
		SpatialSelection selection = service.resolve(SpatialSelectionCriteria.national());

		assertThat(selection.type()).isEqualTo(SelectionType.NAMED_AREA);
		assertThat(selection.selectionRule()).isEqualTo(SelectionRule.NAMED_AREA_MEMBERSHIP);
		assertThat(selection.area().id()).isEqualTo("ToanQuoc");
		assertThat(selection.cellIds())
				.containsExactly("34_419", "34_420", "45_428", "45_429");
		assertThat(selection.selectedBounds().west()).isEqualTo(104.75);
		assertThat(selection.selectedBounds().south()).isEqualTo(8.5);
		assertThat(selection.selectedBounds().east()).isEqualTo(107.5);
		assertThat(selection.selectedBounds().north()).isEqualTo(11.5);
	}

	@Test
	void selectsCentersOnEveryBboxBoundaryAndReturnsFullCellEnvelope() {
		SpatialSelection selection = service.resolve(new SpatialSelectionCriteria(
				null, null, 104.875, 8.625, 105.125, 8.7));

		assertThat(selection.type()).isEqualTo(SelectionType.BOUNDING_BOX);
		assertThat(selection.selectionRule()).isEqualTo(SelectionRule.CENTER_INCLUSIVE);
		assertThat(selection.cellIds()).containsExactly("34_419", "34_420");
		assertThat(selection.requestedBounds().west()).isEqualTo(104.875);
		assertThat(selection.selectedBounds().west()).isEqualTo(104.75);
		assertThat(selection.selectedBounds().south()).isEqualTo(8.5);
		assertThat(selection.selectedBounds().east()).isEqualTo(105.25);
		assertThat(selection.selectedBounds().north()).isEqualTo(8.75);
	}

	@Test
	void defaultsToNationalOnlyWhenExplicitlyRequestedByCaller() {
		SpatialSelection selection = service.resolveOrNational(
				new SpatialSelectionCriteria(null, null, null, null, null, null));

		assertThat(selection.area().id()).isEqualTo("ToanQuoc");
		assertThat(selection.cells()).hasSize(4);
	}

	@Test
	void rejectsMixedIncompleteInvalidAndEmptySpatialSelectorsWithStableCodes() {
		assertCode(
				new SpatialSelectionCriteria("national", "ToanQuoc", 104.0, 8.0, 105.0, 9.0),
				"INVALID_SPATIAL_SELECTOR");
		assertCode(
				new SpatialSelectionCriteria(null, null, 104.0, null, 105.0, 9.0),
				"INVALID_SPATIAL_SELECTOR");
		assertCode(
				new SpatialSelectionCriteria(null, null, 105.0, 8.0, 104.0, 9.0),
				"INVALID_BOUNDS");
		assertCode(
				new SpatialSelectionCriteria(null, null, 0.0, 0.0, 1.0, 1.0),
				"NO_CELLS_IN_BOUNDS");
		assertCode(
				new SpatialSelectionCriteria("province", "x", null, null, null, null),
				"INVALID_PARAMETER");
		assertCode(
				new SpatialSelectionCriteria("diagnostic_region", "unknown", null, null, null, null),
				"AREA_NOT_FOUND");
	}

	private void assertCode(SpatialSelectionCriteria criteria, String expectedCode) {
		Throwable throwable = catchThrowable(() -> service.resolve(criteria));
		assertThat(throwable).isInstanceOf(ApiException.class);
		ApiException exception = (ApiException) throwable;
		assertThat(exception.code()).isEqualTo(expectedCode);
	}
}
