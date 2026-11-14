package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.CellActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.repository.ActivityQueryRepository;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.service.ActivityService;
import com.se201411.mvc.backend.service.ProvenanceService;
import com.se201411.mvc.backend.service.SpatialSelectionService;
import com.se201411.mvc.backend.service.TemporalSelectionService;
import com.se201411.mvc.backend.service.model.ActivityOrigin;
import com.se201411.mvc.backend.service.model.CalendarActivityResult;
import com.se201411.mvc.backend.service.model.CalendarGranularity;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.DailyActivityResult;
import com.se201411.mvc.backend.service.model.DailyCalendarActivityResult;
import com.se201411.mvc.backend.service.model.MapActivityResult;
import com.se201411.mvc.backend.service.model.SourceContribution;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import com.se201411.mvc.backend.service.model.TemporalSelection;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;
import com.se201411.mvc.backend.service.model.TemporalSelectionType;
import com.se201411.mvc.backend.service.model.ValueStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Application orchestration for the v0.4 map, calendar and daily APIs.
 * This class intentionally remains free of fire/anomaly classification; it only aggregates the
 * published harmonized activity artifact and reports its provenance and coverage.
 */
@Service
public final class ActivityServiceImpl implements ActivityService {

	private static final int MINIMUM_BASELINE_SAMPLE_SIZE = 5;

	private final SpatialSelectionService spatialSelectionService;
	private final TemporalSelectionService temporalSelectionService;
	private final ActivityQueryRepository activityRepository;
	private final ProvenanceService provenanceService;
	private final DatasetManifest manifest;

	public ActivityServiceImpl(
			SpatialSelectionService spatialSelectionService,
			TemporalSelectionService temporalSelectionService,
			ActivityQueryRepository activityRepository,
			ProvenanceService provenanceService,
			DatasetMetadataRepository metadataRepository) {
		this.spatialSelectionService = spatialSelectionService;
		this.temporalSelectionService = temporalSelectionService;
		this.activityRepository = activityRepository;
		this.provenanceService = provenanceService;
		this.manifest = metadataRepository.getManifest();
	}

	@Override
	public MapActivityResult getMap(SpatialSelectionCriteria spatial, TemporalSelectionCriteria temporal) {
		SpatialSelection selection = spatialSelectionService.resolveOrNational(spatial);
		TemporalSelection temporalSelection = temporalSelectionService.resolveMap(temporal);
		Coverage coverage = temporalSelection.coverage();

		if (!coverage.hasCoverage()) {
			List<MapActivityResult.CellValue> unavailable = selection.cells().stream()
					.map(cell -> unavailableCell(cell, ValueStatus.OUTSIDE_DATASET_RANGE))
					.toList();
			return new MapActivityResult(
					selection,
					temporalSelection,
					new MapActivityResult.Summary(
							null, ValueStatus.OUTSIDE_DATASET_RANGE, null, coverage, null, null),
					unavailable,
					manifest,
					warnings("/map/cells", selection, coverage, List.of(), temporalSelection.date()));
		}

		ActivityAggregate aggregate = summarize(selection, coverage);
		List<CellActivityAggregate> cellAggregates = activityRepository.summarizeCells(
				selection.cellIds(), coverage.coveredStartDate(), coverage.coveredEndDate());
		if (cellAggregates.size() != selection.cells().size()) {
			throw new IllegalStateException("Activity repository returned a different number of cells than requested");
		}

		boolean exactDate = temporalSelection.type() == TemporalSelectionType.DATE;
		List<MapActivityResult.CellValue> cells = new ArrayList<>(cellAggregates.size());
		for (int index = 0; index < cellAggregates.size(); index++) {
			CellActivityAggregate cellAggregate = cellAggregates.get(index);
			CellArea cell = selection.cells().get(index);
			if (!cell.cellId().equals(cellAggregate.cellId())) {
				throw new IllegalStateException("Activity repository did not preserve requested cell order");
			}
			cells.add(mapCell(cell, cellAggregate, coverage.partial(), exactDate));
		}

		double min = cells.stream().mapToDouble(cell -> cell.value()).min().orElseThrow();
		double max = cells.stream().mapToDouble(cell -> cell.value()).max().orElseThrow();
		ActivityOrigin origin = provenanceService.resolveOrigin(aggregate.sources());
		return new MapActivityResult(
				selection,
				temporalSelection,
				new MapActivityResult.Summary(
						aggregate.value(), ValueStatus.AVAILABLE, origin, coverage, min, max),
				cells,
				manifest,
				warnings("/map/cells", selection, coverage, aggregate.sources(), temporalSelection.date()));
	}

	@Override
	public CalendarActivityResult getCalendar(
			SpatialSelectionCriteria spatial,
			int year,
			String granularityValue,
			boolean includeBaseline,
			Integer baselineStartYear,
			Integer baselineEndYear) {
		SpatialSelection selection = spatialSelectionService.resolve(spatial);
		temporalSelectionService.validateSupportedYear(year);
		CalendarGranularity granularity = CalendarGranularity.fromApiValue(granularityValue);
		List<CalendarActivityResult.Value> values = calendarValues(selection, year, granularity);
		Coverage yearCoverage = temporalSelectionService.coverage(
				LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
		ActivityAggregate yearAggregate = yearCoverage.hasCoverage() ? summarize(selection, yearCoverage) : null;
		ValueStatus status = yearCoverage.hasCoverage()
				? ValueStatus.AVAILABLE : ValueStatus.OUTSIDE_DATASET_RANGE;
		CalendarActivityResult.Summary summary = new CalendarActivityResult.Summary(
				yearAggregate == null ? null : yearAggregate.value(),
				status,
				yearCoverage,
				peakPeriod(values));
		CalendarActivityResult.Baseline baseline = includeBaseline
				? baseline(selection, year, granularity, baselineStartYear, baselineEndYear)
				: null;
		return new CalendarActivityResult(
				selection,
				year,
				granularity,
				values,
				summary,
				baseline,
				manifest,
				warnings(
						"/calendar",
						selection,
						yearCoverage,
						yearAggregate == null ? List.of() : yearAggregate.sources(),
						null));
	}

	@Override
	public DailyCalendarActivityResult getDailyCalendar(
			SpatialSelectionCriteria spatial,
			int year,
			int month) {
		SpatialSelection selection = spatialSelectionService.resolve(spatial);
		temporalSelectionService.validateSupportedYear(year);
		if (month < 1 || month > 12) {
			throw ApiException.invalidParameter("month must be between 1 and 12");
		}
		YearMonth requestedMonth = YearMonth.of(year, month);
		Coverage monthCoverage = temporalSelectionService.coverage(
				requestedMonth.atDay(1), requestedMonth.atEndOfMonth());
		List<DailyCalendarActivityResult.Value> values = new ArrayList<>(requestedMonth.lengthOfMonth());
		for (int day = 1; day <= requestedMonth.lengthOfMonth(); day++) {
			LocalDate date = requestedMonth.atDay(day);
			Coverage dayCoverage = temporalSelectionService.coverage(date, date);
			if (!dayCoverage.hasCoverage()) {
				values.add(new DailyCalendarActivityResult.Value(
						date, null, ValueStatus.OUTSIDE_DATASET_RANGE, false, null, List.of()));
				continue;
			}
			ActivityAggregate aggregate = summarize(selection, dayCoverage);
			values.add(new DailyCalendarActivityResult.Value(
					date,
					aggregate.value(),
					ValueStatus.AVAILABLE,
					false,
					provenanceService.resolveOrigin(aggregate.sources()),
					warnings("/calendar/days", selection, dayCoverage, aggregate.sources(), date)));
		}

		ActivityAggregate monthAggregate = monthCoverage.hasCoverage() ? summarize(selection, monthCoverage) : null;
		DailyCalendarActivityResult.Summary summary = new DailyCalendarActivityResult.Summary(
				monthAggregate == null ? null : monthAggregate.value(),
				monthAggregate == null ? ValueStatus.OUTSIDE_DATASET_RANGE : ValueStatus.AVAILABLE,
				monthCoverage,
				peakDate(values));
		return new DailyCalendarActivityResult(
				selection,
				year,
				month,
				values,
				summary,
				manifest,
				warnings(
						"/calendar/days",
						selection,
						monthCoverage,
						monthAggregate == null ? List.of() : monthAggregate.sources(),
						null));
	}

	@Override
	public DailyActivityResult getDaily(
			SpatialSelectionCriteria spatial,
			LocalDate date,
			boolean includeCells) {
		if (date == null) {
			throw ApiException.invalidParameter("date is required");
		}
		SpatialSelection selection = spatialSelectionService.resolve(spatial);
		TemporalSelection temporal = temporalSelectionService.resolveMap(
				new TemporalSelectionCriteria(date, null, null, null));
		ActivityAggregate aggregate = summarize(selection, temporal.coverage());
		List<MapActivityResult.CellValue> cells = null;
		if (includeCells) {
			List<CellActivityAggregate> cellAggregates = activityRepository.summarizeCells(
					selection.cellIds(), date, date);
			if (cellAggregates.size() != selection.cells().size()) {
				throw new IllegalStateException("Activity repository returned a different number of cells than requested");
			}
			cells = new ArrayList<>(cellAggregates.size());
			for (int index = 0; index < cellAggregates.size(); index++) {
				CellArea cell = selection.cells().get(index);
				CellActivityAggregate cellAggregate = cellAggregates.get(index);
				if (!cell.cellId().equals(cellAggregate.cellId())) {
					throw new IllegalStateException("Activity repository did not preserve requested cell order");
				}
				cells.add(mapCell(cell, cellAggregate, false, true));
			}
		}
		return new DailyActivityResult(
				selection,
				date,
				aggregate.value(),
				ValueStatus.AVAILABLE,
				provenanceService.resolveOrigin(aggregate.sources()),
				false,
				provenanceService.describe(aggregate.sources()),
				cells,
				manifest,
				warnings("/daily", selection, temporal.coverage(), aggregate.sources(), date));
	}

	private List<CalendarActivityResult.Value> calendarValues(
			SpatialSelection selection,
			int year,
			CalendarGranularity granularity) {
		List<CalendarActivityResult.Value> values = new ArrayList<>(granularity.periodCount());
		for (int period = 1; period <= granularity.periodCount(); period++) {
			TemporalSelectionService.DateRange range = temporalSelectionService.period(year, granularity, period);
			Coverage coverage = temporalSelectionService.coverage(range.startDate(), range.endDate());
			if (!coverage.hasCoverage()) {
				values.add(new CalendarActivityResult.Value(
						period,
						range.startDate(),
						range.endDate(),
						null,
						ValueStatus.OUTSIDE_DATASET_RANGE,
						false,
						null,
						coverage));
				continue;
			}
			ActivityAggregate aggregate = summarize(selection, coverage);
			values.add(new CalendarActivityResult.Value(
					period,
					range.startDate(),
					range.endDate(),
					aggregate.value(),
					ValueStatus.AVAILABLE,
					coverage.partial(),
					provenanceService.resolveOrigin(aggregate.sources()),
					coverage));
		}
		return List.copyOf(values);
	}

	private CalendarActivityResult.Baseline baseline(
			SpatialSelection selection,
			int targetYear,
			CalendarGranularity granularity,
			Integer requestedStartYear,
			Integer requestedEndYear) {
		int startYear = requestedStartYear == null ? 2003 : requestedStartYear;
		int endYear = requestedEndYear == null ? 2025 : requestedEndYear;
		temporalSelectionService.validateSupportedYear(startYear);
		temporalSelectionService.validateSupportedYear(endYear);
		if (startYear > endYear) {
			throw ApiException.invalidParameter("baselineStartYear must not be after baselineEndYear");
		}
		boolean excludesTarget = targetYear >= startYear && targetYear <= endYear;
		List<CalendarActivityResult.BaselineValue> values = new ArrayList<>(granularity.periodCount());
		for (int period = 1; period <= granularity.periodCount(); period++) {
			List<Double> samples = new ArrayList<>();
			for (int referenceYear = startYear; referenceYear <= endYear; referenceYear++) {
				if (referenceYear == targetYear) {
					continue;
				}
				TemporalSelectionService.DateRange range =
						temporalSelectionService.period(referenceYear, granularity, period);
				Coverage coverage = temporalSelectionService.coverage(range.startDate(), range.endDate());
				if (!coverage.hasCoverage() || coverage.partial()) {
					continue;
				}
				samples.add(summarize(selection, coverage).value());
			}
			if (samples.size() < MINIMUM_BASELINE_SAMPLE_SIZE) {
				values.add(new CalendarActivityResult.BaselineValue(
						period, null, samples.size(), ValueStatus.INSUFFICIENT_BASELINE));
			}
			else {
				values.add(new CalendarActivityResult.BaselineValue(
						period, median(samples), samples.size(), ValueStatus.AVAILABLE));
			}
		}
		return new CalendarActivityResult.Baseline(
				"median", startYear, endYear, excludesTarget, values);
	}

	private ActivityAggregate summarize(SpatialSelection selection, Coverage coverage) {
		if (!coverage.hasCoverage()) {
			throw new IllegalArgumentException("Cannot aggregate a period without dataset coverage");
		}
		ActivityAggregate aggregate = activityRepository.summarize(
				selection.cellIds(), coverage.coveredStartDate(), coverage.coveredEndDate());
		if (aggregate.sources().isEmpty()) {
			throw new IllegalStateException("Activity repository returned no source composition");
		}
		return aggregate;
	}

	private MapActivityResult.CellValue mapCell(
			CellArea cell,
			CellActivityAggregate aggregate,
			boolean partial,
			boolean exactDate) {
		if (aggregate.sources().isEmpty()) {
			throw new IllegalStateException(
					"Activity repository returned no source composition for cell " + cell.cellId());
		}
		ActivityOrigin origin = provenanceService.resolveOrigin(aggregate.sources());
		if (!exactDate) {
			return new MapActivityResult.CellValue(
					cell, aggregate.value(), ValueStatus.AVAILABLE, partial, origin, null, null, null, null);
		}
		if (aggregate.sources().size() != 1) {
			throw new IllegalStateException("An exact cell-date must have exactly one source");
		}
		SourceContribution source = provenanceService.describe(aggregate.sources().getFirst());
		return new MapActivityResult.CellValue(
				cell,
				aggregate.value(),
				ValueStatus.AVAILABLE,
				partial,
				origin,
				source.sourceCode(),
				source.source(),
				Math.toIntExact(source.inputObservationCount()),
				source.sourceInputValidCellCount() > 0);
	}

	private static MapActivityResult.CellValue unavailableCell(CellArea cell, ValueStatus status) {
		return new MapActivityResult.CellValue(cell, null, status, false, null, null, null, null, null);
	}

	private static CalendarActivityResult.PeriodPeak peakPeriod(List<CalendarActivityResult.Value> values) {
		CalendarActivityResult.Value peak = null;
		for (CalendarActivityResult.Value value : values) {
			if (value.valueStatus() != ValueStatus.AVAILABLE || value.partial() || value.value() == null
					|| value.value() <= 0) {
				continue;
			}
			if (peak == null || value.value() > peak.value()) {
				peak = value;
			}
		}
		return peak == null ? null : new CalendarActivityResult.PeriodPeak(peak.period(), peak.value());
	}

	private static DailyCalendarActivityResult.DatePeak peakDate(
			List<DailyCalendarActivityResult.Value> values) {
		DailyCalendarActivityResult.Value peak = null;
		for (DailyCalendarActivityResult.Value value : values) {
			if (value.valueStatus() != ValueStatus.AVAILABLE || value.partial() || value.value() == null
					|| value.value() <= 0) {
				continue;
			}
			if (peak == null || value.value() > peak.value()) {
				peak = value;
			}
		}
		return peak == null ? null : new DailyCalendarActivityResult.DatePeak(peak.date(), peak.value());
	}

	private static double median(List<Double> samples) {
		samples.sort(Comparator.naturalOrder());
		int middle = samples.size() / 2;
		return samples.size() % 2 == 1
				? samples.get(middle)
				: (samples.get(middle - 1) + samples.get(middle)) / 2.0;
	}

	private List<String> warnings(
			String endpoint,
			SpatialSelection selection,
			Coverage coverage,
			List<SourceComposition> sources,
			LocalDate exactDate) {
		LinkedHashSet<String> warnings = new LinkedHashSet<>();
		if (coverage.partial()) {
			warnings.add("PARTIAL_PERIOD");
		}
		if (exactDate != null && exactDate.equals(temporalSelectionService.datasetEndDate())
				&& (endpoint.equals("/daily") || endpoint.equals("/map/cells"))) {
			warnings.add("DATASET_EDGE_DATE");
		}
		if (hasSource(sources, 1)) {
			warnings.add("TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY");
		}
		if (exactDate != null && (hasSource(sources, 1) || hasSource(sources, 2))) {
			warnings.add("MODEL_REDISTRIBUTED_DAILY_VALUE");
		}
		if (exactDate != null && (endpoint.equals("/daily") || endpoint.equals("/map/cells"))) {
			warnings.add("NO_DAILY_UNCERTAINTY_INTERVAL");
		}
		if (selection.area() != null && "diagnostic_region".equals(selection.area().type().apiValue())) {
			warnings.add("DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY");
		}
		if (hasSource(sources, 2)
				&& coverage.coveredEndDate() != null
				&& !coverage.coveredEndDate().isBefore(LocalDate.of(2022, 1, 1))) {
			warnings.add("AQUA_FALLBACK_AFTER_ORBIT_DRIFT");
		}
		return List.copyOf(warnings);
	}

	private static boolean hasSource(List<SourceComposition> sources, int sourceCode) {
		return sources.stream().anyMatch(source -> source.sourceCode() == sourceCode);
	}
}
