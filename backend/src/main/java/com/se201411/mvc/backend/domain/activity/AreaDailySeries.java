package com.se201411.mvc.backend.domain.activity;

import com.se201411.mvc.backend.domain.area.AreaType;

import java.time.LocalDate;
import java.util.Arrays;

/**
 * Daily area totals of snpp_eq for consecutive days starting at {@code startDate}.
 * The array is copied on the way in and out, so instances are immutable.
 */
public record AreaDailySeries(AreaType areaType, String areaId, LocalDate startDate, double[] values) {

	public AreaDailySeries {
		if (areaType == null || areaId == null || startDate == null) {
			throw new IllegalArgumentException("area and startDate must not be null");
		}
		values = values == null ? new double[0] : values.clone();
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

	public LocalDate endDate() {
		return startDate.plusDays(Math.max(values.length - 1, 0));
	}

	@Override
	public boolean equals(Object other) {
		return other instanceof AreaDailySeries that
				&& areaType == that.areaType
				&& areaId.equals(that.areaId)
				&& startDate.equals(that.startDate)
				&& Arrays.equals(values, that.values);
	}

	@Override
	public int hashCode() {
		return 31 * (31 * (31 * areaType.hashCode() + areaId.hashCode()) + startDate.hashCode())
				+ Arrays.hashCode(values);
	}

	@Override
	public String toString() {
		return "AreaDailySeries[" + areaType + ":" + areaId + ", " + startDate + ", days=" + values.length + "]";
	}
}
