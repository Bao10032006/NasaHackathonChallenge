package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.DailyActivityDay;
import com.se201411.mvc.backend.domain.activity.DailyCellActivity;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;
import com.se201411.mvc.backend.repository.DailyActivityRepository;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import tools.jackson.databind.ObjectMapper;

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
		// The validator read each artifact once and hashed exactly these bytes; never re-read the files.
		return new FileDailyActivityRepository(
				dataset,
				dataset.artifactBytes().get(VALUES_FILE),
				dataset.artifactBytes().get(SOURCE_FILE),
				dataset.artifactBytes().get(INPUT_COUNT_FILE),
				dataset.artifactBytes().get(SOURCE_VALID_FILE));
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

	// Package-private primitive accessors for area-level aggregation (FileAreaActivityRepository).
	// They avoid creating one object per cell-day when summing long date ranges.

	int dayCount() {
		return Math.toIntExact(ChronoUnit.DAYS.between(startDate, endDate) + 1);
	}

	int cellCount() {
		return cellCount;
	}

	LocalDate firstDate() {
		return startDate;
	}

	int dateIndexOf(LocalDate date) {
		validateDate(date);
		return Math.toIntExact(ChronoUnit.DAYS.between(startDate, date));
	}

	int cellIndexOf(String cellId) {
		Integer index = cellId == null ? null : cellIndexes.get(cellId);
		if (index == null) {
			throw new IllegalArgumentException("Unknown cellId: " + cellId);
		}
		return index;
	}

	float valueAt(int dateIndex, int cellIndex) {
		return readFloat32LittleEndian(values, Math.multiplyExact(elementIndex(dateIndex, cellIndex), Float.BYTES));
	}

	int sourceCodeAt(int dateIndex, int cellIndex) {
		return Byte.toUnsignedInt(sources[elementIndex(dateIndex, cellIndex)]);
	}

	int inputObservationCountAt(int dateIndex, int cellIndex) {
		return readInt16LittleEndian(inputCounts, Math.multiplyExact(elementIndex(dateIndex, cellIndex), Short.BYTES));
	}

	boolean sourceInputValidAt(int dateIndex, int cellIndex) {
		return sourceValidity[elementIndex(dateIndex, cellIndex)] == 1;
	}

	private int elementIndex(int dateIndex, int cellIndex) {
		return Math.addExact(Math.multiplyExact(dateIndex, cellCount), cellIndex);
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
		long[] cellDaysByCode = new long[5];
		int[] firstDayByCode = {-1, -1, -1, -1, -1};
		int[] lastDayByCode = {-1, -1, -1, -1, -1};
		for (int index = 0; index < valueCount; index++) {
			float value = readFloat32LittleEndian(values, index * Float.BYTES);
			if (!Float.isFinite(value) || value < 0) {
				throw new DatasetUnavailableException("daily-values.f32 contains an invalid value");
			}
			int sourceCode = Byte.toUnsignedInt(sources[index]);
			if (sourceCode < 1 || sourceCode > 4) {
				throw new DatasetUnavailableException("daily-source.u8 contains a code outside 1..4");
			}
			int day = index / cellCount;
			cellDaysByCode[sourceCode]++;
			if (firstDayByCode[sourceCode] < 0) {
				firstDayByCode[sourceCode] = day;
			}
			lastDayByCode[sourceCode] = day;
			if (readInt16LittleEndian(inputCounts, index * Short.BYTES) < 0) {
				throw new DatasetUnavailableException("daily-input-count.i16 contains a negative value");
			}
			int valid = Byte.toUnsignedInt(sourceValidity[index]);
			if (valid != 0 && valid != 1) {
				throw new DatasetUnavailableException(
						"daily-source-input-valid.u8 contains a value outside 0..1");
			}
		}
		validateSourceProvenance(cellDaysByCode, firstDayByCode, lastDayByCode);
	}

	/**
	 * The manifest itself is not hash-protected, so its per-source provenance (cell-days, first and
	 * last date) is cross-checked against daily-source.u8. Services read source/origin labels from the
	 * manifest; this guarantees those labels describe the bytes that are actually served.
	 */
	private void validateSourceProvenance(long[] cellDaysByCode, int[] firstDayByCode, int[] lastDayByCode) {
		for (DatasetManifest.SourceCodeDefinition definition : manifest.sourceCodes()) {
			int code = definition.code();
			String expectedFirst = firstDayByCode[code] < 0 ? null : startDate.plusDays(firstDayByCode[code]).toString();
			String expectedLast = lastDayByCode[code] < 0 ? null : startDate.plusDays(lastDayByCode[code]).toString();
			if (definition.cellDays() != cellDaysByCode[code]
					|| !Objects.equals(definition.firstDate(), expectedFirst)
					|| !Objects.equals(definition.lastDate(), expectedLast)) {
				throw new DatasetUnavailableException(
						"Manifest sourceCodes code " + code
								+ " cellDays/firstDate/lastDate do not match daily-source.u8");
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
