package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.ActivityDailySeries;
import com.se201411.mvc.backend.domain.activity.AreaActivitySummary;
import com.se201411.mvc.backend.domain.activity.AreaDailySeries;
import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.repository.AreaActivityRepository;

import java.time.LocalDate;
import java.util.Objects;

/**
 * Named-area view over {@link FileActivityQueryRepository}. Kept for TASK 03A callers; it delegates
 * to the selection-neutral query engine so named areas and bounding boxes share one aggregation
 * algorithm and one set of precomputed tables.
 */
public final class FileAreaActivityRepository implements AreaActivityRepository {

	private final FileActivityQueryRepository queries;

	public FileAreaActivityRepository(FileActivityQueryRepository queries) {
		this.queries = Objects.requireNonNull(queries, "activity query repository must not be null");
	}

	/** Convenience constructor that builds its own query engine (used by tests and standalone tools). */
	public FileAreaActivityRepository(FileDailyActivityRepository daily, FileAreaRepository areas) {
		this(new FileActivityQueryRepository(daily, areas));
	}

	@Override
	public AreaActivitySummary summarize(AreaDefinition area, LocalDate startInclusive, LocalDate endInclusive) {
		Objects.requireNonNull(area, "area must not be null");
		ActivityAggregate aggregate = queries.summarize(area.cellIds(), startInclusive, endInclusive);
		return new AreaActivitySummary(
				area.type(),
				area.id(),
				startInclusive,
				endInclusive,
				aggregate.cellCount(),
				aggregate.dayCount(),
				aggregate.value(),
				aggregate.sources());
	}

	@Override
	public AreaDailySeries dailySeries(AreaDefinition area, LocalDate startInclusive, LocalDate endInclusive) {
		Objects.requireNonNull(area, "area must not be null");
		ActivityDailySeries series = queries.dailySeries(area.cellIds(), startInclusive, endInclusive);
		return new AreaDailySeries(area.type(), area.id(), startInclusive, series.values());
	}
}
