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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * TASK 03B3B against the committed v1.0 snapshot. Golden values were computed independently from
 * {@code derived/daily-values.f32} (numpy, float64 sums) on 15/11/2026, tolerance 1e-4:
 * bbox 107,12,108,13 (13 cells) March 2005 = 3039.161190, March 2024 = 450.0, year 2024 = 2182.780156,
 * year 2000 (covered 1/11-31/12) = 76.883103; seasonality March 2003-2025 mean 1405.899386,
 * median 1202.0; August mean 2.973882, median 1.176552; pentad 15 mean 304.907923, median 184.0;
 * March 2004-2023 (even n = 20) median 1206.078039.
 */
@SpringBootTest
@AutoConfigureMockMvc
class HistoricalAnalysisControllerIntegrationTests {

	private static final double TOLERANCE = 1e-4;

	@Autowired
	private MockMvc mockMvc;

	private static MockHttpServletRequestBuilder goldenBox(String path) {
		return get(path)
				.queryParam("west", "107")
				.queryParam("south", "12")
				.queryParam("east", "108")
				.queryParam("north", "13");
	}

	// ---------- trends ----------

	@Test
	void monthTrendForGoldenBoxHasOnePointPerYearWithOriginFromComposition() throws Exception {
		mockMvc.perform(goldenBox("/api/v1/trends")
				.queryParam("startYear", "2005")
				.queryParam("endYear", "2024")
				.queryParam("granularity", "month")
				.queryParam("period", "3"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.selection.type").value("BOUNDING_BOX"))
				.andExpect(jsonPath("$.selection.cellCount").value(13))
				.andExpect(jsonPath("$.granularity").value("month"))
				.andExpect(jsonPath("$.period").value(3))
				.andExpect(jsonPath("$.points.length()").value(20))
				.andExpect(jsonPath("$.points[0].year").value(2005))
				.andExpect(jsonPath("$.points[0].period").value(3))
				.andExpect(jsonPath("$.points[0].value").value(closeTo(3039.161190, TOLERANCE)))
				.andExpect(jsonPath("$.points[0].origin").value("MODEL_REDISTRIBUTED"))
				.andExpect(jsonPath("$.points[19].year").value(2024))
				.andExpect(jsonPath("$.points[19].value").value(closeTo(450.0, TOLERANCE)))
				.andExpect(jsonPath("$.points[19].valueStatus").value("AVAILABLE"))
				.andExpect(jsonPath("$.points[19].partial").value(false))
				.andExpect(jsonPath("$.points[19].origin").value("DIRECT_OBSERVATION"))
				.andExpect(jsonPath("$.points[19].coverage.expectedDayCount").value(31));
	}

	@Test
	void yearTrendMarksPartialEdgesAndOmitsPeriod() throws Exception {
		mockMvc.perform(goldenBox("/api/v1/trends")
				.queryParam("startYear", "2000")
				.queryParam("endYear", "2026")
				.queryParam("granularity", "year"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.period").doesNotExist())
				.andExpect(jsonPath("$.points.length()").value(27))
				.andExpect(jsonPath("$.points[0].period").doesNotExist())
				.andExpect(jsonPath("$.points[0].year").value(2000))
				.andExpect(jsonPath("$.points[0].value").value(closeTo(76.883103, TOLERANCE)))
				.andExpect(jsonPath("$.points[0].partial").value(true))
				.andExpect(jsonPath("$.points[0].coverage.coveredStartDate").value("2000-11-01"))
				.andExpect(jsonPath("$.points[24].year").value(2024))
				.andExpect(jsonPath("$.points[24].value").value(closeTo(2182.780156, TOLERANCE)))
				.andExpect(jsonPath("$.points[24].partial").value(false))
				.andExpect(jsonPath("$.points[26].partial").value(true))
				.andExpect(jsonPath("$.meta.warnings[0]").value("PARTIAL_PERIOD"));
	}

	@Test
	void periodWithoutDatasetOverlapIsNullOutsideRangeNotZero() throws Exception {
		mockMvc.perform(goldenBox("/api/v1/trends")
				.queryParam("startYear", "2000")
				.queryParam("endYear", "2001")
				.queryParam("granularity", "month")
				.queryParam("period", "3"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.points[0].year").value(2000))
				.andExpect(jsonPath("$.points[0].value").value(nullValue()))
				.andExpect(jsonPath("$.points[0].valueStatus").value("OUTSIDE_DATASET_RANGE"))
				.andExpect(jsonPath("$.points[0].origin").value(nullValue()))
				.andExpect(jsonPath("$.points[0].partial").value(false))
				.andExpect(jsonPath("$.points[0].coverage.coveredDayCount").value(0))
				.andExpect(jsonPath("$.points[0].coverage.coveredStartDate").value(nullValue()))
				.andExpect(jsonPath("$.points[1].valueStatus").value("AVAILABLE"));
	}

	@Test
	void validZeroStaysAvailableWithItsOrigin() throws Exception {
		// Cell 40_422, January 2012: total 0 from 19 Aqua (model) and 12 S-NPP (direct) cell-days.
		mockMvc.perform(get("/api/v1/trends")
				.queryParam("areaType", "cell")
				.queryParam("areaId", "40_422")
				.queryParam("startYear", "2012")
				.queryParam("endYear", "2012")
				.queryParam("granularity", "month")
				.queryParam("period", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.points[0].value").value(0.0))
				.andExpect(jsonPath("$.points[0].valueStatus").value("AVAILABLE"))
				.andExpect(jsonPath("$.points[0].origin").value("MODEL_REDISTRIBUTED"));
	}

	@Test
	void pentadTrendUsesPentadRanges() throws Exception {
		mockMvc.perform(goldenBox("/api/v1/trends")
				.queryParam("startYear", "2024")
				.queryParam("endYear", "2024")
				.queryParam("granularity", "pentad")
				.queryParam("period", "73"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.period").value(73))
				.andExpect(jsonPath("$.points[0].coverage.requestedStartDate").value("2024-12-26"))
				.andExpect(jsonPath("$.points[0].coverage.requestedEndDate").value("2024-12-31"))
				.andExpect(jsonPath("$.points[0].coverage.expectedDayCount").value(6));
	}

	@Test
	void namedNationalAndFullExtentBoxGiveTheSameTrend() throws Exception {
		String named = mockMvc.perform(get("/api/v1/trends")
				.queryParam("areaType", "national").queryParam("areaId", "ToanQuoc")
				.queryParam("startYear", "2020").queryParam("endYear", "2024")
				.queryParam("granularity", "year"))
				.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		String box = mockMvc.perform(get("/api/v1/trends")
				.queryParam("west", "-180").queryParam("south", "-90")
				.queryParam("east", "180").queryParam("north", "90")
				.queryParam("startYear", "2020").queryParam("endYear", "2024")
				.queryParam("granularity", "year"))
				.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		assertThat((Integer) JsonPath.read(box, "$.selection.cellCount")).isEqualTo(587);
		List<Double> namedValues = JsonPath.read(named, "$.points[*].value");
		List<Double> boxValues = JsonPath.read(box, "$.points[*].value");
		assertThat(boxValues).isEqualTo(namedValues);
	}

	@Test
	void diagnosticRegionTrendCarriesTheAdminBoundaryWarning() throws Exception {
		mockMvc.perform(get("/api/v1/trends")
				.queryParam("areaType", "diagnostic_region").queryParam("areaId", "TayNguyen")
				.queryParam("startYear", "2023").queryParam("endYear", "2024")
				.queryParam("granularity", "month").queryParam("period", "3"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.selection.area.id").value("TayNguyen"))
				.andExpect(jsonPath("$.meta.warnings[0]").value("DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY"));
	}

	@Test
	void trendParameterErrorsAreClientErrors() throws Exception {
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("startYear", "2020")
				.queryParam("endYear", "2024").queryParam("granularity", "year").queryParam("period", "3"));
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("startYear", "2020")
				.queryParam("endYear", "2024").queryParam("granularity", "month"));
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("startYear", "2020")
				.queryParam("endYear", "2024").queryParam("granularity", "month").queryParam("period", "13"));
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("startYear", "2020")
				.queryParam("endYear", "2024").queryParam("granularity", "pentad").queryParam("period", "74"));
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("startYear", "2020")
				.queryParam("endYear", "2024").queryParam("granularity", "day"));
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("startYear", "2024")
				.queryParam("endYear", "2020").queryParam("granularity", "year"));
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("startYear", "1999")
				.queryParam("endYear", "2020").queryParam("granularity", "year"));
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("endYear", "2020")
				.queryParam("granularity", "year"));
		expectInvalidParameter(goldenBox("/api/v1/trends").queryParam("startYear", "abc")
				.queryParam("endYear", "2020").queryParam("granularity", "year"));
	}

	@Test
	void trendSpatialErrorsFollowTheSharedSelectorRules() throws Exception {
		mockMvc.perform(get("/api/v1/trends").queryParam("startYear", "2020")
				.queryParam("endYear", "2024").queryParam("granularity", "year"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_SPATIAL_SELECTOR"));
		mockMvc.perform(get("/api/v1/trends").queryParam("areaType", "diagnostic_region")
				.queryParam("areaId", "Nowhere").queryParam("startYear", "2020")
				.queryParam("endYear", "2024").queryParam("granularity", "year"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("AREA_NOT_FOUND"));
		mockMvc.perform(get("/api/v1/trends").queryParam("west", "100").queryParam("south", "0")
				.queryParam("east", "101").queryParam("north", "1").queryParam("startYear", "2020")
				.queryParam("endYear", "2024").queryParam("granularity", "year"))
				.andExpect(status().isUnprocessableContent())
				.andExpect(jsonPath("$.code").value("NO_CELLS_IN_BOUNDS"));
	}

	// ---------- seasonality ----------

	@Test
	void monthlySeasonalityHasTwelveOrderedPeriodsWithGoldenStatistics() throws Exception {
		mockMvc.perform(goldenBox("/api/v1/seasonality").queryParam("granularity", "month"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.granularity").value("month"))
				.andExpect(jsonPath("$.referenceStartYear").value(2003))
				.andExpect(jsonPath("$.referenceEndYear").value(2025))
				.andExpect(jsonPath("$.minimumSampleSize").value(5))
				.andExpect(jsonPath("$.periods.length()").value(12))
				.andExpect(jsonPath("$.periods[0].period").value(1))
				.andExpect(jsonPath("$.periods[11].period").value(12))
				.andExpect(jsonPath("$.periods[2].sampleSize").value(23))
				.andExpect(jsonPath("$.periods[2].mean").value(closeTo(1405.899386, TOLERANCE)))
				.andExpect(jsonPath("$.periods[2].median").value(closeTo(1202.0, TOLERANCE)))
				.andExpect(jsonPath("$.periods[2].valueStatus").value("AVAILABLE"))
				.andExpect(jsonPath("$.periods[7].mean").value(closeTo(2.973882, TOLERANCE)))
				.andExpect(jsonPath("$.periods[7].median").value(closeTo(1.176552, TOLERANCE)));
	}

	@Test
	void pentadSeasonalityHasSeventyThreePeriods() throws Exception {
		mockMvc.perform(goldenBox("/api/v1/seasonality").queryParam("granularity", "pentad"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.periods.length()").value(73))
				.andExpect(jsonPath("$.periods[72].period").value(73))
				.andExpect(jsonPath("$.periods[14].mean").value(closeTo(304.907923, TOLERANCE)))
				.andExpect(jsonPath("$.periods[14].median").value(closeTo(184.0, TOLERANCE)));
	}

	@Test
	void evenReferenceRangeUsesTheAverageOfTheTwoMiddleValues() throws Exception {
		mockMvc.perform(goldenBox("/api/v1/seasonality").queryParam("granularity", "month")
				.queryParam("startYear", "2004").queryParam("endYear", "2023"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.periods[2].sampleSize").value(20))
				.andExpect(jsonPath("$.periods[2].median").value(closeTo(1206.078039, TOLERANCE)));
	}

	@Test
	void fourValidYearsAreInsufficientAndFiveAreAvailable() throws Exception {
		mockMvc.perform(goldenBox("/api/v1/seasonality").queryParam("granularity", "month")
				.queryParam("startYear", "2021").queryParam("endYear", "2024"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.periods[2].sampleSize").value(4))
				.andExpect(jsonPath("$.periods[2].mean").value(nullValue()))
				.andExpect(jsonPath("$.periods[2].median").value(nullValue()))
				.andExpect(jsonPath("$.periods[2].valueStatus").value("INSUFFICIENT_BASELINE"));
		mockMvc.perform(goldenBox("/api/v1/seasonality").queryParam("granularity", "month")
				.queryParam("startYear", "2021").queryParam("endYear", "2025"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.periods[2].sampleSize").value(5))
				.andExpect(jsonPath("$.periods[2].valueStatus").value("AVAILABLE"));
	}

	@Test
	void partialAndOutsideReferencePeriodsAreExcludedFromTheSample() throws Exception {
		// 2022-2026: November 2026 is partial (1-13) and December 2026 is outside the dataset.
		mockMvc.perform(goldenBox("/api/v1/seasonality").queryParam("granularity", "month")
				.queryParam("startYear", "2022").queryParam("endYear", "2026"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.periods[9].sampleSize").value(5))
				.andExpect(jsonPath("$.periods[10].sampleSize").value(4))
				.andExpect(jsonPath("$.periods[10].valueStatus").value("INSUFFICIENT_BASELINE"))
				.andExpect(jsonPath("$.periods[11].sampleSize").value(4));
		// 2000-2004: January 2000 is outside the dataset (starts 1/11/2000), November 2000 is complete.
		mockMvc.perform(goldenBox("/api/v1/seasonality").queryParam("granularity", "month")
				.queryParam("startYear", "2000").queryParam("endYear", "2004"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.periods[0].sampleSize").value(4))
				.andExpect(jsonPath("$.periods[10].sampleSize").value(5));
	}

	@Test
	void seasonalityParameterErrorsAreClientErrors() throws Exception {
		expectInvalidParameter(goldenBox("/api/v1/seasonality").queryParam("granularity", "year"));
		expectInvalidParameter(goldenBox("/api/v1/seasonality"));
		expectInvalidParameter(goldenBox("/api/v1/seasonality").queryParam("granularity", "month")
				.queryParam("startYear", "2025").queryParam("endYear", "2003"));
		expectInvalidParameter(goldenBox("/api/v1/seasonality").queryParam("granularity", "month")
				.queryParam("endYear", "2027"));
	}

	private void expectInvalidParameter(MockHttpServletRequestBuilder request) throws Exception {
		mockMvc.perform(request)
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}
}
