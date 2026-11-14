package com.se201411.mvc.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "hoalich.dataset.root=src/test/resources/fixtures/daily-mini")
@AutoConfigureMockMvc
class ActivityControllerIntegrationTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void returnsExactDateMapWithContractEnvelopeAndStableCellOrder() throws Exception {
		mockMvc.perform(get("/api/v1/map/cells")
				.queryParam("date", "2026-11-11")
				.queryParam("areaType", "national")
				.queryParam("areaId", "ToanQuoc"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.selection.cellCount").value(4))
				.andExpect(jsonPath("$.temporalSelector.type").value("DATE"))
				.andExpect(jsonPath("$.temporalSelector.coverage.partial").value(false))
				.andExpect(jsonPath("$.summary.totalValue").value(257.5))
				.andExpect(jsonPath("$.summary.origin").value("SCALED_OBSERVATION"))
				.andExpect(jsonPath("$.cells.length()").value(4))
				.andExpect(jsonPath("$.cells[0].cellId").value("34_419"))
				.andExpect(jsonPath("$.cells[0].value").value(0.0))
				.andExpect(jsonPath("$.cells[0].sourceCode").value(4))
				.andExpect(jsonPath("$.meta.warnings[0]").value("NO_DAILY_UNCERTAINTY_INTERVAL"));
	}

	@Test
	void returnsAllCivilDaysAndExplicitOutsideRangePlaceholders() throws Exception {
		mockMvc.perform(get("/api/v1/calendar/days")
				.queryParam("year", "2026")
				.queryParam("month", "11")
				.queryParam("areaType", "national")
				.queryParam("areaId", "ToanQuoc"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.values.length()").value(30))
				.andExpect(jsonPath("$.values[0].date").value("2026-11-01"))
				.andExpect(jsonPath("$.values[0].value").value(org.hamcrest.Matchers.nullValue()))
				.andExpect(jsonPath("$.values[0].valueStatus").value("OUTSIDE_DATASET_RANGE"))
				.andExpect(jsonPath("$.values[9].value").value(157.0))
				.andExpect(jsonPath("$.summary.totalValue").value(428.5))
				.andExpect(jsonPath("$.summary.coverage.coveredDayCount").value(4))
				.andExpect(jsonPath("$.summary.coverage.partial").value(true))
				.andExpect(jsonPath("$.summary.peakDate.date").value("2026-11-11"))
				.andExpect(jsonPath("$.summary.peakDate.value").value(257.5));
	}

	@Test
	void returnsDailyProvenanceAndOptionalCells() throws Exception {
		mockMvc.perform(get("/api/v1/daily")
				.queryParam("date", "2026-11-12")
				.queryParam("includeCells", "true")
				.queryParam("areaType", "national")
				.queryParam("areaId", "ToanQuoc"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.value").value(5.0))
				.andExpect(jsonPath("$.origin").value("MIXED"))
				.andExpect(jsonPath("$.sourceComposition.length()").value(2))
				.andExpect(jsonPath("$.sourceComposition[0].cellCount").value(2))
				.andExpect(jsonPath("$.cells.length()").value(4));
	}

	@Test
	void keepsRequiredNullFieldsForMapPeriodOutsideDatasetRange() throws Exception {
		mockMvc.perform(get("/api/v1/map/cells")
				.queryParam("year", "2026")
				.queryParam("month", "10")
				.queryParam("areaType", "national")
				.queryParam("areaId", "ToanQuoc"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.summary.totalValue").value(org.hamcrest.Matchers.nullValue()))
				.andExpect(jsonPath("$.summary.origin").value(org.hamcrest.Matchers.nullValue()))
				.andExpect(jsonPath("$.summary.valueStatus").value("OUTSIDE_DATASET_RANGE"))
				.andExpect(jsonPath("$.cells[0].value").value(org.hamcrest.Matchers.nullValue()))
				.andExpect(jsonPath("$.cells[0].origin").value(org.hamcrest.Matchers.nullValue()))
				.andExpect(jsonPath("$.cells[0].valueStatus").value("OUTSIDE_DATASET_RANGE"));
	}

	@Test
	void preservesMapNationalDefaultButRequiresSpatialSelectorElsewhere() throws Exception {
		mockMvc.perform(get("/api/v1/map/cells").queryParam("date", "2026-11-10"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.selection.area.id").value("ToanQuoc"));

		mockMvc.perform(get("/api/v1/calendar")
				.queryParam("year", "2026")
				.queryParam("granularity", "month"))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.code").value("INVALID_SPATIAL_SELECTOR"));
	}

	@Test
	void rejectsInvalidSelectorsWithContractProblemCodes() throws Exception {
		mockMvc.perform(get("/api/v1/map/cells")
				.queryParam("date", "2026-11-10")
				.queryParam("year", "2026"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_TEMPORAL_SELECTOR"));

		mockMvc.perform(get("/api/v1/daily")
				.queryParam("date", "2026-11-09")
				.queryParam("areaType", "national")
				.queryParam("areaId", "ToanQuoc"))
				.andExpect(status().isUnprocessableContent())
				.andExpect(jsonPath("$.code").value("DATE_OUTSIDE_DATASET_RANGE"));
	}
}
