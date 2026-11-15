package com.se201411.mvc.backend.controller;

import com.se201411.mvc.backend.dto.cell.CellPeriodDetailsResponseDto;
import com.se201411.mvc.backend.mapper.CellPeriodDetailMapper;
import com.se201411.mvc.backend.service.CellPeriodDetailService;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** TASK 03B3A: {@code GET /cells/{cellId}/period-details} (OpenAPI v0.4). */
@RestController
@RequestMapping("/api/v1/cells")
public final class CellController {

	private final CellPeriodDetailService cellPeriodDetailService;
	private final CellPeriodDetailMapper cellPeriodDetailMapper;

	public CellController(CellPeriodDetailService cellPeriodDetailService, CellPeriodDetailMapper cellPeriodDetailMapper) {
		this.cellPeriodDetailService = cellPeriodDetailService;
		this.cellPeriodDetailMapper = cellPeriodDetailMapper;
	}

	@GetMapping("/{cellId}/period-details")
	public CellPeriodDetailsResponseDto getPeriodDetails(
			@PathVariable String cellId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@RequestParam(required = false) Integer year,
			@RequestParam(required = false) Integer month,
			@RequestParam(required = false) Integer pentad) {
		return cellPeriodDetailMapper.toDto(cellPeriodDetailService.getPeriodDetails(
				cellId, new TemporalSelectionCriteria(date, year, month, pentad)));
	}
}
