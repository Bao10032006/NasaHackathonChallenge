package com.se201411.mvc.backend.dto.area;

import com.se201411.mvc.backend.dto.common.ResponseMetaDto;

import java.util.List;

public record AreaListResponseDto(List<AreaDto> items, ResponseMetaDto meta) {

	public AreaListResponseDto {
		items = items == null ? List.of() : List.copyOf(items);
	}
}
