package com.example.todo.support;

import com.example.todo.mail.AppMailProperties;
import com.example.todo.mail.OtpMailer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSender;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Shared test setup: throwaway Postgres and Redis containers (never the real ones),
 * a mailer that captures codes instead of sending them, and a clock tests can move.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestSupportConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer("postgres:17-alpine");
    }

    /** Throwaway Redis for sessions (never the real todo-redis) */
    @Bean
    @ServiceConnection(name = "redis")
    GenericContainer<?> redis() {
        return new GenericContainer<>(DockerImageName.parse("redis:8-alpine")).withExposedPorts(6379);
    }

    @Bean
    @Primary
    CapturingOtpMailer capturingOtpMailer(JavaMailSender sender, AppMailProperties props) {
        return new CapturingOtpMailer(sender, props);
    }

    @Bean
    @Primary
    MutableClock mutableClock() {
        return new MutableClock();
    }

    /** Records codes instead of talking to an SMTP server. */
    public static class CapturingOtpMailer extends OtpMailer {
        public record SentCode(String to, String code) {
        }

        private final java.util.concurrent.CopyOnWriteArrayList<SentCode> sent = new java.util.concurrent.CopyOnWriteArrayList<>();

        CapturingOtpMailer(JavaMailSender sender, AppMailProperties props) {
            super(sender, props);
        }

        @Override
        public void sendPasswordResetCode(String to, String code, java.time.Duration validFor) {
            sent.add(new SentCode(to, code));
        }

        public java.util.List<SentCode> sent() {
            return sent;
        }

        public SentCode last() {
            return sent.isEmpty() ? null : sent.get(sent.size() - 1);
        }

        public void clear() {
            sent.clear();
        }
    }
}
