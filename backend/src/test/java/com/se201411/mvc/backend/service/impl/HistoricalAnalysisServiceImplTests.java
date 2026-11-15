package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.service.model.SeasonalityResult;
import com.se201411.mvc.backend.service.model.ValueStatus;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Pure statistics rules of TASK 03B3B seasonality (no dataset needed). */
class HistoricalAnalysisServiceImplTests {

	@Test
	void fourSamplesAreInsufficientAndKeepTheirRealSampleSize() {
		SeasonalityResult.Period period = HistoricalAnalysisServiceImpl.statistics(3, List.of(1.0, 2.0, 3.0, 4.0));
		assertThat(period.valueStatus()).isEqualTo(ValueStatus.INSUFFICIENT_BASELINE);
		assertThat(period.sampleSize()).isEqualTo(4);
		assertThat(period.mean()).isNull();
		assertThat(period.median()).isNull();
	}

	@Test
	void fiveSamplesAreAvailableWithOddMedian() {
		SeasonalityResult.Period period = HistoricalAnalysisServiceImpl.statistics(
				3, List.of(9.0, 1.0, 5.0, 3.0, 7.0));
		assertThat(period.valueStatus()).isEqualTo(ValueStatus.AVAILABLE);
		assertThat(period.sampleSize()).isEqualTo(5);
		assertThat(period.mean()).isCloseTo(5.0, within(1e-12));
		assertThat(period.median()).isEqualTo(5.0);
	}

	@Test
	void evenSampleMedianAveragesTheTwoMiddleValues() {
		assertThat(HistoricalAnalysisServiceImpl.median(List.of(4.0, 1.0, 3.0, 2.0, 6.0, 5.0))).isEqualTo(3.5);
	}

	@Test
	void zeroIsAValidSampleNotAMissingValue() {
		SeasonalityResult.Period period = HistoricalAnalysisServiceImpl.statistics(
				8, List.of(0.0, 0.0, 0.0, 2.0, 8.0));
		assertThat(period.valueStatus()).isEqualTo(ValueStatus.AVAILABLE);
		assertThat(period.sampleSize()).isEqualTo(5);
		assertThat(period.median()).isEqualTo(0.0);
		assertThat(period.mean()).isCloseTo(2.0, within(1e-12));
	}

	@Test
	void medianDoesNotReorderTheCallersSamples() {
		List<Double> samples = new java.util.ArrayList<>(List.of(3.0, 1.0, 2.0));
		HistoricalAnalysisServiceImpl.median(samples);
		assertThat(samples).containsExactly(3.0, 1.0, 2.0);
	}
}
