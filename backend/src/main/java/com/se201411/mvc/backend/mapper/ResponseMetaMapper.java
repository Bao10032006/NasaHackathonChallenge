package com.se201411.mvc.backend.mapper;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.dto.common.ResponseMetaDto;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public final class ResponseMetaMapper {

	public ResponseMetaDto toDto(DatasetManifest manifest) {
		return toDto(manifest, List.of());
	}

	public ResponseMetaDto toDto(DatasetManifest manifest, List<String> warnings) {
		return new ResponseMetaDto(
				manifest.dataVersion(),
				manifest.modelVersion(),
				LocalDate.parse(manifest.dataThrough()),
				manifest.metric(),
				manifest.unit(),
				manifest.timeZone(),
				warnings);
	}
}
