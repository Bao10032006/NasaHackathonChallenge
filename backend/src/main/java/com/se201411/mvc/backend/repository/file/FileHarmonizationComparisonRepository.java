package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.domain.methodology.NationalYearComparison;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;
import com.se201411.mvc.backend.repository.HarmonizationComparisonRepository;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Reads {@code tables/harmonized_national_year.csv} only when the manifest declares it in {@code sources};
 * the file is then verified by size and SHA-256 before parsing.
 */
public final class FileHarmonizationComparisonRepository implements HarmonizationComparisonRepository {

	static final String TABLE_PATH = "tables/harmonized_national_year.csv";
	private static final String HARMONIZED = "hai_hoa_snpp_eq";
	private static final String AQUA_RAW = "aqua_tho_ngay";
	private static final String TERRA_RAW = "terra_tho_ngay";
	private static final String SNPP_RAW = "snpp_tho_ngay";
	private static final String RAW_MERGED = "ghep_tho_moi_ve_tinh";

	private final boolean available;
	private final List<NationalYearComparison> rows;

	private FileHarmonizationComparisonRepository(boolean available, List<NationalYearComparison> rows) {
		this.available = available;
		this.rows = List.copyOf(rows);
	}

	public static FileHarmonizationComparisonRepository open(Path datasetRoot, DatasetManifest manifest) {
		Objects.requireNonNull(datasetRoot, "datasetRoot must not be null");
		Objects.requireNonNull(manifest, "manifest must not be null");
		Optional<Path> table = DatasetArtifactValidator.resolveDeclaredSource(datasetRoot, manifest, TABLE_PATH);
		if (table.isEmpty()) {
			return new FileHarmonizationComparisonRepository(false, List.of());
		}

		SimpleCsvTable csv = SimpleCsvTable.read(
				table.get(), TABLE_PATH, List.of("year", HARMONIZED, AQUA_RAW, TERRA_RAW, SNPP_RAW, RAW_MERGED));
		List<NationalYearComparison> rows = new ArrayList<>(csv.rows().size());
		for (String[] row : csv.rows()) {
			rows.add(new NationalYearComparison(
					csv.integer(row, "year"),
					nonNegative(csv.decimal(row, HARMONIZED), HARMONIZED),
					wholeCount(csv.decimal(row, AQUA_RAW), AQUA_RAW),
					wholeCount(csv.decimal(row, TERRA_RAW), TERRA_RAW),
					wholeCount(csv.decimal(row, SNPP_RAW), SNPP_RAW),
					wholeCount(csv.decimal(row, RAW_MERGED), RAW_MERGED)));
		}
		rows.sort(Comparator.comparingInt(NationalYearComparison::year));
		for (int index = 1; index < rows.size(); index++) {
			if (rows.get(index).year() == rows.get(index - 1).year()) {
				throw new DatasetUnavailableException(TABLE_PATH + " contains a duplicate year");
			}
		}
		return new FileHarmonizationComparisonRepository(true, rows);
	}

	@Override
	public boolean isAvailable() {
		return available;
	}

	@Override
	public List<NationalYearComparison> findAll() {
		return rows;
	}

	private static double nonNegative(double value, String column) {
		if (value < 0) {
			throw new DatasetUnavailableException(TABLE_PATH + " has a negative " + column);
		}
		return value;
	}

	private static long wholeCount(double value, String column) {
		if (value < 0 || value != Math.rint(value)) {
			throw new DatasetUnavailableException(TABLE_PATH + " has an invalid count in " + column);
		}
		return (long) value;
	}
}
