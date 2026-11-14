package com.se201411.mvc.backend;

import java.nio.file.Path;

import javax.sql.DataSource;

import com.se201411.mvc.backend.config.DatasetProperties;
import com.se201411.mvc.backend.repository.AreaActivityRepository;
import com.se201411.mvc.backend.repository.AreaRepository;
import com.se201411.mvc.backend.repository.DailyActivityRepository;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.repository.HarmonizationComparisonRepository;
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

	@Test
	void exposesValidatedDatasetRepositories() {
		assertThat(applicationContext.getBean(DailyActivityRepository.class)).isNotNull();
		assertThat(applicationContext.getBean(DatasetMetadataRepository.class)).isNotNull();
		assertThat(applicationContext.getBean(AreaRepository.class)).isNotNull();
		assertThat(applicationContext.getBean(AreaActivityRepository.class)).isNotNull();
		assertThat(applicationContext.getBean(HarmonizationComparisonRepository.class).isAvailable()).isTrue();
	}

}
