package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.ActivityDailySeries;
import com.se201411.mvc.backend.domain.activity.CellActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.repository.ActivityQueryRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * File-backed {@link ActivityQueryRepository} over the validated daily cube (TASK 03B2A A1).
 *
 * <p>Every selection is normalised to dataset (canonical) cell order before aggregation, so a
 * bounding box and a named area that resolve to the same cells produce bit-identical results, and
 * the input order never changes a sum. Per-day totals and per-source composition are precomputed
 * once for ToanQuoc and the diagnostic regions; any other selection is aggregated on demand with
 * the same per-day arithmetic. Range sums add per-day values in double precision (no prefix-sum
 * subtraction), and no object is created per cell-day.
 */
public final class FileActivityQueryRepository implements ActivityQueryRepository {

	private static final int SOURCE_SLOTS = 5; // source codes 1..4, slot 0 unused

	private final FileDailyActivityRepository daily;
	private final Map<CellSet, DayTable> precomputed;

	public FileActivityQueryRepository(FileDailyActivityRepository daily, FileAreaRepository areas) {
		this(daily, Objects.requireNonNull(areas, "area repository must not be null").precomputedAreas().stream()
				.map(AreaDefinition::cellIds)
				.toList());
	}

	/** Package-private so tests can compare the precomputed and on-demand paths. */
	FileActivityQueryRepository(FileDailyActivityRepository daily, List<List<String>> precomputedSelections) {
		this.daily = Objects.requireNonNull(daily, "daily repository must not be null");
		Map<CellSet, DayTable> built = new HashMap<>();
		for (List<String> selection : precomputedSelections) {
			CellSet cells = resolve(selection);
			built.putIfAbsent(cells, DayTable.build(daily, cells.sortedIndexes(), 0, daily.dayCount() - 1));
		}
		this.precomputed = Map.copyOf(built);
	}

	@Override
	public ActivityAggregate summarize(Collection<String> cellIds, LocalDate startInclusive, LocalDate endInclusive) {
		CellSet cells = resolve(cellIds);
		Range range = range(startInclusive, endInclusive);
		DayTable table = tableFor(cells, range);

		double value = 0.0;
		long[] cellDays = new long[SOURCE_SLOTS];
		double[] sourceValue = new double[SOURCE_SLOTS];
		long[] input = new long[SOURCE_SLOTS];
		long[] valid = new long[SOURCE_SLOTS];
		for (int day = range.start(); day <= range.end(); day++) {
			int slot = table.slot(day);
			value += table.total[slot];
			for (int code = 1; code < SOURCE_SLOTS; code++) {
				cellDays[code] += table.cellDays[code][slot];
				sourceValue[code] += table.sourceValue[code][slot];
				input[code] += table.input[code][slot];
				valid[code] += table.valid[code][slot];
			}
		}
		int[] distinctCells = distinctSourceCellCounts(cells.sortedIndexes(), range);
		return new ActivityAggregate(
				startInclusive,
				endInclusive,
				cells.size(),
				range.dayCount(),
				value,
				composition(distinctCells, cellDays, sourceValue, input, valid));
	}

	@Override
	public ActivityDailySeries dailySeries(Collection<String> cellIds, LocalDate startInclusive, LocalDate endInclusive) {
		CellSet cells = resolve(cellIds);
		Range range = range(startInclusive, endInclusive);
		DayTable table = tableFor(cells, range);
		double[] values = Arrays.copyOfRange(
				table.total, table.slot(range.start()), table.slot(range.end()) + 1);
		return new ActivityDailySeries(startInclusive, values);
	}

	@Override
	public List<CellActivityAggregate> summarizeCells(
			Collection<String> cellIds,
			LocalDate startInclusive,
			LocalDate endInclusive) {
		CellSet cells = resolve(cellIds);
		Range range = range(startInclusive, endInclusive);
		List<CellActivityAggregate> result = new ArrayList<>(cells.size());
		for (int position = 0; position < cells.size(); position++) {
			int cellIndex = cells.inputIndexes()[position];
			double value = 0.0;
			long[] cellDays = new long[SOURCE_SLOTS];
			double[] sourceValue = new double[SOURCE_SLOTS];
			long[] input = new long[SOURCE_SLOTS];
			long[] valid = new long[SOURCE_SLOTS];
			for (int day = range.start(); day <= range.end(); day++) {
				double cellValue = daily.valueAt(day, cellIndex);
				int code = daily.sourceCodeAt(day, cellIndex);
				value += cellValue;
				cellDays[code]++;
				sourceValue[code] += cellValue;
				input[code] += daily.inputObservationCountAt(day, cellIndex);
				if (daily.sourceInputValidAt(day, cellIndex)) {
					valid[code]++;
				}
			}
			int[] distinctCells = new int[SOURCE_SLOTS];
			for (int code = 1; code < SOURCE_SLOTS; code++) {
				distinctCells[code] = cellDays[code] > 0 ? 1 : 0;
			}
			result.add(new CellActivityAggregate(
					cells.inputIds().get(position),
					startInclusive,
					endInclusive,
					value,
					composition(distinctCells, cellDays, sourceValue, input, valid)));
		}
		return List.copyOf(result);
	}

	private DayTable tableFor(CellSet cells, Range range) {
		DayTable cached = precomputed.get(cells);
		if (cached != null) {
			return cached;
		}
		return DayTable.build(daily, cells.sortedIndexes(), range.start(), range.end());
	}

	private int[] distinctSourceCellCounts(int[] sortedIndexes, Range range) {
		boolean[][] seen = new boolean[SOURCE_SLOTS][sortedIndexes.length];
		for (int day = range.start(); day <= range.end(); day++) {
			for (int position = 0; position < sortedIndexes.length; position++) {
				seen[daily.sourceCodeAt(day, sortedIndexes[position])][position] = true;
			}
		}
		int[] counts = new int[SOURCE_SLOTS];
		for (int code = 1; code < SOURCE_SLOTS; code++) {
			for (boolean present : seen[code]) {
				if (present) {
					counts[code]++;
				}
			}
		}
		return counts;
	}

	private static List<SourceComposition> composition(
			int[] distinctCells,
			long[] cellDays,
			double[] sourceValue,
			long[] input,
			long[] valid) {
		List<SourceComposition> sources = new ArrayList<>(SOURCE_SLOTS - 1);
		for (int code = 1; code < SOURCE_SLOTS; code++) {
			if (cellDays[code] > 0) {
				sources.add(new SourceComposition(
						code, distinctCells[code], cellDays[code], sourceValue[code], input[code], valid[code]));
			}
		}
		return sources;
	}

	private CellSet resolve(Collection<String> cellIds) {
		if (cellIds == null || cellIds.isEmpty()) {
			throw new IllegalArgumentException("cellIds must not be empty");
		}
		List<String> ids = new ArrayList<>(cellIds.size());
		int[] inputIndexes = new int[cellIds.size()];
		Set<String> seen = new HashSet<>();
		int position = 0;
		for (String cellId : cellIds) {
			if (cellId == null || cellId.isBlank()) {
				throw new IllegalArgumentException("cellIds must not contain null or blank values");
			}
			if (!seen.add(cellId)) {
				throw new IllegalArgumentException("cellIds must not contain duplicates: " + cellId);
			}
			ids.add(cellId);
			inputIndexes[position++] = daily.cellIndexOf(cellId);
		}
		int[] sorted = inputIndexes.clone();
		Arrays.sort(sorted);
		return new CellSet(List.copyOf(ids), inputIndexes, sorted);
	}

	private Range range(LocalDate startInclusive, LocalDate endInclusive) {
		int start = daily.dateIndexOf(startInclusive);
		int end = daily.dateIndexOf(endInclusive);
		if (end < start) {
			throw new IllegalArgumentException("endInclusive must not be before startInclusive");
		}
		return new Range(start, end);
	}

	private record Range(int start, int end) {

		int dayCount() {
			return end - start + 1;
		}
	}

	/**
	 * A resolved selection. Equality and hashing use only the canonical (sorted) cell indexes,
	 * so the same cells in any order share one precomputed table.
	 */
	private record CellSet(List<String> inputIds, int[] inputIndexes, int[] sortedIndexes) {

		int size() {
			return inputIndexes.length;
		}

		@Override
		public boolean equals(Object other) {
			return other instanceof CellSet that && Arrays.equals(sortedIndexes, that.sortedIndexes);
		}

		@Override
		public int hashCode() {
			return Arrays.hashCode(sortedIndexes);
		}

		@Override
		public String toString() {
			return "CellSet[size=" + inputIndexes.length + "]";
		}
	}

	/**
	 * Per-day totals and per-source composition for consecutive dataset days starting at
	 * {@code firstDay}. Cells are always visited in canonical order so precomputed and on-demand
	 * tables perform identical floating-point additions.
	 */
	private static final class DayTable {

		final int firstDay;
		final double[] total;
		final int[][] cellDays;
		final double[][] sourceValue;
		final int[][] input;
		final int[][] valid;

		private DayTable(int firstDay, int days) {
			this.firstDay = firstDay;
			this.total = new double[days];
			this.cellDays = new int[SOURCE_SLOTS][days];
			this.sourceValue = new double[SOURCE_SLOTS][days];
			this.input = new int[SOURCE_SLOTS][days];
			this.valid = new int[SOURCE_SLOTS][days];
		}

		static DayTable build(FileDailyActivityRepository daily, int[] sortedIndexes, int fromDay, int toDay) {
			DayTable table = new DayTable(fromDay, toDay - fromDay + 1);
			for (int day = fromDay; day <= toDay; day++) {
				int slot = day - fromDay;
				double total = 0.0;
				for (int cellIndex : sortedIndexes) {
					double value = daily.valueAt(day, cellIndex);
					int code = daily.sourceCodeAt(day, cellIndex);
					total += value;
					table.cellDays[code][slot]++;
					table.sourceValue[code][slot] += value;
					table.input[code][slot] += daily.inputObservationCountAt(day, cellIndex);
					if (daily.sourceInputValidAt(day, cellIndex)) {
						table.valid[code][slot]++;
					}
				}
				table.total[slot] = total;
			}
			return table;
		}

		int slot(int datasetDay) {
			return datasetDay - firstDay;
		}
	}
}
