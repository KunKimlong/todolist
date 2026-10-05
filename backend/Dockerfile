# syntax=docker/dockerfile:1

# ----------------------------------------------------------------- build ----
# Maven and the JDK only live in this stage; they are thrown away afterwards.
FROM eclipse-temurin:21-jdk-noble AS build

# The Maven wrapper downloads Maven as a .zip, so it needs unzip
RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# The wrapper and the pom change rarely, so resolving the dependencies in their own
# layer lets Docker reuse them when only src/ changed.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline

COPY src/ src/
# Tests are left out: they start Testcontainers, which needs a Docker daemon.
# Run them on the host with ./mvnw test instead.
RUN ./mvnw -B -ntp -DskipTests package

# --------------------------------------------------------------- runtime ----
FROM eclipse-temurin:21-jre-noble AS runtime

# The app writes nothing to disk, so it runs unprivileged.
# uid/gid 1001: the base image already owns 1000.
RUN groupadd --system --gid 1001 spring \
    && useradd --system --uid 1001 --gid 1001 --create-home --home-dir /app \
       --shell /usr/sbin/nologin spring

WORKDIR /app
COPY --from=build --chown=1001:1001 /workspace/target/todo-*.jar /app/app.jar

# Size the heap from the container's memory limit instead of the host's
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0 -XX:+UseSerialGC -Xss512k -Dfile.encoding=UTF-8"

# The only setting with a fallback here. Everything else has no default: the backend
# refuses to start when one is missing, so pass them in with
#   docker run --env-file .env ...
# or as `environment:` in docker compose. See .env.example for the full list.
ENV PORT=8080

USER 1001:1001
EXPOSE 8080

# Reports the database and Redis too, not just that the JVM is up.
# start-period covers Liquibase migrations and the first connection to Postgres.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]