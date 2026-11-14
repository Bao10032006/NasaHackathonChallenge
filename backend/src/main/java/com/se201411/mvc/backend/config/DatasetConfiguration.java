package com.se201411.mvc.backend.config;

import com.se201411.mvc.backend.repository.file.FileActivityQueryRepository;
import com.se201411.mvc.backend.repository.file.FileAreaActivityRepository;
import com.se201411.mvc.backend.repository.file.FileAreaRepository;
import com.se201411.mvc.backend.repository.file.FileDailyActivityRepository;
import com.se201411.mvc.backend.repository.file.FileHarmonizationComparisonRepository;
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

	@Bean
	FileAreaRepository fileAreaRepository(
			DatasetProperties datasetProperties,
			FileDailyActivityRepository dailyActivityRepository) {
		return FileAreaRepository.open(datasetProperties.root(), dailyActivityRepository.getManifest());
	}

	@Bean
	FileActivityQueryRepository fileActivityQueryRepository(
			FileDailyActivityRepository dailyActivityRepository,
			FileAreaRepository areaRepository) {
		return new FileActivityQueryRepository(dailyActivityRepository, areaRepository);
	}

	@Bean
	FileAreaActivityRepository fileAreaActivityRepository(FileActivityQueryRepository activityQueryRepository) {
		return new FileAreaActivityRepository(activityQueryRepository);
	}

	@Bean
	FileHarmonizationComparisonRepository fileHarmonizationComparisonRepository(
			DatasetProperties datasetProperties,
			FileDailyActivityRepository dailyActivityRepository) {
		return FileHarmonizationComparisonRepository.open(
				datasetProperties.root(), dailyActivityRepository.getManifest());
	}
}
