package com.example.todo.mail;

/** Mail could not be sent (not configured, or the SMTP server refused it). */
public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
