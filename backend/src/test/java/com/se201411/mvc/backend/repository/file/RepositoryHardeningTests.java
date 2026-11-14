package com.se201411.mvc.backend.repository.file;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.DatasetUnavailableException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** TASK 03B2A A6: repository hardening found by the full backend review. */
class RepositoryHardeningTests {

	@TempDir
	private Path temporaryDirectory;

	@Test
	void readVerifiedReturnsExactlyTheBytesThatWereHashed() throws IOException {
		byte[] content = "cell,region\n34_419,DBSCL\n".getBytes(StandardCharsets.UTF_8);
		Path file = Files.write(temporaryDirectory.resolve("cells.csv"), content);

		byte[] loaded = DatasetArtifactValidator.readVerified(file, content.length, sha256(content), "cells");

		assertThat(loaded).isEqualTo(content);
	}

	@Test
	void readVerifiedRejectsBytesThatNoLongerMatchTheManifest() throws IOException {
		byte[] original = "a,b\n1,2\n".getBytes(StandardCharsets.UTF_8);
		byte[] replaced = "a,b\n9,2\n".getBytes(StandardCharsets.UTF_8);
		Path file = Files.write(temporaryDirectory.resolve("table.csv"), replaced);

		assertThatThrownBy(() -> DatasetArtifactValidator.readVerified(file, original.length, sha256(original), "table"))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("SHA-256");
		assertThatThrownBy(() -> DatasetArtifactValidator.readVerified(file, original.length + 1L, sha256(replaced), "table"))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("size");
	}

	@Test
	void csvTablesRejectDuplicateColumnNames() {
		byte[] csv = "cell,value,cell\n34_419,1,34_420\n".getBytes(StandardCharsets.UTF_8);

		assertThatThrownBy(() -> SimpleCsvTable.parse(csv, "dup.csv", List.of("cell")))
				.isInstanceOf(DatasetUnavailableException.class)
				.hasMessageContaining("duplicate column: cell");
	}

	@Test
	void csvTablesStillParseAByteOrderMarkHeader() {
		byte[] csv = "﻿year,value\n2015,88898.0\n".getBytes(StandardCharsets.UTF_8);

		SimpleCsvTable table = SimpleCsvTable.parse(csv, "bom.csv", List.of("year", "value"));

		assertThat(table.integer(table.rows().getFirst(), "year")).isEqualTo(2015);
	}

	@Test
	void warningParamsAreDeeplyImmutableAndDetachedFromTheParsedJson() {
		List<Object> codes = new ArrayList<>(List.of(1, 2));
		Map<String, Object> params = new HashMap<>();
		params.put("codes", codes);
		params.put("fromYear", null);

		DatasetManifest.WarningDefinition definition = new DatasetManifest.WarningDefinition(
				"TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY", "SOURCE_CODE_PRESENT", params, List.of("/daily"), "d");
		codes.add(3);

		@SuppressWarnings("unchecked")
		List<Object> storedCodes = (List<Object>) definition.params().get("codes");
		assertThat(storedCodes).containsExactly(1, 2);
		assertThat(definition.params()).containsEntry("fromYear", null);
		assertThatThrownBy(() -> storedCodes.add(4)).isInstanceOf(UnsupportedOperationException.class);
		assertThatThrownBy(() -> definition.params().put("x", 1)).isInstanceOf(UnsupportedOperationException.class);
	}

	@Test
	void validationChecksAreDeeplyImmutable() {
		Map<String, Object> nested = new HashMap<>();
		nested.put("expected", new ArrayList<>(List.of(171.635599)));
		Map<String, Object> check = new HashMap<>();
		check.put("id", "R1");
		check.put("detail", nested);
		check.put("note", null);

		DatasetManifest.Validation validation = new DatasetManifest.Validation("PASS", List.of(check), null);

		Map<String, Object> stored = validation.checks().getFirst();
		assertThat(stored).containsEntry("note", null);
		assertThat(validation.regressionSamples()).isEmpty();
		assertThatThrownBy(() -> stored.put("id", "R2")).isInstanceOf(UnsupportedOperationException.class);
		@SuppressWarnings("unchecked")
		Map<String, Object> storedDetail = (Map<String, Object>) stored.get("detail");
		@SuppressWarnings("unchecked")
		List<Object> storedExpected = (List<Object>) storedDetail.get("expected");
		assertThatThrownBy(() -> storedExpected.add(0.0)).isInstanceOf(UnsupportedOperationException.class);
	}

	private static String sha256(byte[] content) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException(exception);
		}
	}
}
