package com.se201411.mvc.backend.domain.methodology;

/**
 * One row of {@code tables/harmonized_national_year.csv}: the national harmonized total next to the
 * raw sensor counts it is compared with. Raw counts are different metrics (detections per sensor) and
 * must never be presented with the snpp_eq unit.
 *
 * @param harmonizedSnppEq    harmonized national total (snpp_eq)
 * @param aquaRawDaytime      raw Aqua daytime non-static detections
 * @param terraRawDaytime     raw Terra daytime non-static detections
 * @param snppRawDaytime      raw S-NPP daytime non-static detections
 * @param rawMergedAllDetections naive sum of all satellites' detections (reference only, not comparable)
 */
public record NationalYearComparison(
		int year,
		double harmonizedSnppEq,
		long aquaRawDaytime,
		long terraRawDaytime,
		long snppRawDaytime,
		long rawMergedAllDetections) {
}
