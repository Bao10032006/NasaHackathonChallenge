package com.se201411.mvc.backend.config;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "HOALICH_DATASET_ROOT=external/hoalich-data")
class DatasetPropertiesOverrideTests {

	@Autowired
	private DatasetProperties datasetProperties;

	@Test
	void environmentVariableStylePropertyOverridesDefaultLocation() {
		assertThat(datasetProperties.root())
				.isEqualTo(Path.of("external", "hoalich-data"));
	}
}
