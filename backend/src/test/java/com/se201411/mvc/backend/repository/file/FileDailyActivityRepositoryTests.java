package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.DailyActivityDay;
import com.se201411.mvc.backend.domain.activity.DailyCellActivity;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileDailyActivityRepositoryTests {

	private static final List<String> ALL_CELLS = List.of("34_419", "34_420", "45_428", "45_429");

	@TempDir
	private Path temporaryDirectory;

	private final ObjectMapper objectMapper = JsonMapper.builder().findAndAddModules().build();
	private MiniDataset miniDataset;

	@BeforeEach
	void createMiniDataset() throws IOException {
		miniDataset = MiniDataset.create(temporaryDirectory, objectMapper);
	}

	@Test
	void loadsManifestAndReadsLittleEndianDailyValuesInManifestCellOrder() {
		FileDailyActivityRepository repository =
				FileDailyActivityRepository.open(miniDataset.root(), objectMapper);

		assertThat(repository.getManifest().schemaVersion()).isEqualTo("1.0.0");
		assertThat(repository.getManifest().kind()).isEqualTo("fixture");

		DailyActivityDay day = repository.findByDate(
				LocalDate.of(2026, 11, 11),
				List.of("45_429", "34_419", "45_428", "34_420"));

		assertThat(day.cells()).extracting(DailyCellActivity::cellId).containsExactlyElementsOf(ALL_CELLS);
		assertThat(day.cells()).extracting(DailyCellActivity::value)
				.containsExactly(0.0f, 0.75f, 1.5f, 255.25f);
		assertThat(day.cells()).extracting(DailyCellActivity::sourceCode).containsOnly(4);
		assertThat(day.cells()).extracting(DailyCellActivity::inputObservationCount)
				.containsExactly(0, 1, 2, 258);
		assertThat(day.cells()).allMatch(DailyCellActivity::sourceInputValid);
		assertThat(day.cells().stream().mapToDouble(DailyCellActivity::value).sum()).isEqualTo(257.5);
	}

	@Test
	void readsAnInclusiveDateRangeAndPreservesZeroAndInvalidSourceInput() {
		FileDailyActivityRepository repository =
				FileDailyActivityRepository.open(miniDataset.root(), objectMapper);

		List<DailyActivityDay> days = repository.findByDateRange(
				LocalDate.of(2026, 11, 12),
				LocalDate.of(2026, 11, 13),
				List.of("45_429", "34_419"));

		assertThat(days).extracting(DailyActivityDay::date)
				.containsExactly(LocalDate.of(2026, 11, 12), LocalDate.of(2026, 11, 13));
		assertThat(days.get(0).cells()).extracting(DailyCellActivity::cellId)
				.containsExactly("34_419", "45_429");
		assertThat(days.get(0).cells()).extracting(DailyCellActivity::value)
				.containsExactly(0.5f, 3.0f);

		DailyCellActivity terraCell = days.get(1).cells().get(0);
		assertThat(terraCell.value()).isEqualTo(0.25f);
		assertThat(terraCell.sourceCode()).isEqualTo(1);
		assertThat(terraCell.inputObservationCount()).isZero();
		assertThat(terraCell.sourceInputValid()).isFalse();
	}

	@Test
	void rejectsDatesAndCellsOutsideTheValidatedDataset() {
		FileDailyActivityRepository repository =
				FileDailyActivityRepository.open(miniDataset.root(), objectMapper);

		assertThatIllegalArgumentException()
				.isThrownBy(() -> repository.findByDate(LocalDate.of(2026, 11, 9), ALL_CELLS))
				.withMessageContaining("between 2026-11-10 and 2026-11-13");
		assertThatIllegalArgumentException()
				.isThrownBy(() -> repository.findByDate(LocalDate.of(2026, 11, 10), List.of("missing-cell")))
				.withMessageContaining("Unknown cellId");
		assertThatIllegalArgumentException()
				.isThrownBy(() -> repository.findByDate(LocalDate.of(2026, 11, 10), List.of()))
				.withMessageContaining("must not be empty");
	}

	@Test
	void failsFastWhenAnArtifactHashNoLongerMatchesTheManifest() throws IOException {
		Path sourceFile = miniDataset.root().resolve("derived/daily-source.u8");
		byte[] bytes = Files.readAllBytes(sourceFile);
		bytes[0] = 4;
		Files.write(sourceFile, bytes);

		assertThatThrownBy(() -> FileDailyActivityRepository.open(miniDataset.root(), objectMapper))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("SHA-256");
	}

	@Test
	void rejectsAnUnsupportedManifestMajorVersion() throws IOException {
		Path manifest = miniDataset.root().resolve("derived/dataset-manifest.json");
		String json = Files.readString(manifest).replace("\"schemaVersion\":\"1.0.0\"", "\"schemaVersion\":\"2.0.0\"");
		Files.writeString(manifest, json);

		assertThatThrownBy(() -> FileDailyActivityRepository.open(miniDataset.root(), objectMapper))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("Unsupported dataset schema major version");
	}

	@Test
	void ignoresUnknownMinorSchemaFields() throws IOException {
		Path manifest = miniDataset.root().resolve("derived/dataset-manifest.json");
		String json = Files.readString(manifest).replaceFirst("\\{", "{\"futureOptionalField\":true,");
		Files.writeString(manifest, json);

		FileDailyActivityRepository repository = FileDailyActivityRepository.open(miniDataset.root(), objectMapper);

		assertThat(repository.getManifest().dataVersion()).isEqualTo("fixture-daily-mini");
	}

	@Test
	void rejectsAnUnknownSourceOrigin() throws IOException {
		rewriteManifest("\"origin\":\"SCALED_OBSERVATION\"", "\"origin\":\"SCALED\"");

		assertThatThrownBy(() -> FileDailyActivityRepository.open(miniDataset.root(), objectMapper))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("sourceCodes.origin");
	}

	@Test
	void rejectsManifestCellDaysThatDisagreeWithTheSourceArtifact() throws IOException {
		rewriteManifest("\"cellDays\":6", "\"cellDays\":7");

		assertThatThrownBy(() -> FileDailyActivityRepository.open(miniDataset.root(), objectMapper))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("code 4");
	}

	@Test
	void rejectsManifestSourceDatesThatDisagreeWithTheSourceArtifact() throws IOException {
		rewriteManifest("\"lastDate\":\"2026-11-12\"", "\"lastDate\":\"2026-11-13\"");

		assertThatThrownBy(() -> FileDailyActivityRepository.open(miniDataset.root(), objectMapper))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("do not match daily-source.u8");
	}

	private void rewriteManifest(String target, String replacement) throws IOException {
		Path manifest = miniDataset.root().resolve("derived/dataset-manifest.json");
		String json = Files.readString(manifest);
		assertThat(json).contains(target);
		Files.writeString(manifest, json.replace(target, replacement));
	}

	@Test
	void rejectsArtifactPathsThatEscapeTheDerivedDirectory() throws IOException {
		Path manifest = miniDataset.root().resolve("derived/dataset-manifest.json");
		String json = Files.readString(manifest).replace(
				"\"name\":\"daily-values.f32\"",
				"\"name\":\"../daily-values.f32\"");
		Files.writeString(manifest, json);

		assertThatThrownBy(() -> FileDailyActivityRepository.open(miniDataset.root(), objectMapper))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("must not contain a path");
	}

	private record MiniDataset(Path root) {

		private static MiniDataset create(Path root, ObjectMapper objectMapper) throws IOException {
			Path tables = Files.createDirectories(root.resolve("tables"));
			Path derived = Files.createDirectories(root.resolve("derived"));

			String cellsCsv = """
					cell,cy,cx,lat,lon,lat_s,lon_w,region
					34_419,34,419,8.625,104.875,8.5,104.75,DBSCL
					34_420,34,420,8.625,105.125,8.5,105.0,DBSCL
					45_428,45,428,11.375,107.125,11.25,107.0,TayNguyen
					45_429,45,429,11.375,107.375,11.25,107.25,TayNguyen
					""";
			Path cellsPath = tables.resolve("cells_025.csv");
			Files.writeString(cellsPath, cellsCsv);

			float[] values = {
					0.0f, 1.0f, 2.0f, 154.0f,
					0.0f, 0.75f, 1.5f, 255.25f,
					0.5f, 1.5f, 0.0f, 3.0f,
					0.25f, 3.75f, 0.0f, 5.0f
			};
			byte[] sources = {
					3, 3, 3, 3,
					4, 4, 4, 4,
					2, 2, 4, 4,
					1, 1, 2, 3
			};
			short[] inputCounts = {
					0, 1, 2, 154,
					0, 1, 2, 258,
					0, 1, 0, 3,
					0, 0, 0, 5
			};
			byte[] validity = {
					1, 1, 1, 1,
					1, 1, 1, 1,
					1, 1, 1, 1,
					0, 0, 1, 1
			};

			Path valuesPath = derived.resolve("daily-values.f32");
			Path sourcesPath = derived.resolve("daily-source.u8");
			Path countsPath = derived.resolve("daily-input-count.i16");
			Path validityPath = derived.resolve("daily-source-input-valid.u8");
			Files.write(valuesPath, floats(values));
			Files.write(sourcesPath, sources);
			Files.write(countsPath, shorts(inputCounts));
			Files.write(validityPath, validity);

			List<Map<String, Object>> files = List.of(
					artifact("daily-values.f32", "float32", 4, valuesPath),
					artifact("daily-source.u8", "uint8", 1, sourcesPath),
					artifact("daily-input-count.i16", "int16", 2, countsPath),
					artifact("daily-source-input-valid.u8", "uint8", 1, validityPath));

			Map<String, Object> manifest = linkedMap(
					"schemaVersion", "1.0.0",
					"dataVersion", "fixture-daily-mini",
					"modelVersion", "fixture-model",
					"pipelineVersion", "fixture",
					"kind", "fixture",
					"metric", "snpp_eq",
					"unit", "S-NPP-equivalent daytime detections",
					"timeZone", "UTC",
					"dateRange", linkedMap("start", "2026-11-10", "end", "2026-11-13", "dayCount", 4),
					"dataThrough", "2026-11-13",
					"grid", linkedMap(
							"degrees", 0.25,
							"cellCount", 4,
							"cellOrderSource", "tables/cells_025.csv",
							"cellIds", ALL_CELLS),
					"layout", linkedMap(
							"order", "row-major[date][cell]",
							"byteOrder", "little-endian",
							"header", "none"),
					"files", files,
					"sourceCodes", sourceCodeDefinitions(),
					"periods", linkedMap("partial", List.of(), "transitions", List.of()),
					"sources", List.of(linkedMap(
							"path", "tables/cells_025.csv",
							"byteSize", Files.size(cellsPath),
							"sha256", sha256(cellsPath))),
					"capabilities", linkedMap("optionalArtifacts", List.of()),
					"warningCatalog", List.of(linkedMap(
							"code", "DATASET_EDGE_DATE",
							"trigger", "DATE_IS_DATA_THROUGH",
							"params", Map.of(),
							"appliesTo", List.of("/daily"),
							"description", "Fixture warning")),
					"limitations", List.of(linkedMap(
							"code", "SNPP_EQ_NOT_FIRE_EVENT_COUNT",
							"description", "Fixture limitation")),
					"validation", linkedMap("status", "PASS", "checks", List.of(), "regressionSamples", List.of()),
					"generator", linkedMap(
							"script", "test",
							"python", "test",
							"numpy", "test",
							"pandas", "test",
							"generatedAt", "2026-11-14T00:00:00Z"));
			objectMapper.writeValue(derived.resolve("dataset-manifest.json"), manifest);
			return new MiniDataset(root);
		}

		private static Map<String, Object> artifact(
				String name,
				String dtype,
				int bytesPerValue,
				Path path) throws IOException {
			return linkedMap(
					"name", name,
					"dtype", dtype,
					"bytesPerValue", bytesPerValue,
					"shape", List.of(4, 4),
					"byteSize", Files.size(path),
					"sha256", sha256(path),
					"description", "Test artifact");
		}

		private static List<Map<String, Object>> sourceCodeDefinitions() {
			List<Map<String, Object>> definitions = new ArrayList<>();
			// Provenance must match the source bytes above; the repository cross-checks it at startup.
			definitions.add(sourceCode(1, "TERRA", "MODEL_REDISTRIBUTED", "Terra", "2026-11-13", "2026-11-13", 2));
			definitions.add(sourceCode(2, "AQUA", "MODEL_REDISTRIBUTED", "Aqua", "2026-11-12", "2026-11-13", 3));
			definitions.add(sourceCode(3, "SNPP", "DIRECT_OBSERVATION", "SNPP", "2026-11-10", "2026-11-13", 5));
			definitions.add(sourceCode(4, "NOAA20", "SCALED_OBSERVATION", "N20", "2026-11-11", "2026-11-12", 6));
			return definitions;
		}

		private static Map<String, Object> sourceCode(
				int code,
				String source,
				String origin,
				String satellite,
				String firstDate,
				String lastDate,
				int cellDays) {
			return linkedMap(
					"code", code,
					"source", source,
					"origin", origin,
					"inputSatellite", satellite,
					"firstDate", firstDate,
					"lastDate", lastDate,
					"cellDays", cellDays);
		}

		private static byte[] floats(float[] values) {
			ByteBuffer buffer = ByteBuffer.allocate(values.length * Float.BYTES).order(ByteOrder.LITTLE_ENDIAN);
			for (float value : values) {
				buffer.putFloat(value);
			}
			return buffer.array();
		}

		private static byte[] shorts(short[] values) {
			ByteBuffer buffer = ByteBuffer.allocate(values.length * Short.BYTES).order(ByteOrder.LITTLE_ENDIAN);
			for (short value : values) {
				buffer.putShort(value);
			}
			return buffer.array();
		}

		private static String sha256(Path path) throws IOException {
			try {
				return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path)));
			}
			catch (NoSuchAlgorithmException exception) {
				throw new IllegalStateException(exception);
			}
		}

		private static Map<String, Object> linkedMap(Object... values) {
			Map<String, Object> result = new LinkedHashMap<>();
			for (int index = 0; index < values.length; index += 2) {
				result.put((String) values[index], values[index + 1]);
			}
			return result;
		}
	}
}
