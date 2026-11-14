package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.AreaType;
import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.domain.spatial.Bounds;
import com.se201411.mvc.backend.domain.spatial.SelectionRule;
import com.se201411.mvc.backend.domain.spatial.SelectionType;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.repository.AreaRepository;
import com.se201411.mvc.backend.service.SpatialSelectionService;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public final class SpatialSelectionServiceImpl implements SpatialSelectionService {

	private final AreaRepository areaRepository;

	public SpatialSelectionServiceImpl(AreaRepository areaRepository) {
		this.areaRepository = areaRepository;
	}

	@Override
	public SpatialSelection resolve(SpatialSelectionCriteria criteria) {
		if (criteria == null) {
			throw ApiException.invalidSpatialSelector("Supply areaType and areaId or all four bbox coordinates");
		}
		boolean hasNamedParameter = criteria.areaType() != null || criteria.areaId() != null;
		boolean hasBoundsParameter = criteria.west() != null || criteria.south() != null
				|| criteria.east() != null || criteria.north() != null;

		if (hasNamedParameter && hasBoundsParameter) {
			throw ApiException.invalidSpatialSelector("Named area and bounding box are mutually exclusive");
		}
		if (hasNamedParameter) {
			return resolveNamed(criteria.areaType(), criteria.areaId());
		}
		if (hasBoundsParameter) {
			return resolveBounds(criteria.west(), criteria.south(), criteria.east(), criteria.north());
		}
		throw ApiException.invalidSpatialSelector("Supply areaType and areaId or all four bbox coordinates");
	}

	@Override
	public SpatialSelection resolveOrNational(SpatialSelectionCriteria criteria) {
		if (criteria == null || allParametersAbsent(criteria)) {
			return resolve(SpatialSelectionCriteria.national());
		}
		return resolve(criteria);
	}

	private SpatialSelection resolveNamed(String areaTypeValue, String areaId) {
		if (areaTypeValue == null || areaTypeValue.isBlank() || areaId == null || areaId.isBlank()) {
			throw ApiException.invalidSpatialSelector("Both areaType and areaId are required for a named area");
		}
		AreaType areaType;
		try {
			areaType = AreaType.fromApiValue(areaTypeValue);
		}
		catch (IllegalArgumentException exception) {
			throw ApiException.invalidParameter(
					"areaType must be one of national, diagnostic_region or cell");
		}
		AreaDefinition area = areaRepository.findArea(areaType, areaId)
				.orElseThrow(() -> areaType == AreaType.CELL
						? ApiException.cellNotFound("Unknown cell area: " + areaId)
						: ApiException.areaNotFound("Unknown " + areaTypeValue + " area: " + areaId));
		List<CellArea> cells = area.cellIds().stream()
				.map(cellId -> areaRepository.findCell(cellId).orElseThrow())
				.toList();
		return new SpatialSelection(
				SelectionType.NAMED_AREA,
				SelectionRule.NAMED_AREA_MEMBERSHIP,
				area,
				null,
				envelope(cells),
				cells);
	}

	private SpatialSelection resolveBounds(
			Double west,
			Double south,
			Double east,
			Double north) {
		if (west == null || south == null || east == null || north == null) {
			throw ApiException.invalidSpatialSelector("All four bbox coordinates are required");
		}
		if (!Double.isFinite(west) || !Double.isFinite(east)
				|| !Double.isFinite(south) || !Double.isFinite(north)
				|| west < -180 || east > 180 || south < -90 || north > 90
				|| west >= east || south >= north) {
			throw ApiException.invalidBounds(
					"Bounds must satisfy -180 <= west < east <= 180 and -90 <= south < north <= 90");
		}
		Bounds requested = new Bounds(west, south, east, north);
		List<CellArea> cells = areaRepository.findAllCells().stream()
				.filter(cell -> requested.containsInclusive(cell.centerLat(), cell.centerLon()))
				.toList();
		if (cells.isEmpty()) {
			throw ApiException.noCellsInBounds("The bounding box contains no dataset cell centers");
		}
		return new SpatialSelection(
				SelectionType.BOUNDING_BOX,
				SelectionRule.CENTER_INCLUSIVE,
				null,
				requested,
				envelope(cells),
				cells);
	}

	private static Bounds envelope(List<CellArea> cells) {
		double west = cells.stream().mapToDouble(CellArea::west).min().orElseThrow();
		double south = cells.stream().mapToDouble(CellArea::south).min().orElseThrow();
		double east = cells.stream().mapToDouble(CellArea::east).max().orElseThrow();
		double north = cells.stream().mapToDouble(CellArea::north).max().orElseThrow();
		return new Bounds(west, south, east, north);
	}

	private static boolean allParametersAbsent(SpatialSelectionCriteria criteria) {
		return criteria.areaType() == null && criteria.areaId() == null
				&& criteria.west() == null && criteria.south() == null
				&& criteria.east() == null && criteria.north() == null;
	}
}
