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
class MetadataAreaControllerIntegrationTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void exposesContractCompatibleMetadata() throws Exception {
		mockMvc.perform(get("/api/v1/metadata"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.meta.dataVersion").value("fixture-daily-mini-1"))
				.andExpect(jsonPath("$.meta.metric").value("snpp_eq"))
				.andExpect(jsonPath("$.dateRange.start").value("2026-11-10"))
				.andExpect(jsonPath("$.dateRange.end").value("2026-11-13"))
				.andExpect(jsonPath("$.gridDegrees").value(0.25))
				.andExpect(jsonPath("$.capabilities.spatialSelectors[0]").value("NAMED_AREA"))
				.andExpect(jsonPath("$.capabilities.spatialSelectors[1]").value("BOUNDING_BOX"))
				.andExpect(jsonPath("$.capabilities.calendarDaysAvailable").value(true))
				.andExpect(jsonPath("$.capabilities.rawDetectionPointsAvailable").value(false))
				.andExpect(jsonPath("$.capabilities.harmonizationComparisonAvailable").value(false))
				.andExpect(jsonPath("$.daily.uncertaintyIntervalAvailable").value(false))
				.andExpect(jsonPath("$.sourceCodes.length()").value(4))
				.andExpect(jsonPath("$.warningCatalog[0].code").value("PARTIAL_PERIOD"));
	}

	@Test
	void allowsTheConfiguredViteDevelopmentOrigin() throws Exception {
		mockMvc.perform(get("/api/v1/metadata").header("Origin", "http://localhost:5173"))
				.andExpect(status().isOk())
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
						.header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
	}

	@Test
	void listsAllAreaKindsAndKeepsCellGeometry() throws Exception {
		mockMvc.perform(get("/api/v1/areas"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(7))
				.andExpect(jsonPath("$.items[0].type").value("national"))
				.andExpect(jsonPath("$.items[0].name").value("Toàn quốc"))
				.andExpect(jsonPath("$.items[0].cellCount").value(4))
				.andExpect(jsonPath("$.items[1].id").value("DBSCL"))
				.andExpect(jsonPath("$.items[3].type").value("cell"))
				.andExpect(jsonPath("$.items[3].id").value("34_419"))
				.andExpect(jsonPath("$.items[3].diagnosticRegion").value("DBSCL"))
				.andExpect(jsonPath("$.items[3].center.lat").value(8.625))
				.andExpect(jsonPath("$.items[3].bounds.west").value(104.75))
				.andExpect(jsonPath("$.items[3].name").doesNotExist());
	}

	@Test
	void filtersAreasByType() throws Exception {
		mockMvc.perform(get("/api/v1/areas").queryParam("type", "diagnostic_region"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(2))
				.andExpect(jsonPath("$.items[0].name").value("Đồng bằng sông Cửu Long"))
				.andExpect(jsonPath("$.items[1].name").value("Tây Nguyên"));
	}

	@Test
	void returnsContractProblemForInvalidAreaType() throws Exception {
		mockMvc.perform(get("/api/v1/areas").queryParam("type", "province"))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
				.andExpect(jsonPath("$.instance").value("/api/v1/areas"))
				.andExpect(jsonPath("$.timestamp").exists());
	}
}
