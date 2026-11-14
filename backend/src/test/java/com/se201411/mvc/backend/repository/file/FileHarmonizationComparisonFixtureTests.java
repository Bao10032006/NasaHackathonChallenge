package com.se201411.mvc.backend.repository.file;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

class FileHarmonizationComparisonFixtureTests {

	@Test
	void isUnavailableWhenTheManifestDoesNotDeclareTheTable() throws URISyntaxException {
		Path fixtureRoot = Path.of(Objects.requireNonNull(
				getClass().getResource("/fixtures/daily-mini"),
				"daily-mini fixture must exist").toURI());
		FileDailyActivityRepository daily = FileDailyActivityRepository.open(
				fixtureRoot, JsonMapper.builder().findAndAddModules().build());

		FileHarmonizationComparisonRepository comparison =
				FileHarmonizationComparisonRepository.open(fixtureRoot, daily.getManifest());

		assertThat(comparison.isAvailable()).isFalse();
		assertThat(comparison.findAll()).isEmpty();
	}
}
