package com.se201411.mvc.backend.controller;

import com.se201411.mvc.backend.dto.analysis.SeasonalityResponseDto;
import com.se201411.mvc.backend.dto.analysis.TrendsResponseDto;
import com.se201411.mvc.backend.mapper.HistoricalAnalysisMapper;
import com.se201411.mvc.backend.service.HistoricalAnalysisService;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** TASK 03B3B: {@code GET /trends} and {@code GET /seasonality} (OpenAPI v0.4). */
@RestController
@RequestMapping("/api/v1")
public final class HistoricalAnalysisController {

	private final HistoricalAnalysisService historicalAnalysisService;
	private final HistoricalAnalysisMapper historicalAnalysisMapper;

	public HistoricalAnalysisController(
			HistoricalAnalysisService historicalAnalysisService,
			HistoricalAnalysisMapper historicalAnalysisMapper) {
		this.historicalAnalysisService = historicalAnalysisService;
		this.historicalAnalysisMapper = historicalAnalysisMapper;
	}

	@GetMapping("/trends")
	public TrendsResponseDto getTrends(
			@RequestParam int startYear,
			@RequestParam int endYear,
			@RequestParam String granularity,
			@RequestParam(required = false) Integer period,
			@RequestParam(required = false) String areaType,
			@RequestParam(required = false) String areaId,
			@RequestParam(required = false) Double west,
			@RequestParam(required = false) Double south,
			@RequestParam(required = false) Double east,
			@RequestParam(required = false) Double north) {
		return historicalAnalysisMapper.toDto(historicalAnalysisService.getTrends(
				new SpatialSelectionCriteria(areaType, areaId, west, south, east, north),
				startYear, endYear, granularity, period));
	}

	@GetMapping("/seasonality")
	public SeasonalityResponseDto getSeasonality(
			@RequestParam String granularity,
			@RequestParam(required = false) Integer startYear,
			@RequestParam(required = false) Integer endYear,
			@RequestParam(required = false) String areaType,
			@RequestParam(required = false) String areaId,
			@RequestParam(required = false) Double west,
			@RequestParam(required = false) Double south,
			@RequestParam(required = false) Double east,
			@RequestParam(required = false) Double north) {
		return historicalAnalysisMapper.toDto(historicalAnalysisService.getSeasonality(
				new SpatialSelectionCriteria(areaType, areaId, west, south, east, north),
				granularity, startYear, endYear));
	}
}
