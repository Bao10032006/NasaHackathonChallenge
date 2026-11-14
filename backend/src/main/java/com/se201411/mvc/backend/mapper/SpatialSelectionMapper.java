package com.se201411.mvc.backend.mapper;

import com.se201411.mvc.backend.domain.spatial.Bounds;
import com.se201411.mvc.backend.domain.spatial.SpatialSelection;
import com.se201411.mvc.backend.dto.common.BoundsDto;
import com.se201411.mvc.backend.dto.common.SpatialSelectionDto;
import org.springframework.stereotype.Component;

@Component
public final class SpatialSelectionMapper {

	public SpatialSelectionDto toDto(SpatialSelection selection) {
		SpatialSelectionDto.AreaRefDto area = selection.area() == null
				? null
				: new SpatialSelectionDto.AreaRefDto(
						selection.area().type().apiValue(), selection.area().id());
		return new SpatialSelectionDto(
				selection.type().name(),
				selection.selectionRule().name(),
				area,
				toDto(selection.requestedBounds()),
				toDto(selection.selectedBounds()),
				selection.cells().size(),
				selection.cellIds());
	}

	private static BoundsDto toDto(Bounds bounds) {
		return bounds == null ? null : new BoundsDto(
				bounds.west(), bounds.south(), bounds.east(), bounds.north());
	}
}
