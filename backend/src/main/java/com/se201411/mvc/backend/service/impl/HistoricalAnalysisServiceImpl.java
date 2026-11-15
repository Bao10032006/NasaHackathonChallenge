package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.repository.ActivityQueryRepository;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.service.HistoricalAnalysisService;
import com.se201411.mvc.backend.service.ProvenanceService;
import com.se201411.mvc.backend.service.SpatialSelectionService;
import com.se201411.mvc.backend.service.TemporalSelectionService;
import com.se201411.mvc.backend.service.model.CalendarGranularity;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.SeasonalityResult;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import com.se201411.mvc.backend.service.model.TrendGranularity;
import com.se201411.mvc.backend.service.model.TrendResult;
import com.se201411.mvc.backend.service.model.ValueStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * TASK 03B3B: {@code /trends} and {@code /seasonality}.
 * Both resolve the cell set through {@link SpatialSelectionService} and aggregate through
 * {@link ActivityQueryRepository}, the same path as {@code /calendar}, so a named area and an equivalent
 * bbox give identical values. Purely descriptive: no anomaly or fire classification.
 */
@Service
public final class HistoricalAnalysisServiceImpl implements HistoricalAnalysisService {

	/** Contract v0.4 (D02): seasonal statistics need at least five valid reference years. */
	static final int MINIMUM_SAMPLE_SIZE = 5;
	static final int DEFAULT_REFERENCE_START_YEAR = 2003;
	static final int DEFAULT_REFERENCE_END_YEAR = 2025;
	private static final LocalDate AQUA_ORBIT_DRIFT_FROM = LocalDate.of(2022, 1, 1);

	private final SpatialSelectionService spatialSelectionService;
	private final TemporalSelectionService temporalSelectionService;
	private final ActivityQueryRepository activityRepository;
	private final ProvenanceService provenanceService;
	private final DatasetManifest manifest;

	public HistoricalAnalysisServiceImpl(
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
	public TrendResult getTrends(
			SpatialSelectionCriteria spatial,
			int startYear,
			int endYear,
			String granularityValue,
			Integer period) {
		SpatialSelection selection = spatialSelectionService.resolve(spatial);
		validateYearRange(startYear, endYear, "startYear", "endYear");
		TrendGranularity granularity = TrendGranularity.fromApiValue(granularityValue);
		validatePeriod(granularity, period);

		List<TrendResult.Point> points = new ArrayList<>(endYear - startYear + 1);
		LinkedHashSet<String> warnings = new LinkedHashSet<>();
		for (int year = startYear; year <= endYear; year++) {
			TemporalSelectionService.DateRange range = range(year, granularity, period);
			Coverage coverage = temporalSelectionService.coverage(range.startDate(), range.endDate());
			if (!coverage.hasCoverage()) {
				points.add(new TrendResult.Point(
						year, period, null, ValueStatus.OUTSIDE_DATASET_RANGE, false, null, coverage));
				continue;
			}
			ActivityAggregate aggregate = summarize(selection, coverage);
			points.add(new TrendResult.Point(
					year,
					period,
					aggregate.value(),
					ValueStatus.AVAILABLE,
					coverage.partial(),
					provenanceService.resolveOrigin(aggregate.sources()),
					coverage));
			collectSourceWarnings(warnings, coverage, aggregate.sources());
			if (coverage.partial()) {
				warnings.add("PARTIAL_PERIOD");
			}
		}
		addAreaWarning(warnings, selection);
		return new TrendResult(selection, granularity, period, points, manifest, ordered(warnings));
	}

	@Override
	public SeasonalityResult getSeasonality(
			SpatialSelectionCriteria spatial,
			String granularityValue,
			Integer requestedStartYear,
			Integer requestedEndYear) {
		SpatialSelection selection = spatialSelectionService.resolve(spatial);
		CalendarGranularity granularity = CalendarGranularity.fromApiValue(granularityValue);
		int startYear = requestedStartYear == null ? DEFAULT_REFERENCE_START_YEAR : requestedStartYear;
		int endYear = requestedEndYear == null ? DEFAULT_REFERENCE_END_YEAR : requestedEndYear;
		validateYearRange(startYear, endYear, "startYear", "endYear");

		List<SeasonalityResult.Period> periods = new ArrayList<>(granularity.periodCount());
		for (int period = 1; period <= granularity.periodCount(); period++) {
			List<Double> samples = new ArrayList<>(endYear - startYear + 1);
			for (int year = startYear; year <= endYear; year++) {
				TemporalSelectionService.DateRange range = temporalSelectionService.period(year, granularity, period);
				Coverage coverage = temporalSelectionService.coverage(range.startDate(), range.endDate());
				// Missing, outside-range and partial periods are excluded; a valid zero stays in the sample.
				if (!coverage.hasCoverage() || coverage.partial()) {
					continue;
				}
				samples.add(summarize(selection, coverage).value());
			}
			periods.add(statistics(period, samples));
		}
		LinkedHashSet<String> warnings = new LinkedHashSet<>();
		addAreaWarning(warnings, selection);
		return new SeasonalityResult(
				selection,
				granularity,
				startYear,
				endYear,
				MINIMUM_SAMPLE_SIZE,
				periods,
				manifest,
				List.copyOf(warnings));
	}

	static SeasonalityResult.Period statistics(int period, List<Double> samples) {
		if (samples.size() < MINIMUM_SAMPLE_SIZE) {
			return new SeasonalityResult.Period(
					period, samples.size(), null, null, ValueStatus.INSUFFICIENT_BASELINE);
		}
		double sum = 0;
		for (double sample : samples) {
			sum += sample;
		}
		return new SeasonalityResult.Period(
				period, samples.size(), sum / samples.size(), median(samples), ValueStatus.AVAILABLE);
	}

	static double median(List<Double> samples) {
		List<Double> sorted = new ArrayList<>(samples);
		sorted.sort(Double::compare);
		int middle = sorted.size() / 2;
		return sorted.size() % 2 == 1
				? sorted.get(middle)
				: (sorted.get(middle - 1) + sorted.get(middle)) / 2.0;
	}

	private void validateYearRange(int startYear, int endYear, String startName, String endName) {
		temporalSelectionService.validateSupportedYear(startYear);
		temporalSelectionService.validateSupportedYear(endYear);
		if (startYear > endYear) {
			throw ApiException.invalidParameter(startName + " must not be after " + endName);
		}
	}

	private static void validatePeriod(TrendGranularity granularity, Integer period) {
		if (granularity == TrendGranularity.YEAR) {
			if (period != null) {
				throw ApiException.invalidParameter("period is not allowed when granularity=year");
			}
			return;
		}
		if (period == null) {
			throw ApiException.invalidParameter("period is required when granularity=" + granularity.apiValue());
		}
		int maximum = granularity.periodGranularity().periodCount();
		if (period < 1 || period > maximum) {
			throw ApiException.invalidParameter(
					"period must be between 1 and " + maximum + " when granularity=" + granularity.apiValue());
		}
	}

	private TemporalSelectionService.DateRange range(int year, TrendGranularity granularity, Integer period) {
		if (granularity == TrendGranularity.YEAR) {
			return new TemporalSelectionService.DateRange(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
		}
		return temporalSelectionService.period(year, granularity.periodGranularity(), period);
	}

	private ActivityAggregate summarize(SpatialSelection selection, Coverage coverage) {
		ActivityAggregate aggregate = activityRepository.summarize(
				selection.cellIds(), coverage.coveredStartDate(), coverage.coveredEndDate());
		if (aggregate.sources().isEmpty()) {
			throw new IllegalStateException("Activity repository returned no source composition");
		}
		return aggregate;
	}

	private static void collectSourceWarnings(
			LinkedHashSet<String> warnings,
			Coverage coverage,
			List<SourceComposition> sources) {
		if (hasSource(sources, 1)) {
			warnings.add("TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY");
		}
		if (hasSource(sources, 2) && !coverage.coveredEndDate().isBefore(AQUA_ORBIT_DRIFT_FROM)) {
			warnings.add("AQUA_FALLBACK_AFTER_ORBIT_DRIFT");
		}
	}

	private static void addAreaWarning(LinkedHashSet<String> warnings, SpatialSelection selection) {
		if (selection.area() != null && "diagnostic_region".equals(selection.area().type().apiValue())) {
			warnings.add("DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY");
		}
	}

	/** Same order as the other activity endpoints, independent of the year in which a warning first appears. */
	private static List<String> ordered(LinkedHashSet<String> warnings) {
		List<String> order = List.of(
				"PARTIAL_PERIOD",
				"TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY",
				"DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY",
				"AQUA_FALLBACK_AFTER_ORBIT_DRIFT");
		return order.stream().filter(warnings::contains).toList();
	}

	private static boolean hasSource(List<SourceComposition> sources, int sourceCode) {
		return sources.stream().anyMatch(source -> source.sourceCode() == sourceCode);
	}
}
