package com.se201411.mvc.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regressions for the two defects found by the full backend review after TASK 03B2:
 * unknown routes / unsupported methods returned 500, and zero-total periods were labelled MIXED.
 * Runs against the committed v1.0 snapshot (default dataset root).
 */
@SpringBootTest
@AutoConfigureMockMvc
class HttpErrorAndOriginIntegrationTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void unknownApiPathIsANotFoundProblem() throws Exception {
		mockMvc.perform(get("/api/v1/does-not-exist"))
				.andExpect(status().isNotFound())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.code").value("NOT_FOUND"))
				.andExpect(jsonPath("$.instance").value("/api/v1/does-not-exist"));
	}

	@Test
	void unsupportedMethodIsAMethodNotAllowedProblemWithAllowHeader() throws Exception {
		mockMvc.perform(post("/api/v1/metadata"))
				.andExpect(status().isMethodNotAllowed())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(header().string("Allow", containsString("GET")))
				.andExpect(jsonPath("$.status").value(405))
				.andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
	}

	@Test
	void zeroValuedCellMonthKeepsItsMajorityCellDayOrigin() throws Exception {
		// Cell 40_422, January 2012: total 0 from 19 Aqua (model) and 12 S-NPP (direct) cell-days.
		mockMvc.perform(get("/api/v1/map/cells")
				.queryParam("areaType", "cell")
				.queryParam("areaId", "40_422")
				.queryParam("year", "2012")
				.queryParam("month", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.summary.totalValue").value(0.0))
				.andExpect(jsonPath("$.summary.origin").value("MODEL_REDISTRIBUTED"))
				.andExpect(jsonPath("$.cells[0].cellId").value("40_422"))
				.andExpect(jsonPath("$.cells[0].value").value(0.0))
				.andExpect(jsonPath("$.cells[0].origin").value("MODEL_REDISTRIBUTED"));
	}
}
