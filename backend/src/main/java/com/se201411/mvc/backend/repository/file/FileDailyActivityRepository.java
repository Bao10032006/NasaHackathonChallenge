package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.DailyActivityDay;
import com.se201411.mvc.backend.domain.activity.DailyCellActivity;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;
import com.se201411.mvc.backend.repository.DailyActivityRepository;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class FileDailyActivityRepository
		implements DailyActivityRepository, DatasetMetadataRepository {

	private static final String VALUES_FILE = "daily-values.f32";
	private static final String SOURCE_FILE = "daily-source.u8";
	private static final String INPUT_COUNT_FILE = "daily-input-count.i16";
	private static final String SOURCE_VALID_FILE = "daily-source-input-valid.u8";

	private final DatasetManifest manifest;
	private final LocalDate startDate;
	private final LocalDate endDate;
	private final List<String> cellIds;
	private final Map<String, Integer> cellIndexes;
	private final int cellCount;
	private final byte[] values;
	private final byte[] sources;
	private final byte[] inputCounts;
	private final byte[] sourceValidity;

	private FileDailyActivityRepository(
			DatasetArtifactValidator.ValidatedDataset dataset,
			byte[] values,
			byte[] sources,
			byte[] inputCounts,
			byte[] sourceValidity) {
		this.manifest = dataset.manifest();
		this.startDate = dataset.startDate();
		this.endDate = dataset.endDate();
		this.cellIds = dataset.cellIds();
		this.cellIndexes = dataset.cellIndexes();
		this.cellCount = cellIds.size();
		this.values = values;
		this.sources = sources;
		this.inputCounts = inputCounts;
		this.sourceValidity = sourceValidity;
		validateBinaryContent();
	}

	public static FileDailyActivityRepository open(Path datasetRoot, ObjectMapper objectMapper) {
		Objects.requireNonNull(datasetRoot, "datasetRoot must not be null");
		DatasetManifest manifest = DatasetManifestLoader.load(datasetRoot, objectMapper);
		DatasetArtifactValidator.ValidatedDataset dataset =
				DatasetArtifactValidator.validate(datasetRoot, manifest);
		try {
			return new FileDailyActivityRepository(
					dataset,
					Files.readAllBytes(dataset.artifactPaths().get(VALUES_FILE)),
					Files.readAllBytes(dataset.artifactPaths().get(SOURCE_FILE)),
					Files.readAllBytes(dataset.artifactPaths().get(INPUT_COUNT_FILE)),
					Files.readAllBytes(dataset.artifactPaths().get(SOURCE_VALID_FILE)));
		}
		catch (IOException exception) {
			throw new DatasetUnavailableException("Cannot load validated daily dataset artifacts", exception);
		}
	}

	@Override
	public DatasetManifest getManifest() {
		return manifest;
	}

	@Override
	public DailyActivityDay findByDate(LocalDate date, Collection<String> requestedCellIds) {
		validateDate(date);
		int[] selectedCellIndexes = resolveCellIndexes(requestedCellIds);
		return readDay(date, selectedCellIndexes);
	}

	@Override
	public List<DailyActivityDay> findByDateRange(
			LocalDate startInclusive,
			LocalDate endInclusive,
			Collection<String> requestedCellIds) {
		validateDate(startInclusive);
		validateDate(endInclusive);
		if (endInclusive.isBefore(startInclusive)) {
			throw new IllegalArgumentException("endInclusive must not be before startInclusive");
		}
		int[] selectedCellIndexes = resolveCellIndexes(requestedCellIds);
		int dayCount = Math.toIntExact(ChronoUnit.DAYS.between(startInclusive, endInclusive) + 1);
		List<DailyActivityDay> result = new ArrayList<>(dayCount);
		for (LocalDate date = startInclusive; !date.isAfter(endInclusive); date = date.plusDays(1)) {
			result.add(readDay(date, selectedCellIndexes));
		}
		return List.copyOf(result);
	}

	private DailyActivityDay readDay(LocalDate date, int[] selectedCellIndexes) {
		int dateIndex = Math.toIntExact(ChronoUnit.DAYS.between(startDate, date));
		List<DailyCellActivity> result = new ArrayList<>(selectedCellIndexes.length);
		for (int cellIndex : selectedCellIndexes) {
			int elementIndex = Math.addExact(Math.multiplyExact(dateIndex, cellCount), cellIndex);
			result.add(new DailyCellActivity(
					cellIds.get(cellIndex),
					readFloat32LittleEndian(values, Math.multiplyExact(elementIndex, Float.BYTES)),
					Byte.toUnsignedInt(sources[elementIndex]),
					readInt16LittleEndian(inputCounts, Math.multiplyExact(elementIndex, Short.BYTES)),
					sourceValidity[elementIndex] == 1));
		}
		return new DailyActivityDay(date, result);
	}

	private int[] resolveCellIndexes(Collection<String> requestedCellIds) {
		if (requestedCellIds == null || requestedCellIds.isEmpty()) {
			throw new IllegalArgumentException("cellIds must not be empty");
		}
		Set<String> requested = new HashSet<>();
		for (String cellId : requestedCellIds) {
			if (cellId == null || cellId.isBlank()) {
				throw new IllegalArgumentException("cellIds must not contain blank values");
			}
			if (!requested.add(cellId)) {
				throw new IllegalArgumentException("cellIds must not contain duplicates: " + cellId);
			}
			if (!cellIndexes.containsKey(cellId)) {
				throw new IllegalArgumentException("Unknown cellId: " + cellId);
			}
		}
		return cellIds.stream()
				.filter(requested::contains)
				.mapToInt(cellIndexes::get)
				.toArray();
	}

	private void validateDate(LocalDate date) {
		if (date == null) {
			throw new IllegalArgumentException("date must not be null");
		}
		if (date.isBefore(startDate) || date.isAfter(endDate)) {
			throw new IllegalArgumentException(
					"date must be between " + startDate + " and " + endDate);
		}
	}

	private void validateBinaryContent() {
		int valueCount = sources.length;
		for (int index = 0; index < valueCount; index++) {
			float value = readFloat32LittleEndian(values, index * Float.BYTES);
			if (!Float.isFinite(value) || value < 0) {
				throw new DatasetUnavailableException("daily-values.f32 contains an invalid value");
			}
			int sourceCode = Byte.toUnsignedInt(sources[index]);
			if (sourceCode < 1 || sourceCode > 4) {
				throw new DatasetUnavailableException("daily-source.u8 contains a code outside 1..4");
			}
			if (readInt16LittleEndian(inputCounts, index * Short.BYTES) < 0) {
				throw new DatasetUnavailableException("daily-input-count.i16 contains a negative value");
			}
			int valid = Byte.toUnsignedInt(sourceValidity[index]);
			if (valid != 0 && valid != 1) {
				throw new DatasetUnavailableException(
						"daily-source-input-valid.u8 contains a value outside 0..1");
			}
		}
	}

	private static float readFloat32LittleEndian(byte[] data, int offset) {
		int bits = Byte.toUnsignedInt(data[offset])
				| Byte.toUnsignedInt(data[offset + 1]) << 8
				| Byte.toUnsignedInt(data[offset + 2]) << 16
				| Byte.toUnsignedInt(data[offset + 3]) << 24;
		return Float.intBitsToFloat(bits);
	}

	private static int readInt16LittleEndian(byte[] data, int offset) {
		return (short) (Byte.toUnsignedInt(data[offset]) | Byte.toUnsignedInt(data[offset + 1]) << 8);
	}
}
