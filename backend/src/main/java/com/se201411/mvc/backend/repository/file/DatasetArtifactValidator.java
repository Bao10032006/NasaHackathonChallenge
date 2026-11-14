package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

final class DatasetArtifactValidator {

	private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");
	private static final Map<String, ExpectedArtifact> REQUIRED_DAILY_ARTIFACTS = Map.of(
			"daily-values.f32", new ExpectedArtifact("float32", 4),
			"daily-source.u8", new ExpectedArtifact("uint8", 1),
			"daily-input-count.i16", new ExpectedArtifact("int16", 2),
			"daily-source-input-valid.u8", new ExpectedArtifact("uint8", 1));

	/**
	 * Source catalog fixed by Artifact Spec 1.0.0 section 5.2. The manifest is not hash-protected and
	 * services read source/origin labels from it, so each code must carry exactly these labels.
	 */
	private static final Map<Integer, ExpectedSource> SPEC_SOURCES = Map.of(
			1, new ExpectedSource("TERRA", "MODEL_REDISTRIBUTED"),
			2, new ExpectedSource("AQUA", "MODEL_REDISTRIBUTED"),
			3, new ExpectedSource("SNPP", "DIRECT_OBSERVATION"),
			4, new ExpectedSource("NOAA20", "SCALED_OBSERVATION"));
	private static final int SCALED_SOURCE_CODE = 4;
	private static final String METRIC = "snpp_eq";
	private static final String TIME_ZONE = "UTC";
	/** Largest file that can be held in one Java byte array. */
	private static final long MAX_LOADABLE_BYTES = Integer.MAX_VALUE - 8L;

	private DatasetArtifactValidator() {
	}

	static ValidatedDataset validate(Path datasetRoot, DatasetManifest manifest) {
		Path root = datasetRoot.toAbsolutePath().normalize();
		if (!Files.isDirectory(root)) {
			throw unavailable("Dataset root is not a directory");
		}
		if (manifest == null) {
			throw unavailable("Dataset manifest is empty");
		}

		validateSchemaVersion(manifest.schemaVersion());
		requireText(manifest.dataVersion(), "dataVersion");
		requireText(manifest.modelVersion(), "modelVersion");
		requireText(manifest.pipelineVersion(), "pipelineVersion");
		if (!Set.of("snapshot", "fixture").contains(manifest.kind())) {
			throw unavailable("Manifest kind must be snapshot or fixture");
		}
		if (!METRIC.equals(requireText(manifest.metric(), "metric"))) {
			throw unavailable("Manifest metric must be " + METRIC);
		}
		requireText(manifest.unit(), "unit");
		if (!TIME_ZONE.equals(requireText(manifest.timeZone(), "timeZone"))) {
			throw unavailable("Manifest timeZone must be " + TIME_ZONE);
		}

		DateBounds dateBounds = validateDates(manifest);
		GridIndex gridIndex = validateGrid(root, manifest);
		validateLayout(manifest.layout());
		Map<String, byte[]> artifactBytes = validateArtifactFiles(
				root, manifest, dateBounds.dayCount(), gridIndex.cellIds().size());
		validateSourceCodes(manifest.sourceCodes());
		validateMetadataCatalogs(manifest);
		validateOptionalArtifacts(root, manifest.capabilities());

		if (manifest.validation() == null || !"PASS".equals(manifest.validation().status())) {
			throw unavailable("Manifest validation status must be PASS");
		}

		return new ValidatedDataset(
				manifest,
				dateBounds.start(),
				dateBounds.end(),
				Map.copyOf(artifactBytes),
				gridIndex.cellIds(),
				gridIndex.cellIndexes());
	}

	private static void validateSchemaVersion(String schemaVersion) {
		requireText(schemaVersion, "schemaVersion");
		String[] tokens = schemaVersion.split("\\.", 2);
		try {
			if (Integer.parseInt(tokens[0]) != 1) {
				throw unavailable("Unsupported dataset schema major version: " + tokens[0]);
			}
		}
		catch (NumberFormatException exception) {
			throw unavailable("Invalid dataset schemaVersion");
		}
	}

	private static DateBounds validateDates(DatasetManifest manifest) {
		if (manifest.dateRange() == null) {
			throw unavailable("Manifest dateRange is required");
		}
		try {
			LocalDate start = LocalDate.parse(requireText(manifest.dateRange().start(), "dateRange.start"));
			LocalDate end = LocalDate.parse(requireText(manifest.dateRange().end(), "dateRange.end"));
			LocalDate dataThrough = LocalDate.parse(requireText(manifest.dataThrough(), "dataThrough"));
			if (end.isBefore(start)) {
				throw unavailable("Manifest dateRange end is before start");
			}
			long calculatedDayCount = ChronoUnit.DAYS.between(start, end) + 1;
			if (calculatedDayCount != manifest.dateRange().dayCount()) {
				throw unavailable("Manifest dayCount does not match dateRange");
			}
			if (!dataThrough.equals(end)) {
				throw unavailable("Manifest dataThrough must equal dateRange.end");
			}
			return new DateBounds(start, end, Math.toIntExact(calculatedDayCount));
		}
		catch (DateTimeParseException | ArithmeticException exception) {
			throw new DatasetUnavailableException("Manifest contains an invalid date range", exception);
		}
	}

	private static GridIndex validateGrid(Path root, DatasetManifest manifest) {
		DatasetManifest.Grid grid = manifest.grid();
		if (grid == null || grid.cellCount() <= 0) {
			throw unavailable("Manifest grid and positive cellCount are required");
		}
		if (grid.cellIds().size() != grid.cellCount()) {
			throw unavailable("Manifest grid.cellIds size does not match cellCount");
		}
		Set<String> uniqueIds = new HashSet<>(grid.cellIds());
		if (uniqueIds.size() != grid.cellIds().size()
				|| uniqueIds.stream().anyMatch(id -> id == null || id.isBlank())) {
			throw unavailable("Manifest grid.cellIds must be unique and non-blank");
		}

		String cellOrderSource = requireText(grid.cellOrderSource(), "grid.cellOrderSource");
		Path cellsPath = safeResolve(root, cellOrderSource);
		DatasetManifest.SourceArtifact declared = manifest.sources().stream()
				.filter(source -> cellOrderSource.equals(source.path()))
				.findFirst()
				.orElseThrow(() -> unavailable("Cell order source is not declared in manifest sources"));
		byte[] cellsCsv = readVerified(cellsPath, declared.byteSize(), declared.sha256(), "cell order source");
		List<String> csvCellIds = readCellIds(cellsCsv);
		if (!csvCellIds.equals(grid.cellIds())) {
			throw unavailable("Manifest grid.cellIds does not match cell order source");
		}

		Map<String, Integer> cellIndexes = new LinkedHashMap<>();
		for (int index = 0; index < grid.cellIds().size(); index++) {
			cellIndexes.put(grid.cellIds().get(index), index);
		}
		return new GridIndex(List.copyOf(grid.cellIds()), Map.copyOf(cellIndexes));
	}

	private static List<String> readCellIds(byte[] cellsCsv) {
		try (BufferedReader reader = new BufferedReader(new StringReader(
				new String(cellsCsv, StandardCharsets.UTF_8)))) {
			String headerLine = reader.readLine();
			if (headerLine == null) {
				throw unavailable("Cell order source is empty");
			}
			String[] headers = headerLine.replace("\uFEFF", "").split(",", -1);
			int cellColumn = -1;
			for (int index = 0; index < headers.length; index++) {
				if ("cell".equals(headers[index])) {
					cellColumn = index;
					break;
				}
			}
			if (cellColumn < 0) {
				throw unavailable("Cell order source is missing required cell column");
			}

			List<String> cellIds = new ArrayList<>();
			String line;
			while ((line = reader.readLine()) != null) {
				if (line.isBlank()) {
					continue;
				}
				String[] columns = line.split(",", -1);
				if (cellColumn >= columns.length || columns[cellColumn].isBlank()) {
					throw unavailable("Cell order source contains an invalid row");
				}
				cellIds.add(columns[cellColumn]);
			}
			return List.copyOf(cellIds);
		}
		catch (IOException exception) {
			throw new DatasetUnavailableException("Cannot read cell order source", exception);
		}
	}

	/**
	 * Reads a source file declared in {@code manifest.sources} once and verifies the size and SHA-256
	 * of exactly the bytes returned, so callers never parse bytes other than the ones that were hashed.
	 * Returns empty when the manifest does not declare the file (for example in the fixture), so callers
	 * can treat the artifact as unavailable instead of reading an unverified file.
	 */
	static Optional<byte[]> readDeclaredSource(Path datasetRoot, DatasetManifest manifest, String relativePath) {
		Path root = datasetRoot.toAbsolutePath().normalize();
		Optional<DatasetManifest.SourceArtifact> declared = manifest.sources().stream()
				.filter(source -> relativePath.equals(source.path()))
				.findFirst();
		if (declared.isEmpty()) {
			return Optional.empty();
		}
		Path path = safeResolve(root, relativePath);
		return Optional.of(readVerified(path, declared.get().byteSize(), declared.get().sha256(), relativePath));
	}

	private static void validateLayout(DatasetManifest.Layout layout) {
		if (layout == null
				|| !"row-major[date][cell]".equals(layout.order())
				|| !"little-endian".equals(layout.byteOrder())
				|| !"none".equals(layout.header())) {
			throw unavailable("Unsupported dataset binary layout");
		}
	}

	private static Map<String, byte[]> validateArtifactFiles(
			Path root,
			DatasetManifest manifest,
			int dayCount,
			int cellCount) {
		if (manifest.files().isEmpty()) {
			throw unavailable("Manifest files must not be empty");
		}
		Path derivedRoot = safeResolve(root, "derived");
		Map<String, byte[]> paths = new HashMap<>();
		for (DatasetManifest.ArtifactFile file : manifest.files()) {
			String name = requireText(file.name(), "files.name");
			Path relativeName = parsePath(name);
			if (relativeName.isAbsolute() || relativeName.getNameCount() != 1) {
				throw unavailable("Artifact file name must not contain a path: " + name);
			}
			if (paths.containsKey(name)) {
				throw unavailable("Duplicate artifact file in manifest: " + name);
			}
			if (file.bytesPerValue() <= 0
					|| file.shape().size() != 2
					|| file.shape().stream().anyMatch(dimension -> dimension == null || dimension <= 0)) {
				throw unavailable("Artifact shape or bytesPerValue is invalid: " + name);
			}

			long declaredShapeSize;
			try {
				declaredShapeSize = Math.multiplyExact(
						Math.multiplyExact((long) file.shape().get(0), file.shape().get(1)),
						file.bytesPerValue());
			}
			catch (ArithmeticException exception) {
				throw new DatasetUnavailableException("Artifact size overflows: " + name, exception);
			}
			if (file.byteSize() != declaredShapeSize) {
				throw unavailable("Artifact byteSize does not match shape: " + name);
			}

			ExpectedArtifact expected = REQUIRED_DAILY_ARTIFACTS.get(name);
			if (expected != null) {
				if (!expected.dtype().equals(file.dtype()) || expected.bytesPerValue() != file.bytesPerValue()) {
					throw unavailable("Artifact dtype does not match schema: " + name);
				}
				if (file.shape().get(0) != dayCount || file.shape().get(1) != cellCount) {
					throw unavailable("Artifact shape does not match manifest date/grid dimensions: " + name);
				}
			}

			Path artifactPath = safeResolve(derivedRoot, name);
			paths.put(name, readVerified(artifactPath, file.byteSize(), file.sha256(), name));
		}

		for (String requiredName : REQUIRED_DAILY_ARTIFACTS.keySet()) {
			if (!paths.containsKey(requiredName)) {
				throw unavailable("Required daily artifact is missing from manifest: " + requiredName);
			}
		}
		return paths;
	}

	private static void validateSourceCodes(List<DatasetManifest.SourceCodeDefinition> sourceCodes) {
		Set<Integer> codes = new HashSet<>();
		for (DatasetManifest.SourceCodeDefinition definition : sourceCodes) {
			if (definition.code() < 1 || definition.code() > 4 || !codes.add(definition.code())) {
				throw unavailable("Manifest sourceCodes must contain unique codes 1 through 4");
			}
			String source = requireText(definition.source(), "sourceCodes.source");
			String origin = requireText(definition.origin(), "sourceCodes.origin");
			requireText(definition.inputSatellite(), "sourceCodes.inputSatellite");
			ExpectedSource expected = SPEC_SOURCES.get(definition.code());
			if (!expected.source().equals(source) || !expected.origin().equals(origin)) {
				throw unavailable("Manifest sourceCodes code " + definition.code() + " must be "
						+ expected.source() + "/" + expected.origin() + " (sourceCodes.source/sourceCodes.origin)");
			}
			if (definition.code() == SCALED_SOURCE_CODE) {
				requirePositive(definition.scaleDivisor(), "sourceCodes.scaleDivisor");
				if (definition.scaleDivisorReported() != null) {
					requirePositive(definition.scaleDivisorReported(), "sourceCodes.scaleDivisorReported");
				}
			}
			validateSourceCodeDates(definition);
		}
		if (!codes.equals(Set.of(1, 2, 3, 4))) {
			throw unavailable("Manifest sourceCodes must define codes 1 through 4");
		}
	}

	private static void requirePositive(Double value, String field) {
		if (value == null || !Double.isFinite(value) || value <= 0) {
			throw unavailable("Manifest field must be a positive number: " + field);
		}
	}

	private static void validateSourceCodeDates(DatasetManifest.SourceCodeDefinition definition) {
		if (definition.cellDays() < 0) {
			throw unavailable("Manifest sourceCodes.cellDays must not be negative");
		}
		if (definition.cellDays() == 0) {
			if (definition.firstDate() != null || definition.lastDate() != null) {
				throw unavailable("Manifest sourceCodes without cell-days must not declare firstDate or lastDate");
			}
			return;
		}
		try {
			LocalDate first = LocalDate.parse(requireText(definition.firstDate(), "sourceCodes.firstDate"));
			LocalDate last = LocalDate.parse(requireText(definition.lastDate(), "sourceCodes.lastDate"));
			if (last.isBefore(first)) {
				throw unavailable("Manifest sourceCodes.lastDate must not be before firstDate");
			}
		}
		catch (DateTimeParseException exception) {
			throw unavailable("Manifest sourceCodes dates must be ISO local dates");
		}
	}

	private static void validateMetadataCatalogs(DatasetManifest manifest) {
		if (manifest.periods() == null || manifest.capabilities() == null) {
			throw unavailable("Manifest periods and capabilities are required");
		}
		validateUniqueCodes(
				manifest.warningCatalog().stream().map(DatasetManifest.WarningDefinition::code).toList(),
				"warningCatalog");
		validateUniqueCodes(
				manifest.limitations().stream().map(DatasetManifest.Limitation::code).toList(),
				"limitations");
	}

	private static void validateUniqueCodes(List<String> codes, String field) {
		if (codes.isEmpty() || codes.stream().anyMatch(code -> code == null || code.isBlank())) {
			throw unavailable("Manifest " + field + " must contain non-blank codes");
		}
		if (new HashSet<>(codes).size() != codes.size()) {
			throw unavailable("Manifest " + field + " contains duplicate codes");
		}
	}

	private static void validateOptionalArtifacts(Path root, DatasetManifest.Capabilities capabilities) {
		if (capabilities == null) {
			throw unavailable("Manifest capabilities are required");
		}
		Set<String> names = new HashSet<>();
		for (DatasetManifest.OptionalArtifact artifact : capabilities.optionalArtifacts()) {
			String name = requireText(artifact.name(), "optionalArtifacts.name");
			if (!names.add(name)) {
				throw unavailable("Duplicate optional artifact: " + name);
			}
			Path path = safeResolve(root, requireText(artifact.path(), "optionalArtifacts.path"));
			validateFileIdentity(path, artifact.byteSize(), artifact.sha256(), name);
		}
	}

	private static void validateFileIdentity(Path path, long expectedSize, String expectedHash, String label) {
		if (!Files.isRegularFile(path)) {
			throw unavailable("Required dataset file is missing: " + label);
		}
		if (expectedSize < 0) {
			throw unavailable("Manifest byteSize is negative: " + label);
		}
		if (expectedHash == null || !SHA_256.matcher(expectedHash).matches()) {
			throw unavailable("Manifest SHA-256 is invalid: " + label);
		}
		try {
			if (Files.size(path) != expectedSize) {
				throw unavailable("Dataset file size does not match manifest: " + label);
			}
			if (!sha256(path).equals(expectedHash)) {
				throw unavailable("Dataset file SHA-256 does not match manifest: " + label);
			}
		}
		catch (IOException exception) {
			throw new DatasetUnavailableException("Cannot validate dataset file: " + label, exception);
		}
	}

	/**
	 * Reads a dataset file exactly once and checks size and SHA-256 on the returned bytes, so the bytes
	 * that are served are always the bytes that were hashed (no check-then-reread window).
	 */
	static byte[] readVerified(Path path, long expectedSize, String expectedHash, String label) {
		if (!Files.isRegularFile(path)) {
			throw unavailable("Required dataset file is missing: " + label);
		}
		if (expectedSize < 0 || expectedSize > MAX_LOADABLE_BYTES) {
			throw unavailable("Manifest byteSize is out of range: " + label);
		}
		if (expectedHash == null || !SHA_256.matcher(expectedHash).matches()) {
			throw unavailable("Manifest SHA-256 is invalid: " + label);
		}
		byte[] bytes;
		try {
			bytes = Files.readAllBytes(path);
		}
		catch (IOException exception) {
			throw new DatasetUnavailableException("Cannot read dataset file: " + label, exception);
		}
		if (bytes.length != expectedSize) {
			throw unavailable("Dataset file size does not match manifest: " + label);
		}
		if (!sha256(bytes).equals(expectedHash)) {
			throw unavailable("Dataset file SHA-256 does not match manifest: " + label);
		}
		return bytes;
	}

	private static String sha256(byte[] bytes) {
		return HexFormat.of().formatHex(sha256Digest().digest(bytes));
	}

	private static MessageDigest sha256Digest() {
		try {
			return MessageDigest.getInstance("SHA-256");
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is not available", exception);
		}
	}

	private static String sha256(Path path) throws IOException {
		MessageDigest digest = sha256Digest();
		try (InputStream input = new BufferedInputStream(Files.newInputStream(path))) {
			byte[] buffer = new byte[8192];
			int read;
			while ((read = input.read(buffer)) >= 0) {
				if (read > 0) {
					digest.update(buffer, 0, read);
				}
			}
		}
		return HexFormat.of().formatHex(digest.digest());
	}

	private static Path safeResolve(Path root, String relativePath) {
		Path candidatePath = parsePath(relativePath);
		if (candidatePath.isAbsolute()) {
			throw unavailable("Dataset manifest contains an absolute path");
		}
		Path candidate = root.resolve(candidatePath).normalize();
		if (!candidate.startsWith(root)) {
			throw unavailable("Dataset manifest path escapes the dataset root");
		}
		if (Files.exists(candidate)) {
			try {
				// The lexical check above does not see symbolic links; compare the resolved locations too.
				if (!candidate.toRealPath().startsWith(root.toRealPath())) {
					throw unavailable("Dataset manifest path escapes the dataset root through a link");
				}
			}
			catch (IOException exception) {
				throw new DatasetUnavailableException("Cannot resolve dataset path: " + relativePath, exception);
			}
		}
		return candidate;
	}

	private static Path parsePath(String value) {
		try {
			return Path.of(value);
		}
		catch (InvalidPathException exception) {
			throw new DatasetUnavailableException("Dataset manifest contains an invalid path", exception);
		}
	}

	private static String requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw unavailable("Manifest field is required: " + field);
		}
		return value;
	}

	private static DatasetUnavailableException unavailable(String message) {
		return new DatasetUnavailableException(message);
	}

	record ValidatedDataset(
			DatasetManifest manifest,
			LocalDate startDate,
			LocalDate endDate,
			Map<String, byte[]> artifactBytes,
			List<String> cellIds,
			Map<String, Integer> cellIndexes) {
	}

	private record ExpectedArtifact(String dtype, int bytesPerValue) {
	}

	private record ExpectedSource(String source, String origin) {
	}

	private record DateBounds(LocalDate start, LocalDate end, int dayCount) {
	}

	private record GridIndex(List<String> cellIds, Map<String, Integer> cellIndexes) {
	}
}
