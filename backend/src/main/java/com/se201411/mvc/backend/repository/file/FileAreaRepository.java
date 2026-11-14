package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.AreaType;
import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;
import com.se201411.mvc.backend.repository.AreaRepository;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * File-backed area index built from the manifest's cell order source ({@code tables/cells_025.csv}).
 * The source file is re-verified against the manifest hash before it is read.
 */
public final class FileAreaRepository implements AreaRepository {

	private static final List<String> REQUIRED_COLUMNS =
			List.of("cell", "cy", "cx", "lat", "lon", "lat_s", "lon_w", "region");

	private final List<CellArea> cells;
	private final Map<String, CellArea> cellsById;
	private final AreaDefinition national;
	private final Map<String, AreaDefinition> regions;

	private FileAreaRepository(List<CellArea> cells) {
		Map<String, CellArea> byId = new LinkedHashMap<>();
		Map<String, List<String>> regionCells = new LinkedHashMap<>();
		List<String> allIds = new ArrayList<>(cells.size());
		for (CellArea cell : cells) {
			byId.put(cell.cellId(), cell);
			allIds.add(cell.cellId());
			regionCells.computeIfAbsent(cell.diagnosticRegion(), key -> new ArrayList<>()).add(cell.cellId());
		}
		Map<String, AreaDefinition> regionAreas = new LinkedHashMap<>();
		regionCells.forEach((region, ids) ->
				regionAreas.put(region, new AreaDefinition(AreaType.DIAGNOSTIC_REGION, region, ids)));

		this.cells = List.copyOf(cells);
		this.cellsById = byId;
		this.national = new AreaDefinition(AreaType.NATIONAL, AreaDefinition.NATIONAL_ID, allIds);
		this.regions = regionAreas;
	}

	public static FileAreaRepository open(Path datasetRoot, DatasetManifest manifest) {
		Objects.requireNonNull(datasetRoot, "datasetRoot must not be null");
		Objects.requireNonNull(manifest, "manifest must not be null");
		String cellSource = manifest.grid().cellOrderSource();
		Path cellsPath = DatasetArtifactValidator.resolveDeclaredSource(datasetRoot, manifest, cellSource)
				.orElseThrow(() -> new DatasetUnavailableException(
						"Cell order source is not declared in manifest sources: " + cellSource));

		SimpleCsvTable table = SimpleCsvTable.read(cellsPath, cellSource, REQUIRED_COLUMNS);
		double degrees = manifest.grid().degrees();
		if (!(degrees > 0)) {
			throw new DatasetUnavailableException("Manifest grid.degrees must be positive");
		}
		List<CellArea> cells = new ArrayList<>(table.rows().size());
		for (String[] row : table.rows()) {
			double south = table.decimal(row, "lat_s");
			double west = table.decimal(row, "lon_w");
			cells.add(new CellArea(
					table.text(row, "cell"),
					table.integer(row, "cy"),
					table.integer(row, "cx"),
					table.decimal(row, "lat"),
					table.decimal(row, "lon"),
					south,
					west,
					south + degrees,
					west + degrees,
					table.text(row, "region")));
		}
		List<String> ids = cells.stream().map(CellArea::cellId).toList();
		if (!ids.equals(manifest.grid().cellIds())) {
			throw new DatasetUnavailableException("Cell source order does not match manifest grid.cellIds");
		}
		return new FileAreaRepository(cells);
	}

	@Override
	public List<CellArea> findAllCells() {
		return cells;
	}

	@Override
	public Optional<CellArea> findCell(String cellId) {
		return Optional.ofNullable(cellId == null ? null : cellsById.get(cellId));
	}

	@Override
	public List<String> findDiagnosticRegionIds() {
		return List.copyOf(regions.keySet());
	}

	@Override
	public Optional<AreaDefinition> findArea(AreaType type, String areaId) {
		if (type == null || areaId == null) {
			return Optional.empty();
		}
		return switch (type) {
			case NATIONAL -> AreaDefinition.NATIONAL_ID.equals(areaId) ? Optional.of(national) : Optional.empty();
			case DIAGNOSTIC_REGION -> Optional.ofNullable(regions.get(areaId));
			case CELL -> cellsById.containsKey(areaId)
					? Optional.of(new AreaDefinition(AreaType.CELL, areaId, List.of(areaId)))
					: Optional.empty();
		};
	}

	List<AreaDefinition> precomputedAreas() {
		List<AreaDefinition> areas = new ArrayList<>(regions.size() + 1);
		areas.add(national);
		areas.addAll(regions.values());
		return areas;
	}
}
