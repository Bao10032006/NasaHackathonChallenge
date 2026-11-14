package com.se201411.mvc.backend.controller;

import com.se201411.mvc.backend.dto.area.AreaListResponseDto;
import com.se201411.mvc.backend.mapper.AreaMapper;
import com.se201411.mvc.backend.service.AreaService;
import com.se201411.mvc.backend.service.MetadataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/areas")
public final class AreaController {

	private final AreaService areaService;
	private final MetadataService metadataService;
	private final AreaMapper areaMapper;

	public AreaController(
			AreaService areaService,
			MetadataService metadataService,
			AreaMapper areaMapper) {
		this.areaService = areaService;
		this.metadataService = metadataService;
		this.areaMapper = areaMapper;
	}

	@GetMapping
	public AreaListResponseDto listAreas(
			@RequestParam(name = "type", required = false) String areaType) {
		return areaMapper.toDto(
				areaService.listAreas(areaType),
				metadataService.getMetadata().manifest());
	}
}
