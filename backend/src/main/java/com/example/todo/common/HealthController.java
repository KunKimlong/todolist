package com.example.todo.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.BooleanSupplier;

/**
 * {@code GET /health}: is the API running, and can it still reach PostgreSQL and Redis?
 * Needs no session (see SecurityConfig), so a container healthcheck or load balancer can
 * call it. Answers 200 when everything is up, 503 otherwise.
 *
 * Every dependency gets {@link #PROBE_TIMEOUT}: Redis blocks for its own, much longer
 * command timeout while it reconnects, and a health endpoint that hangs is worse than
 * one that answers DOWN in time.
 */
@RestController
public class HealthController {

    public static final String UP = "UP";
    public static final String DOWN = "DOWN";

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(2);

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    private final DataSource dataSource;
    private final RedisConnectionFactory redis;

    public HealthController(DataSource dataSource, RedisConnectionFactory redis) {
        this.dataSource = dataSource;
        this.redis = redis;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        String database = status("database", this::databaseUp);
        String sessions = status("redis", this::redisUp);
        boolean up = UP.equals(database) && UP.equals(sessions);

        Map<String, String> body = new LinkedHashMap<>();
        body.put("status", up ? UP : DOWN);
        body.put("database", database);
        body.put("redis", sessions);
        return ResponseEntity.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    /** Gives a probe a deadline; the probes themselves only report what they found. */
    private String status(String name, BooleanSupplier probe) {
        try {
            return CompletableFuture.supplyAsync(probe::getAsBoolean)
                    .get(PROBE_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS) ? UP : DOWN;
        } catch (TimeoutException e) {
            log.warn("Health check: {} did not answer within {}", name, PROBE_TIMEOUT);
            return DOWN;
        } catch (ExecutionException e) {
            log.warn("Health check: {} failed: {}", name, e.getCause());
            return DOWN;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return DOWN;
        }
    }

    private boolean databaseUp() {
        try (Connection connection = dataSource.getConnection()) {
            if (connection.isValid(2)) return true;
            log.warn("Health check: database did not accept the connection");
            return false;
        } catch (SQLException e) {
            log.warn("Health check: database unreachable: {}", e.toString());
            return false;
        }
    }

    private boolean redisUp() {
        try (RedisConnection connection = redis.getConnection()) {
            if ("PONG".equalsIgnoreCase(connection.ping())) return true;
            log.warn("Health check: redis did not answer PING");
            return false;
        } catch (RuntimeException e) {
            log.warn("Health check: redis unreachable: {}", e.toString());
            return false;
        }
    }
}