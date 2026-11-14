package com.se201411.mvc.backend.controller;

import com.se201411.mvc.backend.dto.metadata.MetadataResponseDto;
import com.se201411.mvc.backend.mapper.MetadataMapper;
import com.se201411.mvc.backend.service.MetadataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/metadata")
public final class MetadataController {

	private final MetadataService metadataService;
	private final MetadataMapper metadataMapper;

	public MetadataController(MetadataService metadataService, MetadataMapper metadataMapper) {
		this.metadataService = metadataService;
		this.metadataMapper = metadataMapper;
	}

	@GetMapping
	public MetadataResponseDto getMetadata() {
		return metadataMapper.toDto(metadataService.getMetadata());
	}
}
