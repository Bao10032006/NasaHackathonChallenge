package com.se201411.mvc.backend.controller;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regressions for the backend review of 15/11/2026:
 * <ul>
 *   <li>an unacceptable {@code Accept} header was reported as 500 INTERNAL_ERROR instead of 406;</li>
 *   <li>{@code /metadata} advertised {@code harmonizationComparisonAvailable=true} while the endpoint
 *       answered 404.</li>
 * </ul>
 * Runs against the committed v1.0 snapshot, which does contain the comparison table.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ContentNegotiationAndCapabilityIntegrationTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void htmlOnlyClientGetsNotAcceptableInsteadOfServerError() throws Exception {
		mockMvc.perform(get("/api/v1/metadata").header(HttpHeaders.ACCEPT, MediaType.TEXT_HTML_VALUE))
				.andExpect(status().isNotAcceptable());
	}

	@Test
	void xmlOnlyClientGetsNotAcceptableInsteadOfServerError() throws Exception {
		mockMvc.perform(get("/api/v1/metadata").header(HttpHeaders.ACCEPT, MediaType.APPLICATION_XML_VALUE))
				.andExpect(status().isNotAcceptable());
	}

	@Test
	void notAcceptableOnAnalyticalEndpointIsAlsoAClientError() throws Exception {
		mockMvc.perform(get("/api/v1/map/cells")
				.queryParam("year", "2024")
				.header(HttpHeaders.ACCEPT, MediaType.TEXT_HTML_VALUE))
				.andExpect(status().isNotAcceptable());
	}

	@Test
	void jsonAndWildcardClientsStillGetMetadata() throws Exception {
		mockMvc.perform(get("/api/v1/metadata").header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/metadata").header(HttpHeaders.ACCEPT, MediaType.ALL_VALUE))
				.andExpect(status().isOk());
	}

	@Test
	void comparisonIsNotAdvertisedWhileTheEndpointIsMissing() throws Exception {
		mockMvc.perform(get("/api/v1/metadata"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.capabilities.harmonizationComparisonAvailable").value(false));
	}

	/** Guards the invariant itself, so it keeps holding when the optional endpoint is added later. */
	@Test
	void advertisedComparisonCapabilityMatchesEndpointAvailability() throws Exception {
		String metadata = mockMvc.perform(get("/api/v1/metadata"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		boolean advertised = JsonPath.read(metadata, "$.capabilities.harmonizationComparisonAvailable");
		int comparisonStatus = mockMvc.perform(get("/api/v1/harmonization/comparison"))
				.andReturn().getResponse().getStatus();
		if (advertised) {
			org.assertj.core.api.Assertions.assertThat(comparisonStatus).isEqualTo(200);
		}
		else {
			org.assertj.core.api.Assertions.assertThat(comparisonStatus).isEqualTo(404);
		}
	}
}
