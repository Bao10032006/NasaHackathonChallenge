package com.se201411.mvc.backend.repository;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.ActivityDailySeries;
import com.se201411.mvc.backend.domain.activity.CellActivityAggregate;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/**
 * Selection-neutral query engine over the validated daily cube (TASK 03B2A).
 * Named areas and bounding boxes are both resolved to a list of cell IDs by the service layer
 * before calling this repository, so every endpoint aggregates through the same code path.
 *
 * <p>Contract shared by all methods:
 * <ul>
 *   <li>{@code cellIds} must be non-empty, without null, blank or duplicate IDs, and every ID must
 *       exist in the active snapshot. Selections of 1 to 587 cells crossing any diagnostic regions
 *       are supported.</li>
 *   <li>Dates are inclusive, {@code startInclusive} must not be after {@code endInclusive} and both
 *       must lie inside the dataset date range. Clipping a requested period to the dataset range and
 *       computing coverage is the caller's responsibility.</li>
 *   <li>Invalid input fails with {@link IllegalArgumentException}; it never yields a silent zero.</li>
 *   <li>Values are summed in {@code double} directly from the float32 artifact and are not rounded.
 *       A zero is a real observed or estimated value, never a placeholder for missing data.</li>
 *   <li>Implementations must not materialise one object per cell-day of the full cube.</li>
 * </ul>
 */
public interface ActivityQueryRepository {

	/**
	 * Total of all selected cells over the date range, with per-source composition.
	 * The order of {@code cellIds} does not affect the result.
	 */
	ActivityAggregate summarize(Collection<String> cellIds, LocalDate startInclusive, LocalDate endInclusive);

	/**
	 * Daily totals of all selected cells, one value per day from {@code startInclusive} to
	 * {@code endInclusive}.
	 */
	ActivityDailySeries dailySeries(Collection<String> cellIds, LocalDate startInclusive, LocalDate endInclusive);

	/**
	 * Per-cell totals over the date range, returned in the same order as {@code cellIds}.
	 */
	List<CellActivityAggregate> summarizeCells(
			Collection<String> cellIds,
			LocalDate startInclusive,
			LocalDate endInclusive);
}
