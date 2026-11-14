package com.se201411.mvc.backend.mapper;

import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.CellArea;
import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.dto.area.AreaDto;
import com.se201411.mvc.backend.dto.area.AreaListResponseDto;
import com.se201411.mvc.backend.dto.common.BoundsDto;
import com.se201411.mvc.backend.dto.common.CoordinatesDto;
import com.se201411.mvc.backend.service.model.AreaCatalogEntry;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public final class AreaMapper {

	private final ResponseMetaMapper responseMetaMapper;

	public AreaMapper(ResponseMetaMapper responseMetaMapper) {
		this.responseMetaMapper = responseMetaMapper;
	}

	public AreaListResponseDto toDto(List<AreaCatalogEntry> entries, DatasetManifest manifest) {
		return new AreaListResponseDto(
				entries.stream().map(AreaMapper::toDto).toList(),
				responseMetaMapper.toDto(manifest));
	}

	private static AreaDto toDto(AreaCatalogEntry entry) {
		if (entry.area() != null) {
			AreaDefinition area = entry.area();
			return new AreaDto(
					area.type().apiValue(),
					area.id(),
					entry.displayName(),
					null,
					area.cellIds().size(),
					null,
					null);
		}
		CellArea cell = entry.cell();
		return new AreaDto(
				"cell",
				cell.cellId(),
				null,
				cell.diagnosticRegion(),
				null,
				new CoordinatesDto(cell.centerLat(), cell.centerLon()),
				new BoundsDto(cell.west(), cell.south(), cell.east(), cell.north()));
	}
}
