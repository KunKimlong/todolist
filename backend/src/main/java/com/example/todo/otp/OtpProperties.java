package com.example.todo.otp;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * @param ttl          how long a code stays valid
 * @param resendAfter  minimum wait before another code can be requested
 * @param maxAttempts  wrong guesses allowed per code before it is locked
 * @param maxPerHour   codes that can be requested per hour
 */
@ConfigurationProperties(prefix = "app.otp")
public record OtpProperties(
        @DefaultValue("10m") Duration ttl,
        @DefaultValue("60s") Duration resendAfter,
        @DefaultValue("5") int maxAttempts,
        @DefaultValue("5") int maxPerHour
) {
}
