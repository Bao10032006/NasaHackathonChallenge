package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.AreaActivitySummary;
import com.se201411.mvc.backend.domain.activity.AreaDailySeries;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.repository.AreaActivityRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Area aggregation over the validated daily cube (Technical Design v0.3 section 6A).
 * Daily totals and per-source composition are precomputed once at startup for ToanQuoc and the
 * diagnostic regions; single cells and any other area are aggregated on demand.
 * Range sums add per-day values in double precision (no prefix-sum subtraction) to stay exact
 * to float32 input precision over long ranges.
 */
public final class FileAreaActivityRepository implements AreaActivityRepository {

	private static final int SOURCE_SLOTS = 5; // index 1..4 used, 0 unused

	private final FileDailyActivityRepository daily;
	private final Map<String, DailyAggregate> precomputed;

	public FileAreaActivityRepository(FileDailyActivityRepository daily, FileAreaRepository areas) {
		this.daily = Objects.requireNonNull(daily, "daily repository must not be null");
		Objects.requireNonNull(areas, "area repository must not be null");
		Map<String, DailyAggregate> built = new HashMap<>();
		for (AreaDefinition area : areas.precomputedAreas()) {
			built.put(key(area), aggregate(area, 0, daily.dayCount() - 1));
		}
		this.precomputed = Map.copyOf(built);
	}

	@Override
	public AreaActivitySummary summarize(AreaDefinition area, LocalDate startInclusive, LocalDate endInclusive) {
		Range range = range(area, startInclusive, endInclusive);
		DailyAggregate source = aggregateFor(area, range);
		int from = source.offset(range.start());
		int to = source.offset(range.end());

		double value = 0.0;
		long[] cellDays = new long[SOURCE_SLOTS];
		double[] sourceValue = new double[SOURCE_SLOTS];
		long[] input = new long[SOURCE_SLOTS];
		long[] valid = new long[SOURCE_SLOTS];
		for (int day = from; day <= to; day++) {
			value += source.total[day];
			for (int code = 1; code < SOURCE_SLOTS; code++) {
				cellDays[code] += source.cellDays[code][day];
				sourceValue[code] += source.sourceValue[code][day];
				input[code] += source.input[code][day];
				valid[code] += source.valid[code][day];
			}
		}
		List<SourceComposition> composition = new ArrayList<>();
		for (int code = 1; code < SOURCE_SLOTS; code++) {
			if (cellDays[code] > 0) {
				composition.add(new SourceComposition(code, cellDays[code], sourceValue[code], input[code], valid[code]));
			}
		}
		return new AreaActivitySummary(
				area.type(),
				area.id(),
				startInclusive,
				endInclusive,
				area.cellIds().size(),
				to - from + 1,
				value,
				composition);
	}

	@Override
	public AreaDailySeries dailySeries(AreaDefinition area, LocalDate startInclusive, LocalDate endInclusive) {
		Range range = range(area, startInclusive, endInclusive);
		DailyAggregate source = aggregateFor(area, range);
		int from = source.offset(range.start());
		int to = source.offset(range.end());
		double[] values = new double[to - from + 1];
		System.arraycopy(source.total, from, values, 0, values.length);
		return new AreaDailySeries(area.type(), area.id(), startInclusive, values);
	}

	private Range range(AreaDefinition area, LocalDate startInclusive, LocalDate endInclusive) {
		Objects.requireNonNull(area, "area must not be null");
		int start = daily.dateIndexOf(startInclusive);
		int end = daily.dateIndexOf(endInclusive);
		if (end < start) {
			throw new IllegalArgumentException("endInclusive must not be before startInclusive");
		}
		return new Range(start, end);
	}

	private DailyAggregate aggregateFor(AreaDefinition area, Range range) {
		DailyAggregate cached = precomputed.get(key(area));
		if (cached != null && cached.cellCount == area.cellIds().size()) {
			return cached;
		}
		return aggregate(area, range.start(), range.end());
	}

	private DailyAggregate aggregate(AreaDefinition area, int fromDay, int toDay) {
		int[] cellIndexes = area.cellIds().stream().mapToInt(daily::cellIndexOf).toArray();
		DailyAggregate result = new DailyAggregate(fromDay, toDay - fromDay + 1, cellIndexes.length);
		for (int day = fromDay; day <= toDay; day++) {
			int slot = day - fromDay;
			double total = 0.0;
			for (int cellIndex : cellIndexes) {
				double value = daily.valueAt(day, cellIndex);
				int code = daily.sourceCodeAt(day, cellIndex);
				total += value;
				result.cellDays[code][slot] += 1;
				result.sourceValue[code][slot] += value;
				result.input[code][slot] += daily.inputObservationCountAt(day, cellIndex);
				if (daily.sourceInputValidAt(day, cellIndex)) {
					result.valid[code][slot] += 1;
				}
			}
			result.total[slot] = total;
		}
		return result;
	}

	private static String key(AreaDefinition area) {
		return area.type().name() + ":" + area.id();
	}

	private record Range(int start, int end) {
	}

	/** Per-day totals and per-source composition for consecutive days starting at {@code firstDay}. */
	private static final class DailyAggregate {

		final int firstDay;
		final int cellCount;
		final double[] total;
		final int[][] cellDays;
		final double[][] sourceValue;
		final int[][] input;
		final int[][] valid;

		DailyAggregate(int firstDay, int days, int cellCount) {
			this.firstDay = firstDay;
			this.cellCount = cellCount;
			this.total = new double[days];
			this.cellDays = new int[SOURCE_SLOTS][days];
			this.sourceValue = new double[SOURCE_SLOTS][days];
			this.input = new int[SOURCE_SLOTS][days];
			this.valid = new int[SOURCE_SLOTS][days];
		}

		int offset(int datasetDayIndex) {
			return datasetDayIndex - firstDay;
		}
	}
}
