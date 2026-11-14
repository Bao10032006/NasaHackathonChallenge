package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.exception.DatasetUnavailableException;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal reader for the pipeline's plain CSV tables (comma separated, no quoting, header row).
 * Required columns are checked up front so a schema change fails at startup.
 */
final class SimpleCsvTable {

	private final String label;
	private final Map<String, Integer> columns;
	private final List<String[]> rows;

	private SimpleCsvTable(String label, Map<String, Integer> columns, List<String[]> rows) {
		this.label = label;
		this.columns = columns;
		this.rows = rows;
	}

	static SimpleCsvTable read(Path path, String label, List<String> requiredColumns) {
		try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
			String headerLine = reader.readLine();
			if (headerLine == null) {
				throw new DatasetUnavailableException("CSV table is empty: " + label);
			}
			String[] headers = headerLine.replace("\uFEFF", "").split(",", -1);
			Map<String, Integer> columns = new HashMap<>();
			for (int index = 0; index < headers.length; index++) {
				columns.put(headers[index].trim(), index);
			}
			for (String required : requiredColumns) {
				if (!columns.containsKey(required)) {
					throw new DatasetUnavailableException(
							"CSV table " + label + " is missing required column: " + required);
				}
			}
			List<String[]> rows = new ArrayList<>();
			String line;
			while ((line = reader.readLine()) != null) {
				if (line.isBlank()) {
					continue;
				}
				String[] values = line.split(",", -1);
				if (values.length != headers.length) {
					throw new DatasetUnavailableException("CSV table " + label + " contains a malformed row");
				}
				rows.add(values);
			}
			return new SimpleCsvTable(label, Map.copyOf(columns), List.copyOf(rows));
		}
		catch (IOException exception) {
			throw new DatasetUnavailableException("Cannot read CSV table: " + label, exception);
		}
	}

	List<String[]> rows() {
		return rows;
	}

	String text(String[] row, String column) {
		String value = row[columns.get(column)].trim();
		if (value.isEmpty()) {
			throw new DatasetUnavailableException("CSV table " + label + " has an empty " + column);
		}
		return value;
	}

	int integer(String[] row, String column) {
		try {
			return Integer.parseInt(text(row, column));
		}
		catch (NumberFormatException exception) {
			throw new DatasetUnavailableException(
					"CSV table " + label + " has a non-integer " + column, exception);
		}
	}

	double decimal(String[] row, String column) {
		try {
			double value = Double.parseDouble(text(row, column));
			if (!Double.isFinite(value)) {
				throw new DatasetUnavailableException("CSV table " + label + " has a non-finite " + column);
			}
			return value;
		}
		catch (NumberFormatException exception) {
			throw new DatasetUnavailableException(
					"CSV table " + label + " has a non-numeric " + column, exception);
		}
	}
}
