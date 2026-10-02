package com.example.todo.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Sender details for outgoing mail. The SMTP server itself (Brevo by default) is
 * configured with the standard {@code spring.mail.*} properties.
 *
 * @param from     sender address; with Brevo it must be a verified sender
 * @param fromName display name shown in the inbox
 */
@ConfigurationProperties(prefix = "app.mail")
public record AppMailProperties(
        @DefaultValue("") String from,
        @DefaultValue("Tasks") String fromName
) {
}
