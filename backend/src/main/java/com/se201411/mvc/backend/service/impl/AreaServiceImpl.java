package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.area.AreaDefinition;
import com.se201411.mvc.backend.domain.area.AreaType;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.repository.AreaRepository;
import com.se201411.mvc.backend.service.AreaService;
import com.se201411.mvc.backend.service.model.AreaCatalogEntry;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Service
public final class AreaServiceImpl implements AreaService {

	private static final Map<String, String> DISPLAY_NAMES = Map.of(
			"ToanQuoc", "Toàn quốc",
			"DBSCL", "Đồng bằng sông Cửu Long",
			"DBSH", "Đồng bằng sông Hồng",
			"Khac", "Khu vực khác",
			"TayBac", "Tây Bắc",
			"TayNguyen", "Tây Nguyên");
	private static final List<String> DIAGNOSTIC_REGION_ORDER =
			List.of("DBSCL", "DBSH", "Khac", "TayBac", "TayNguyen");

	private final AreaRepository areaRepository;

	public AreaServiceImpl(AreaRepository areaRepository) {
		this.areaRepository = areaRepository;
	}

	@Override
	public List<AreaCatalogEntry> listAreas(String areaTypeValue) {
		AreaType filter = parseFilter(areaTypeValue);
		List<AreaCatalogEntry> result = new ArrayList<>();
		if (filter == null || filter == AreaType.NATIONAL) {
			AreaDefinition national = areaRepository.findArea(AreaType.NATIONAL, AreaDefinition.NATIONAL_ID)
					.orElseThrow();
			result.add(AreaCatalogEntry.area(national, DISPLAY_NAMES.get(national.id())));
		}
		if (filter == null || filter == AreaType.DIAGNOSTIC_REGION) {
			LinkedHashSet<String> regionIds = new LinkedHashSet<>(DIAGNOSTIC_REGION_ORDER);
			regionIds.retainAll(areaRepository.findDiagnosticRegionIds());
			regionIds.addAll(areaRepository.findDiagnosticRegionIds());
			for (String regionId : regionIds) {
				AreaDefinition region = areaRepository.findArea(AreaType.DIAGNOSTIC_REGION, regionId)
						.orElseThrow();
				result.add(AreaCatalogEntry.area(region, DISPLAY_NAMES.getOrDefault(regionId, regionId)));
			}
		}
		if (filter == null || filter == AreaType.CELL) {
			areaRepository.findAllCells().stream()
					.map(AreaCatalogEntry::cell)
					.forEach(result::add);
		}
		return List.copyOf(result);
	}

	private static AreaType parseFilter(String areaTypeValue) {
		if (areaTypeValue == null) {
			return null;
		}
		if (areaTypeValue.isBlank()) {
			throw ApiException.invalidParameter(
					"type must be one of national, diagnostic_region or cell");
		}
		try {
			return AreaType.fromApiValue(areaTypeValue);
		}
		catch (IllegalArgumentException exception) {
			throw ApiException.invalidParameter(
					"type must be one of national, diagnostic_region or cell");
		}
	}
}
