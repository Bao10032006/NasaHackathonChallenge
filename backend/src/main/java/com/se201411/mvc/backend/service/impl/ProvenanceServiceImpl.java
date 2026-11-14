package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.service.ProvenanceService;
import com.se201411.mvc.backend.service.model.ActivityOrigin;
import com.se201411.mvc.backend.service.model.SourceContribution;
import org.springframework.stereotype.Service;

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

	@Override
	public ActivityOrigin resolveOrigin(List<SourceComposition> sources) {
		if (sources == null || sources.isEmpty()) {
			throw new IllegalArgumentException("source composition must not be empty");
		}
		List<SourceComposition> positiveContributions = sources.stream()
				.filter(source -> source.value() > 0)
				.toList();
		List<SourceComposition> considered = positiveContributions.isEmpty() ? sources : positiveContributions;
		ActivityOrigin resolved = origin(definition(considered.getFirst().sourceCode()).origin());
		for (int index = 1; index < considered.size(); index++) {
			if (origin(definition(considered.get(index).sourceCode()).origin()) != resolved) {
				return ActivityOrigin.MIXED;
			}
		}
		return resolved;
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
