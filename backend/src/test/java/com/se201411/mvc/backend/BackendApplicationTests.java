package com.se201411.mvc.backend;

import java.nio.file.Path;

import javax.sql.DataSource;

import com.se201411.mvc.backend.config.DatasetProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class BackendApplicationTests {

	@Autowired
	private DatasetProperties datasetProperties;

	@Autowired
	private ApplicationContext applicationContext;

	@Test
	void contextLoads() {
	}

	@Test
	void bindsDefaultDatasetLocation() {
		assertThat(datasetProperties.root())
				.isEqualTo(Path.of("hoalich_data_v1", "hoalich_data_v1"));
	}

	@Test
	void doesNotRequireDatabaseConfiguration() {
		assertThat(applicationContext.getBeansOfType(DataSource.class)).isEmpty();
	}

}
