package com.se201411.mvc.backend.domain.dataset;

import java.util.List;
import java.util.Map;

public record DatasetManifest(
		String schemaVersion,
		String dataVersion,
		String modelVersion,
		String pipelineVersion,
		String kind,
		String metric,
		String unit,
		String timeZone,
		DateRange dateRange,
		String dataThrough,
		Grid grid,
		Layout layout,
		List<ArtifactFile> files,
		List<SourceCodeDefinition> sourceCodes,
		Periods periods,
		List<SourceArtifact> sources,
		Capabilities capabilities,
		List<WarningDefinition> warningCatalog,
		List<Limitation> limitations,
		Validation validation,
		Generator generator) {

	public DatasetManifest {
		files = immutableList(files);
		sourceCodes = immutableList(sourceCodes);
		sources = immutableList(sources);
		warningCatalog = immutableList(warningCatalog);
		limitations = immutableList(limitations);
	}

	public record DateRange(String start, String end, int dayCount) {
	}

	public record Grid(
			double degrees,
			int cellCount,
			String cellOrderSource,
			List<String> cellIds) {

		public Grid {
			cellIds = immutableList(cellIds);
		}
	}

	public record Layout(String order, String byteOrder, String header) {
	}

	public record ArtifactFile(
			String name,
			String dtype,
			int bytesPerValue,
			List<Integer> shape,
			long byteSize,
			String sha256,
			String description) {

		public ArtifactFile {
			shape = immutableList(shape);
		}
	}

	public record SourceCodeDefinition(
			int code,
			String source,
			String origin,
			String inputSatellite,
			String firstDate,
			String lastDate,
			long cellDays,
			Double scaleDivisor,
			Double scaleDivisorReported) {
	}

	public record Periods(List<PartialPeriod> partial, List<Transition> transitions) {

		public Periods {
			partial = immutableList(partial);
			transitions = immutableList(transitions);
		}
	}

	public record PartialPeriod(
			String granularity,
			int year,
			Integer period,
			String periodStart,
			String periodEnd,
			String coveredFrom,
			String coveredTo) {
	}

	public record Transition(String date, String event) {
	}

	public record SourceArtifact(String path, long byteSize, String sha256) {
	}

	public record Capabilities(List<OptionalArtifact> optionalArtifacts) {

		public Capabilities {
			optionalArtifacts = immutableList(optionalArtifacts);
		}
	}

	public record OptionalArtifact(
			String name,
			String path,
			long byteSize,
			String sha256,
			String description) {
	}

	public record WarningDefinition(
			String code,
			String trigger,
			Map<String, Object> params,
			List<String> appliesTo,
			String description) {

		public WarningDefinition {
			params = params == null ? Map.of() : Map.copyOf(params);
			appliesTo = immutableList(appliesTo);
		}
	}

	public record Limitation(String code, String description) {
	}

	public record Validation(
			String status,
			List<Map<String, Object>> checks,
			List<Map<String, Object>> regressionSamples) {

		public Validation {
			checks = immutableList(checks);
			regressionSamples = immutableList(regressionSamples);
		}
	}

	public record Generator(
			String script,
			String python,
			String numpy,
			String pandas,
			String generatedAt) {
	}

	private static <T> List<T> immutableList(List<T> values) {
		return values == null ? List.of() : List.copyOf(values);
	}
}
