package com.se201411.mvc.backend.domain.area;

public enum AreaType {

	NATIONAL("national"),
	DIAGNOSTIC_REGION("diagnostic_region"),
	CELL("cell");

	private final String apiValue;

	AreaType(String apiValue) {
		this.apiValue = apiValue;
	}

	public String apiValue() {
		return apiValue;
	}

	public static AreaType fromApiValue(String value) {
		for (AreaType type : values()) {
			if (type.apiValue.equals(value)) {
				return type;
			}
		}
		throw new IllegalArgumentException("Unknown areaType: " + value);
	}
}
