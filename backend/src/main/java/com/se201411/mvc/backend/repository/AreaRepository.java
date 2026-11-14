package com.se201411.mvc.backend.repository;

import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.AreaType;
import com.se201411.mvc.backend.domain.area.CellArea;

import java.util.List;
import java.util.Optional;

public interface AreaRepository {

	/** All cells in dataset order. */
	List<CellArea> findAllCells();

	Optional<CellArea> findCell(String cellId);

	/** Diagnostic region ids in order of first appearance in the cell source. */
	List<String> findDiagnosticRegionIds();

	/**
	 * Resolves {@code ToanQuoc}, a diagnostic region id or a cell id to its member cells.
	 * Returns empty when the id is not supported for the given type.
	 */
	Optional<AreaDefinition> findArea(AreaType type, String areaId);
}
