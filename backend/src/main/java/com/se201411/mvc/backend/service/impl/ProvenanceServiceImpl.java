package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.service.ProvenanceService;
import com.se201411.mvc.backend.service.model.ActivityOrigin;
import com.se201411.mvc.backend.service.model.SourceContribution;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public final class ProvenanceServiceImpl implements ProvenanceService {

	private final Map<Integer, DatasetManifest.SourceCodeDefinition> definitions;

	public ProvenanceServiceImpl(DatasetMetadataRepository metadataRepository) {
		Map<Integer, DatasetManifest.SourceCodeDefinition> indexed = new HashMap<>();
		for (DatasetManifest.SourceCodeDefinition definition : metadataRepository.getManifest().sourceCodes()) {
			DatasetManifest.SourceCodeDefinition previous = indexed.put(definition.code(), definition);
			if (previous != null) {
				throw new IllegalStateException("Duplicate source code in dataset manifest: " + definition.code());
			}
		}
		this.definitions = Map.copyOf(indexed);
	}

	/**
	 * Contract v0.3 section 3.5 (kept by Technical Design v0.4 section 6):
	 * <ul>
	 *   <li>only positive contributions decide the origin: one origin wins, several give MIXED;</li>
	 *   <li>when the period total is zero, the origin with the most cell-days wins, so a zero still says
	 *       whether it was observed or estimated. Terra and Aqua both count as MODEL_REDISTRIBUTED.
	 *       A tie has no majority and gives MIXED.</li>
	 * </ul>
	 */
	@Override
	public ActivityOrigin resolveOrigin(List<SourceComposition> sources) {
		if (sources == null || sources.isEmpty()) {
			throw new IllegalArgumentException("source composition must not be empty");
		}
		List<SourceComposition> positiveContributions = sources.stream()
				.filter(source -> source.value() > 0)
				.toList();
		if (!positiveContributions.isEmpty()) {
			ActivityOrigin resolved = originOf(positiveContributions.getFirst());
			for (int index = 1; index < positiveContributions.size(); index++) {
				if (originOf(positiveContributions.get(index)) != resolved) {
					return ActivityOrigin.MIXED;
				}
			}
			return resolved;
		}
		return majorityOriginByCellDays(sources);
	}

	private ActivityOrigin majorityOriginByCellDays(List<SourceComposition> sources) {
		Map<ActivityOrigin, Long> cellDaysByOrigin = new EnumMap<>(ActivityOrigin.class);
		for (SourceComposition source : sources) {
			cellDaysByOrigin.merge(originOf(source), source.cellDays(), Long::sum);
		}
		ActivityOrigin majority = null;
		long majorityCellDays = -1;
		boolean tied = false;
		for (Map.Entry<ActivityOrigin, Long> entry : cellDaysByOrigin.entrySet()) {
			if (entry.getValue() > majorityCellDays) {
				majority = entry.getKey();
				majorityCellDays = entry.getValue();
				tied = false;
			}
			else if (entry.getValue() == majorityCellDays) {
				tied = true;
			}
		}
		return tied ? ActivityOrigin.MIXED : majority;
	}

	private ActivityOrigin originOf(SourceComposition source) {
		return origin(definition(source.sourceCode()).origin());
	}

	@Override
	public List<SourceContribution> describe(List<SourceComposition> sources) {
		if (sources == null || sources.isEmpty()) {
			throw new IllegalArgumentException("source composition must not be empty");
		}
		return sources.stream().map(this::describe).toList();
	}

	@Override
	public SourceContribution describe(SourceComposition source) {
		if (source == null) {
			throw new IllegalArgumentException("source composition must not be null");
		}
		DatasetManifest.SourceCodeDefinition definition = definition(source.sourceCode());
		return new SourceContribution(
				source.sourceCode(),
				definition.source(),
				origin(definition.origin()),
				source.cellCount(),
				source.cellDays(),
				source.value(),
				source.inputObservationCount(),
				source.sourceInputValidCellDays());
	}

	private DatasetManifest.SourceCodeDefinition definition(int sourceCode) {
		DatasetManifest.SourceCodeDefinition definition = definitions.get(sourceCode);
		if (definition == null) {
			throw new IllegalStateException("Dataset manifest has no definition for source code " + sourceCode);
		}
		return definition;
	}

	private static ActivityOrigin origin(String value) {
		try {
			return ActivityOrigin.valueOf(value);
		}
		catch (IllegalArgumentException exception) {
			throw new IllegalStateException("Unsupported source origin in dataset manifest: " + value, exception);
		}
	}
}
