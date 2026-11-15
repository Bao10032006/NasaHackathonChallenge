package com.se201411.mvc.backend.service;

import com.se201411.mvc.backend.service.model.CellPeriodDetailResult;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;

/** TASK 03B3A: on-demand provenance of one cell for one temporal selector. */
public interface CellPeriodDetailService {

	CellPeriodDetailResult getPeriodDetails(String cellId, TemporalSelectionCriteria temporal);
}
