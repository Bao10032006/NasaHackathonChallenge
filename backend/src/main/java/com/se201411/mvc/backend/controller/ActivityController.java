package com.se201411.mvc.backend.controller;

import com.se201411.mvc.backend.dto.activity.CalendarResponseDto;
import com.se201411.mvc.backend.dto.activity.DailyCalendarResponseDto;
import com.se201411.mvc.backend.dto.activity.DailyResponseDto;
import com.se201411.mvc.backend.dto.activity.MapCellsResponseDto;
import com.se201411.mvc.backend.mapper.ActivityMapper;
import com.se201411.mvc.backend.service.ActivityService;
import com.se201411.mvc.backend.service.model.SpatialSelectionCriteria;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1")
public final class ActivityController {

	private final ActivityService activityService;
	private final ActivityMapper activityMapper;

	public ActivityController(ActivityService activityService, ActivityMapper activityMapper) {
		this.activityService = activityService;
		this.activityMapper = activityMapper;
	}

	@GetMapping("/map/cells")
	public MapCellsResponseDto getMapCells(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@RequestParam(required = false) Integer year,
			@RequestParam(required = false) Integer month,
			@RequestParam(required = false) Integer pentad,
			@RequestParam(required = false) String areaType,
			@RequestParam(required = false) String areaId,
			@RequestParam(required = false) Double west,
			@RequestParam(required = false) Double south,
			@RequestParam(required = false) Double east,
			@RequestParam(required = false) Double north) {
		return activityMapper.toDto(activityService.getMap(
				spatial(areaType, areaId, west, south, east, north),
				new TemporalSelectionCriteria(date, year, month, pentad)));
	}

	@GetMapping("/calendar")
	public CalendarResponseDto getCalendar(
			@RequestParam int year,
			@RequestParam String granularity,
			@RequestParam(defaultValue = "false") boolean includeBaseline,
			@RequestParam(required = false) Integer baselineStartYear,
			@RequestParam(required = false) Integer baselineEndYear,
			@RequestParam(required = false) String areaType,
			@RequestParam(required = false) String areaId,
			@RequestParam(required = false) Double west,
			@RequestParam(required = false) Double south,
			@RequestParam(required = false) Double east,
			@RequestParam(required = false) Double north) {
		return activityMapper.toDto(activityService.getCalendar(
				spatial(areaType, areaId, west, south, east, north), year, granularity,
				includeBaseline, baselineStartYear, baselineEndYear));
	}

	@GetMapping("/calendar/days")
	public DailyCalendarResponseDto getCalendarDays(
			@RequestParam int year,
			@RequestParam int month,
			@RequestParam(required = false) String areaType,
			@RequestParam(required = false) String areaId,
			@RequestParam(required = false) Double west,
			@RequestParam(required = false) Double south,
			@RequestParam(required = false) Double east,
			@RequestParam(required = false) Double north) {
		return activityMapper.toDto(activityService.getDailyCalendar(
				spatial(areaType, areaId, west, south, east, north), year, month));
	}

	@GetMapping("/daily")
	public DailyResponseDto getDaily(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@RequestParam(defaultValue = "false") boolean includeCells,
			@RequestParam(required = false) String areaType,
			@RequestParam(required = false) String areaId,
			@RequestParam(required = false) Double west,
			@RequestParam(required = false) Double south,
			@RequestParam(required = false) Double east,
			@RequestParam(required = false) Double north) {
		return activityMapper.toDto(activityService.getDaily(
				spatial(areaType, areaId, west, south, east, north), date, includeCells));
	}

	private static SpatialSelectionCriteria spatial(
			String areaType,
			String areaId,
			Double west,
			Double south,
			Double east,
			Double north) {
		return new SpatialSelectionCriteria(areaType, areaId, west, south, east, north);
	}
}
