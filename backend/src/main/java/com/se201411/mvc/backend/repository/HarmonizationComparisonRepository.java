package com.se201411.mvc.backend.repository;

import com.se201411.mvc.backend.domain.methodology.NationalYearComparison;

import java.util.List;

public interface HarmonizationComparisonRepository {

	/** False when the active dataset does not declare the comparison table (for example the fixture). */
	boolean isAvailable();

	/** Rows ordered by year; empty when {@link #isAvailable()} is false. */
	List<NationalYearComparison> findAll();
}
