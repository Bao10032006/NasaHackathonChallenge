package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.activity.ActivityAggregate;
import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.repository.ActivityQueryRepository;
import com.se201411.mvc.backend.repository.AreaRepository;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.service.CellPeriodDetailService;
import com.se201411.mvc.backend.service.ProvenanceService;
import com.se201411.mvc.backend.service.TemporalSelectionService;
import com.se201411.mvc.backend.service.model.CellPeriodDetailResult;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.TemporalSelection;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;
import com.se201411.mvc.backend.service.model.TemporalSelectionType;
import com.se201411.mvc.backend.service.model.ValueStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;

/**
 * TASK 03B3A: {@code GET /cells/{cellId}/period-details}.
 * Uses the same temporal rules as {@code /map/cells} (exactly one of date, year, year+month, year+pentad)
 * and the same repository path, so the cell value equals the matching cell of the map response.
 */
@Service
public final class CellPeriodDetailServiceImpl implements CellPeriodDetailService {

	/** OpenAPI v0.4 path pattern for cell IDs. */
	private static final Pattern CELL_ID = Pattern.compile("^[0-9]+_[0-9]+$");
	private static final LocalDate AQUA_ORBIT_DRIFT_FROM = LocalDate.of(2022, 1, 1);

	private final AreaRepository areaRepository;
	private final TemporalSelectionService temporalSelectionService;
	private final ActivityQueryRepository activityRepository;
	private final ProvenanceService provenanceService;
	private final DatasetManifest manifest;

	public CellPeriodDetailServiceImpl(
			AreaRepository areaRepository,
			TemporalSelectionService temporalSelectionService,
			ActivityQueryRepository activityRepository,
			ProvenanceService provenanceService,
			DatasetMetadataRepository metadataRepository) {
		this.areaRepository = areaRepository;
		this.temporalSelectionService = temporalSelectionService;
		this.activityRepository = activityRepository;
		this.provenanceService = provenanceService;
		this.manifest = metadataRepository.getManifest();
	}

	@Override
	public CellPeriodDetailResult getPeriodDetails(String cellId, TemporalSelectionCriteria temporal) {
		if (cellId == null || !CELL_ID.matcher(cellId).matches()) {
			throw ApiException.invalidParameter("cellId must match <row>_<column>, for example 48_428");
		}
		CellArea cell = areaRepository.findCell(cellId)
				.orElseThrow(() -> ApiException.cellNotFound("Cell " + cellId + " is not in the active snapshot"));
		TemporalSelection selection = temporalSelectionService.resolveMap(temporal);
		Coverage coverage = selection.coverage();

		if (!coverage.hasCoverage()) {
			return new CellPeriodDetailResult(
					cell, selection, null, ValueStatus.OUTSIDE_DATASET_RANGE, null, List.of(), manifest, List.of());
		}

		ActivityAggregate aggregate = activityRepository.summarize(
				List.of(cell.cellId()), coverage.coveredStartDate(), coverage.coveredEndDate());
		if (aggregate.sources().isEmpty()) {
			throw new IllegalStateException("Activity repository returned no source composition for cell " + cellId);
		}
		return new CellPeriodDetailResult(
				cell,
				selection,
				aggregate.value(),
				ValueStatus.AVAILABLE,
				provenanceService.resolveOrigin(aggregate.sources()),
				provenanceService.describe(aggregate.sources()),
				manifest,
				warnings(selection, aggregate.sources()));
	}

	/** Same warning semantics as the matching cell of {@code /map/cells}. */
	private List<String> warnings(TemporalSelection selection, List<SourceComposition> sources) {
		Coverage coverage = selection.coverage();
		boolean exactDate = selection.type() == TemporalSelectionType.DATE;
		LinkedHashSet<String> warnings = new LinkedHashSet<>();
		if (coverage.partial()) {
			warnings.add("PARTIAL_PERIOD");
		}
		if (exactDate && selection.date().equals(temporalSelectionService.datasetEndDate())) {
			warnings.add("DATASET_EDGE_DATE");
		}
		if (hasSource(sources, 1)) {
			warnings.add("TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY");
		}
		if (exactDate && (hasSource(sources, 1) || hasSource(sources, 2))) {
			warnings.add("MODEL_REDISTRIBUTED_DAILY_VALUE");
		}
		if (exactDate) {
			warnings.add("NO_DAILY_UNCERTAINTY_INTERVAL");
		}
		if (hasSource(sources, 2) && !coverage.coveredEndDate().isBefore(AQUA_ORBIT_DRIFT_FROM)) {
			warnings.add("AQUA_FALLBACK_AFTER_ORBIT_DRIFT");
		}
		return List.copyOf(warnings);
	}

	private static boolean hasSource(List<SourceComposition> sources, int sourceCode) {
		return sources.stream().anyMatch(source -> source.sourceCode() == sourceCode);
	}
}
