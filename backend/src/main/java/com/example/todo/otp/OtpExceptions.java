package com.example.todo.otp;

/** Errors raised while issuing or checking one-time codes. */
public final class OtpExceptions {

    private OtpExceptions() {
    }

    /** Wrong, expired, already used or locked code. Message is safe to show the user. */
    public static class InvalidOtpException extends RuntimeException {
        public InvalidOtpException(String message) {
            super(message);
        }
    }

    /** A new code was requested too soon. */
    public static class OtpRateLimitException extends RuntimeException {
        private final long retryAfterSeconds;

        public OtpRateLimitException(String message, long retryAfterSeconds) {
            super(message);
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }
    }
}
