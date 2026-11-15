package com.se201411.mvc.backend.controller;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * TASK 03B3A against the committed v1.0 snapshot. Golden values were computed independently from
 * {@code derived/} (numpy over daily-values.f32, daily-source.u8, daily-input-count.i16 and
 * daily-source-input-valid.u8) on 15/11/2026 for cell 51_431 (the most active cell of bbox
 * 107,12,108,13 in March 2024): March 2024 = 78.0 from 31 S-NPP cell-days and 78 input detections;
 * 18/03/2024 = 12.0; year 2024 = 499.989531 (S-NPP 345 cell-days 499.0 + NOAA-20 21 cell-days 0.989531);
 * pentad 15 of 2024 = 4.0; 1-13/11/2026 = 0.014271 from Aqua, S-NPP and NOAA-20.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CellControllerIntegrationTests {

	private static final double TOLERANCE = 1e-4;
	private static final String CELL = "51_431";

	@Autowired
	private MockMvc mockMvc;

	private static MockHttpServletRequestBuilder details(String cellId) {
		return get("/api/v1/cells/" + cellId + "/period-details");
	}

	@Test
	void monthDetailsCarryCellMetadataValueOriginAndComposition() throws Exception {
		mockMvc.perform(details(CELL).queryParam("year", "2024").queryParam("month", "3"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.cell.type").value("cell"))
				.andExpect(jsonPath("$.cell.id").value(CELL))
				.andExpect(jsonPath("$.cell.diagnosticRegion").value("TayNguyen"))
				.andExpect(jsonPath("$.cell.center.lat").value(12.875))
				.andExpect(jsonPath("$.cell.center.lon").value(107.875))
				.andExpect(jsonPath("$.cell.bounds.west").value(107.75))
				.andExpect(jsonPath("$.cell.bounds.north").value(13.0))
				.andExpect(jsonPath("$.temporalSelector.type").value("MONTH"))
				.andExpect(jsonPath("$.temporalSelector.year").value(2024))
				.andExpect(jsonPath("$.temporalSelector.month").value(3))
				.andExpect(jsonPath("$.temporalSelector.coverage.partial").value(false))
				.andExpect(jsonPath("$.value").value(closeTo(78.0, TOLERANCE)))
				.andExpect(jsonPath("$.valueStatus").value("AVAILABLE"))
				.andExpect(jsonPath("$.origin").value("DIRECT_OBSERVATION"))
				.andExpect(jsonPath("$.sourceComposition.length()").value(1))
				.andExpect(jsonPath("$.sourceComposition[0].sourceCode").value(3))
				.andExpect(jsonPath("$.sourceComposition[0].source").value("SNPP"))
				.andExpect(jsonPath("$.sourceComposition[0].origin").value("DIRECT_OBSERVATION"))
				.andExpect(jsonPath("$.sourceComposition[0].cellCount").value(1))
				.andExpect(jsonPath("$.sourceComposition[0].contributingCellDayCount").value(31))
				.andExpect(jsonPath("$.sourceComposition[0].harmonizedValue").value(closeTo(78.0, TOLERANCE)))
				.andExpect(jsonPath("$.sourceComposition[0].inputObservationCount").value(78))
				.andExpect(jsonPath("$.sourceComposition[0].sourceInputValidCellCount").value(31))
				.andExpect(jsonPath("$.meta.dataVersion").value("hoalich-data-v1-2026-11-13"));
	}

	@Test
	void exactDateDetailsUseTheDateSelectorAndDailyWarnings() throws Exception {
		mockMvc.perform(details(CELL).queryParam("date", "2024-03-18"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.temporalSelector.type").value("DATE"))
				.andExpect(jsonPath("$.temporalSelector.date").value("2024-03-18"))
				.andExpect(jsonPath("$.value").value(closeTo(12.0, TOLERANCE)))
				.andExpect(jsonPath("$.sourceComposition[0].contributingCellDayCount").value(1))
				.andExpect(jsonPath("$.meta.warnings").value(hasItem("NO_DAILY_UNCERTAINTY_INTERVAL")));
	}

	@Test
	void yearDetailsWithTwoPositiveOriginsAreMixedAndSourcesSumToTheValue() throws Exception {
		String body = mockMvc.perform(details(CELL).queryParam("year", "2024"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.temporalSelector.type").value("YEAR"))
				.andExpect(jsonPath("$.value").value(closeTo(499.989531, TOLERANCE)))
				.andExpect(jsonPath("$.origin").value("MIXED"))
				.andExpect(jsonPath("$.sourceComposition.length()").value(2))
				.andExpect(jsonPath("$.sourceComposition[0].sourceCode").value(3))
				.andExpect(jsonPath("$.sourceComposition[0].contributingCellDayCount").value(345))
				.andExpect(jsonPath("$.sourceComposition[1].sourceCode").value(4))
				.andExpect(jsonPath("$.sourceComposition[1].origin").value("SCALED_OBSERVATION"))
				.andExpect(jsonPath("$.sourceComposition[1].contributingCellDayCount").value(21))
				.andExpect(jsonPath("$.sourceComposition[1].harmonizedValue").value(closeTo(0.989531, TOLERANCE)))
				.andReturn().getResponse().getContentAsString();
		double value = ((Number) JsonPath.read(body, "$.value")).doubleValue();
		List<Number> parts = JsonPath.read(body, "$.sourceComposition[*].harmonizedValue");
		assertThat(parts.stream().mapToDouble(Number::doubleValue).sum()).isCloseTo(value, within(1e-6));
	}

	@Test
	void pentadDetailsUseThePentadRange() throws Exception {
		mockMvc.perform(details(CELL).queryParam("year", "2024").queryParam("pentad", "15"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.temporalSelector.type").value("PENTAD"))
				.andExpect(jsonPath("$.temporalSelector.startDate").value("2024-03-11"))
				.andExpect(jsonPath("$.temporalSelector.endDate").value("2024-03-15"))
				.andExpect(jsonPath("$.value").value(closeTo(4.0, TOLERANCE)));
	}

	@Test
	void partialPeriodAggregatesOnlyCoveredDays() throws Exception {
		mockMvc.perform(details(CELL).queryParam("year", "2026").queryParam("month", "11"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.valueStatus").value("AVAILABLE"))
				.andExpect(jsonPath("$.value").value(closeTo(0.014271, TOLERANCE)))
				.andExpect(jsonPath("$.origin").value("MODEL_REDISTRIBUTED"))
				.andExpect(jsonPath("$.temporalSelector.coverage.partial").value(true))
				.andExpect(jsonPath("$.temporalSelector.coverage.coveredDayCount").value(13))
				.andExpect(jsonPath("$.temporalSelector.coverage.coveredEndDate").value("2026-11-13"))
				.andExpect(jsonPath("$.sourceComposition.length()").value(3))
				.andExpect(jsonPath("$.meta.warnings").value(hasItem("PARTIAL_PERIOD")))
				.andExpect(jsonPath("$.meta.warnings").value(hasItem("AQUA_FALLBACK_AFTER_ORBIT_DRIFT")));
	}

	@Test
	void periodWithoutCoverageIsNullOutsideRangeWithEmptyComposition() throws Exception {
		mockMvc.perform(details(CELL).queryParam("year", "2026").queryParam("month", "12"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.value").value(nullValue()))
				.andExpect(jsonPath("$.valueStatus").value("OUTSIDE_DATASET_RANGE"))
				.andExpect(jsonPath("$.origin").value(nullValue()))
				.andExpect(jsonPath("$.sourceComposition.length()").value(0))
				.andExpect(jsonPath("$.temporalSelector.coverage.coveredDayCount").value(0))
				.andExpect(jsonPath("$.temporalSelector.coverage.coveredStartDate").value(nullValue()));
	}

	@Test
	void validZeroIsAvailableWithMajorityOriginAndBothSources() throws Exception {
		mockMvc.perform(details("40_422").queryParam("year", "2012").queryParam("month", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.value").value(0.0))
				.andExpect(jsonPath("$.valueStatus").value("AVAILABLE"))
				.andExpect(jsonPath("$.origin").value("MODEL_REDISTRIBUTED"))
				.andExpect(jsonPath("$.sourceComposition.length()").value(2))
				.andExpect(jsonPath("$.sourceComposition[0].sourceCode").value(2))
				.andExpect(jsonPath("$.sourceComposition[0].contributingCellDayCount").value(19))
				.andExpect(jsonPath("$.sourceComposition[1].sourceCode").value(3))
				.andExpect(jsonPath("$.sourceComposition[1].contributingCellDayCount").value(12));
	}

	@Test
	void cellValueMatchesTheSameCellOfTheMapResponse() throws Exception {
		String map = mockMvc.perform(get("/api/v1/map/cells")
				.queryParam("west", "107").queryParam("south", "12")
				.queryParam("east", "108").queryParam("north", "13")
				.queryParam("year", "2024").queryParam("month", "3"))
				.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		List<Map<String, Object>> cells = JsonPath.read(map, "$.cells");
		for (Map<String, Object> cell : cells) {
			String id = (String) cell.get("cellId");
			String detail = mockMvc.perform(details(id).queryParam("year", "2024").queryParam("month", "3"))
					.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
			assertThat(((Number) JsonPath.read(detail, "$.value")).doubleValue())
					.as("cell %s", id)
					.isCloseTo(((Number) cell.get("value")).doubleValue(), within(1e-9));
			assertThat((String) JsonPath.read(detail, "$.origin")).isEqualTo(cell.get("origin"));
		}
	}

	@Test
	void responseHasExactlyTheContractFieldsAndNoMachinePaths() throws Exception {
		String body = mockMvc.perform(details(CELL).queryParam("year", "2024").queryParam("month", "3"))
				.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		Map<String, Object> root = JsonPath.read(body, "$");
		assertThat(root.keySet()).containsExactlyInAnyOrder(
				"cell", "temporalSelector", "value", "valueStatus", "origin", "sourceComposition", "meta");
		assertThat(body).doesNotContain(":\\\\").doesNotContain("hoalich_data_v1").doesNotContain("latitude");
	}

	@Test
	void unknownAndMalformedCellsAreDistinguished() throws Exception {
		mockMvc.perform(details("99_999").queryParam("year", "2024"))
				.andExpect(status().isNotFound())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.code").value("CELL_NOT_FOUND"));
		mockMvc.perform(details("abc").queryParam("year", "2024"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
		mockMvc.perform(details("48-428").queryParam("year", "2024"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	void temporalSelectorErrorsFollowTheMapRules() throws Exception {
		mockMvc.perform(details(CELL))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_TEMPORAL_SELECTOR"));
		mockMvc.perform(details(CELL).queryParam("year", "2024").queryParam("month", "3").queryParam("pentad", "15"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_TEMPORAL_SELECTOR"));
		mockMvc.perform(details(CELL).queryParam("date", "2024-03-18").queryParam("year", "2024"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_TEMPORAL_SELECTOR"));
		mockMvc.perform(details(CELL).queryParam("month", "3"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_TEMPORAL_SELECTOR"));
		mockMvc.perform(details(CELL).queryParam("year", "2024").queryParam("month", "13"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
		mockMvc.perform(details(CELL).queryParam("year", "1999"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
		mockMvc.perform(details(CELL).queryParam("date", "18-03-2024"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
		mockMvc.perform(details(CELL).queryParam("date", "2026-11-14"))
				.andExpect(status().isUnprocessableContent())
				.andExpect(jsonPath("$.code").value("DATE_OUTSIDE_DATASET_RANGE"));
	}
}
