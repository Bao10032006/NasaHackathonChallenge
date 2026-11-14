package com.se201411.mvc.backend.config;

import java.nio.file.Path;

import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "hoalich.dataset")
public record DatasetProperties(@NotNull Path root) {
}
