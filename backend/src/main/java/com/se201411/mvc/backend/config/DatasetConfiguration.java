package com.se201411.mvc.backend.config;

import com.se201411.mvc.backend.repository.file.FileDailyActivityRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

@Configuration(proxyBeanMethods = false)
public class DatasetConfiguration {

	@Bean
	FileDailyActivityRepository fileDailyActivityRepository(
			DatasetProperties datasetProperties,
			ObjectMapper objectMapper) {
		return FileDailyActivityRepository.open(datasetProperties.root(), objectMapper);
	}
}
