package com.se201411.mvc.backend.domain.activity;

import java.time.LocalDate;
import java.util.Arrays;

/**
 * Daily totals of snpp_eq for a cell selection, one value per consecutive day starting at
 * {@code startDate}. Values are not rounded; zero is a real value. The array is copied on the way
 * in and out, so instances are immutable.
 */
public record ActivityDailySeries(LocalDate startDate, double[] values) {

	public ActivityDailySeries {
		if (startDate == null) {
			throw new IllegalArgumentException("startDate must not be null");
		}
		if (values == null || values.length == 0) {
			throw new IllegalArgumentException("values must contain at least one day");
		}
		values = values.clone();
		for (double value : values) {
			if (!Double.isFinite(value) || value < 0) {
				throw new IllegalArgumentException("values must be finite and non-negative");
			}
		}
	}

	@Override
	public double[] values() {
		return values.clone();
	}

	public int size() {
		return values.length;
	}

	public double valueAt(int dayOffset) {
		return values[dayOffset];
	}

	public LocalDate dateAt(int dayOffset) {
		if (dayOffset < 0 || dayOffset >= values.length) {
			throw new IndexOutOfBoundsException("dayOffset out of range: " + dayOffset);
		}
		return startDate.plusDays(dayOffset);
	}

	public LocalDate endDate() {
		return startDate.plusDays(values.length - 1L);
	}

	@Override
	public boolean equals(Object other) {
		return other instanceof ActivityDailySeries that
				&& startDate.equals(that.startDate)
				&& Arrays.equals(values, that.values);
	}

	@Override
	public int hashCode() {
		return 31 * startDate.hashCode() + Arrays.hashCode(values);
	}

	@Override
	public String toString() {
		return "ActivityDailySeries[" + startDate + ", days=" + values.length + "]";
	}
}
