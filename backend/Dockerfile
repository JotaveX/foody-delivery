# syntax=docker/dockerfile:1

# ---- build: compile and package the Spring Boot jar ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

# Resolve dependencies in their own layer so source changes don't re-download them.
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp dependency:go-offline

COPY src src
# Tests and spotless run in CI before the image is built.
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp -DskipTests package \
    && cp target/foody-tracker-*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted

# ---- runtime: JRE only, non-root ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Fixed uid/gid: the data/ bind mount on the VM is chowned to it (see infra/deploy.sh).
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app -H app \
    && mkdir -p /data && chown app:app /data

# Least-changing layers first.
COPY --from=build /workspace/extracted/dependencies/ ./
COPY --from=build /workspace/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/extracted/application/ ./

USER app

ENV SQLITE_PATH=/data/tracker.db \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

# busybox wget ships with alpine; liveness keeps the container healthy even when Redis is down
# (readiness, which includes Redis, is checked by the deploy script through Caddy).
HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/actuator/health/liveness || exit 1

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
