package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.DailyActivityDay;
import com.se201411.mvc.backend.domain.activity.DailyCellActivity;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

class DailyArtifactFixtureContractTests {

	private final ObjectMapper objectMapper = JsonMapper.builder().findAndAddModules().build();

	@Test
	void readsTheDataTeamFixtureUsingTheSharedBinaryContract() throws URISyntaxException {
		Path fixtureRoot = Path.of(Objects.requireNonNull(
				getClass().getResource("/fixtures/daily-mini"),
				"daily-mini fixture must exist").toURI());
		FileDailyActivityRepository repository = FileDailyActivityRepository.open(fixtureRoot, objectMapper);

		assertThat(repository.getManifest().schemaVersion()).isEqualTo("1.0.0");
		assertThat(repository.getManifest().dataVersion()).isEqualTo("fixture-daily-mini-1");
		assertThat(repository.getManifest().kind()).isEqualTo("fixture");

		DailyActivityDay endianProbeDay = repository.findByDate(
				LocalDate.of(2026, 11, 11),
				List.of("45_429"));
		DailyCellActivity endianProbe = endianProbeDay.cells().getFirst();
		assertThat(endianProbe.value()).isEqualTo(255.25f);
		assertThat(endianProbe.inputObservationCount()).isEqualTo(258);
		assertThat(endianProbe.sourceCode()).isEqualTo(4);
		assertThat(endianProbe.sourceInputValid()).isTrue();

		DailyCellActivity invalidTerraInput = repository.findByDate(
				LocalDate.of(2026, 11, 13),
				List.of("34_419")).cells().getFirst();
		assertThat(invalidTerraInput.value()).isEqualTo(0.25f);
		assertThat(invalidTerraInput.sourceCode()).isEqualTo(1);
		assertThat(invalidTerraInput.inputObservationCount()).isZero();
		assertThat(invalidTerraInput.sourceInputValid()).isFalse();
	}
}
