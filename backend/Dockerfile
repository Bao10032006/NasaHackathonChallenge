# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw

COPY src/main/ src/main/
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /workspace/target/backend-0.0.1-SNAPSHOT.jar /app/app.jar
COPY --chown=10001:10001 hoalich_data_v1/hoalich_data_v1/ /app/hoalich_data_v1/hoalich_data_v1/

ENV HOALICH_DATASET_ROOT=/app/hoalich_data_v1/hoalich_data_v1
ENV JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75.0

USER 10001:10001

EXPOSE 10000

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
