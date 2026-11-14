package com.se201411.mvc.backend.service;

import com.se201411.mvc.backend.domain.activity.SourceComposition;
import com.se201411.mvc.backend.service.model.ActivityOrigin;
import com.se201411.mvc.backend.service.model.SourceContribution;

import java.util.List;

public interface ProvenanceService {

	ActivityOrigin resolveOrigin(List<SourceComposition> sources);

	List<SourceContribution> describe(List<SourceComposition> sources);

	SourceContribution describe(SourceComposition source);
}
