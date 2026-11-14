package com.se201411.mvc.backend.service;

import com.se201411.mvc.backend.service.model.AreaCatalogEntry;

import java.util.List;

public interface AreaService {

	List<AreaCatalogEntry> listAreas(String areaType);
}
