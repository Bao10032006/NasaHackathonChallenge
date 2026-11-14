package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.repository.HarmonizationComparisonRepository;
import com.se201411.mvc.backend.service.MetadataService;
import com.se201411.mvc.backend.service.model.MetadataOverview;
import org.springframework.stereotype.Service;

@Service
public final class MetadataServiceImpl implements MetadataService {

	private final DatasetMetadataRepository metadataRepository;
	private final HarmonizationComparisonRepository comparisonRepository;

	public MetadataServiceImpl(
			DatasetMetadataRepository metadataRepository,
			HarmonizationComparisonRepository comparisonRepository) {
		this.metadataRepository = metadataRepository;
		this.comparisonRepository = comparisonRepository;
	}

	@Override
	public MetadataOverview getMetadata() {
		return new MetadataOverview(
				metadataRepository.getManifest(),
				comparisonRepository.isAvailable());
	}
}
