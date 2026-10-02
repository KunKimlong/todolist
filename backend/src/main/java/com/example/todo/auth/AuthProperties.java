package com.example.todo.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * The single account allowed to use the app.
 *
 * @param email    login email
 * @param password either plain text (hashed with bcrypt at startup) or an already
 *                 encoded value such as {@code {bcrypt}$2a$10$...}
 */
@Validated
@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        @NotBlank @Email String email,
        @NotBlank String password
) {
}
