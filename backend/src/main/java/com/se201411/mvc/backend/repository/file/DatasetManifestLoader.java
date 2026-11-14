package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

final class DatasetManifestLoader {

	static final Path MANIFEST_RELATIVE_PATH = Path.of("derived", "dataset-manifest.json");

	private DatasetManifestLoader() {
	}

	static DatasetManifest load(Path datasetRoot, ObjectMapper objectMapper) {
		Objects.requireNonNull(datasetRoot, "datasetRoot must not be null");
		Objects.requireNonNull(objectMapper, "objectMapper must not be null");

		Path root = datasetRoot.toAbsolutePath().normalize();
		Path manifestPath = root.resolve(MANIFEST_RELATIVE_PATH).normalize();
		if (!manifestPath.startsWith(root) || !Files.isRegularFile(manifestPath)) {
			throw new DatasetUnavailableException(
					"Required dataset manifest is missing: " + MANIFEST_RELATIVE_PATH);
		}

		try {
			return objectMapper.readerFor(DatasetManifest.class)
					.without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
					.readValue(manifestPath);
		}
		catch (JacksonException exception) {
			throw new DatasetUnavailableException(
					"Dataset manifest is not valid JSON for schema version 1", exception);
		}
	}
}
