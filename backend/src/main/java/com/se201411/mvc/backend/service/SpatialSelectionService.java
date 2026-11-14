package com.se201411.mvc.backend.service;

import com.se201411.mvc.backend.domain.spatial.SpatialSelection;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;

public interface SpatialSelectionService {

	SpatialSelection resolve(SpatialSelectionCriteria criteria);

	SpatialSelection resolveOrNational(SpatialSelectionCriteria criteria);
}
