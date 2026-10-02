package com.example.todo.otp;

import com.example.todo.otp.OtpExceptions.InvalidOtpException;
import com.example.todo.otp.OtpExceptions.OtpRateLimitException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

/**
 * Issues and checks 6-digit one-time codes. Rules:
 * only the newest code works, codes expire, wrong guesses are limited,
 * and new codes can't be requested too often.
 */
@Service
public class OtpService {

    public record IssuedOtp(String code, Instant expiresAt) {
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    private final PasswordOtpRepository repository;
    private final OtpProperties props;
    private final Clock clock;

    public OtpService(PasswordOtpRepository repository, OtpProperties props, Clock clock) {
        this.repository = repository;
        this.props = props;
        this.clock = clock;
    }

    public OtpProperties properties() {
        return props;
    }

    /** Seconds until another code may be requested (0 if allowed now). */
    @Transactional(readOnly = true)
    public long secondsUntilResend(Long userId) {
        Instant now = clock.instant();
        // Round up: 59.4s left is "wait 60s", and a resend is never allowed early
        return repository.findFirstByUserIdOrderByCreatedAtDesc(userId)
                .map(last -> Math.max(0, Math.ceilDiv(
                        Duration.between(now, last.getCreatedAt().plus(props.resendAfter())).toMillis(), 1000L)))
                .orElse(0L);
    }

    // The rate-limit check happens before any write, so it must not doom the caller's transaction
    @Transactional(noRollbackFor = OtpRateLimitException.class)
    public IssuedOtp issue(Long userId) {
        Instant now = clock.instant();

        long wait = secondsUntilResend(userId);
        if (wait > 0) {
            throw new OtpRateLimitException("Please wait " + wait + " seconds before requesting another code.", wait);
        }
        if (repository.countByUserIdAndCreatedAtAfter(userId, now.minus(Duration.ofHours(1))) >= props.maxPerHour()) {
            throw new OtpRateLimitException("Too many codes requested. Please try again in an hour.", 3600);
        }

        repository.consumeAllActive(userId, now);
        String code = "%06d".formatted(RANDOM.nextInt(1_000_000));
        Instant expiresAt = now.plus(props.ttl());
        repository.save(new PasswordOtp(userId, hash(code), now, expiresAt));
        return new IssuedOtp(code, expiresAt);
    }

    /**
     * Checks the code and marks it used. Runs in its own transaction so a failed
     * attempt is recorded even though the caller's work is rolled back.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = InvalidOtpException.class)
    public void verifyAndConsume(Long userId, String code) {
        Instant now = clock.instant();
        PasswordOtp otp = repository.findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(userId)
                .orElseThrow(() -> new InvalidOtpException("That code is incorrect or has expired. Request a new one."));

        if (otp.isExpired(now)) {
            otp.consume(now);
            throw new InvalidOtpException("That code has expired. Request a new one.");
        }
        if (otp.getAttempts() >= props.maxAttempts()) {
            otp.consume(now);
            throw new InvalidOtpException("Too many wrong attempts. Request a new code.");
        }

        String normalized = code == null ? "" : code.replaceAll("\\s", "");
        boolean matches = MessageDigest.isEqual(
                hash(normalized).getBytes(StandardCharsets.US_ASCII),
                otp.getCodeHash().getBytes(StandardCharsets.US_ASCII));
        if (!matches) {
            otp.recordFailedAttempt();
            int left = props.maxAttempts() - otp.getAttempts();
            if (left <= 0) {
                otp.consume(now);
                throw new InvalidOtpException("Too many wrong attempts. Request a new code.");
            }
            throw new InvalidOtpException("That code is incorrect. " + left + (left == 1 ? " attempt" : " attempts") + " left.");
        }
        otp.consume(now);
    }

    static String hash(String code) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
