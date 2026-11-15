package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.service.MetadataService;
import com.se201411.mvc.backend.service.model.MetadataOverview;
import org.springframework.stereotype.Service;

@Service
public final class MetadataServiceImpl implements MetadataService {

	/**
	 * Capabilities describe what the API can serve, not only what the dataset contains.
	 * The comparison table is loaded by {@code HarmonizationComparisonRepository}, but the optional
	 * {@code GET /harmonization/comparison} endpoint is not implemented (outside TASK 03B3), so
	 * advertising it would make clients offer a feature that answers 404. Switch this to the
	 * repository availability in the same change that adds the endpoint.
	 */
	static final boolean HARMONIZATION_COMPARISON_ENDPOINT_IMPLEMENTED = false;

	private final DatasetMetadataRepository metadataRepository;

	public MetadataServiceImpl(DatasetMetadataRepository metadataRepository) {
		this.metadataRepository = metadataRepository;
	}

	@Override
	public MetadataOverview getMetadata() {
		return new MetadataOverview(
				metadataRepository.getManifest(),
				HARMONIZATION_COMPARISON_ENDPOINT_IMPLEMENTED);
	}
}
