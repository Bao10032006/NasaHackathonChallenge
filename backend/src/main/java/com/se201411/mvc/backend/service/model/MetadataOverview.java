package com.se201411.mvc.backend.service.model;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;

public record MetadataOverview(
		DatasetManifest manifest,
		boolean harmonizationComparisonAvailable) {

	public MetadataOverview {
		if (manifest == null) {
			throw new IllegalArgumentException("manifest must not be null");
		}
	}
}
