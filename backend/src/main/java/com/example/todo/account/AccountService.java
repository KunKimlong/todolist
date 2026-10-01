package com.example.todo.account;

import com.example.todo.auth.SessionTerminator;
import com.example.todo.mail.OtpMailer;
import com.example.todo.otp.OtpExceptions.InvalidOtpException;
import com.example.todo.otp.OtpExceptions.OtpRateLimitException;
import com.example.todo.otp.OtpService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskExecutor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.Locale;

/** Password resets for the login account, confirmed with an emailed one-time code. */
@Service
public class AccountService {

    public record CodeSent(String sentTo, long resendAfterSeconds, long expiresInMinutes) {
    }

    public static class PasswordPolicyException extends RuntimeException {
        public PasswordPolicyException(String message) {
            super(message);
        }
    }

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final AppUserRepository users;
    private final OtpService otp;
    private final OtpMailer mailer;
    private final PasswordEncoder encoder;
    private final SessionTerminator sessions;
    private final TaskExecutor taskExecutor;
    private final Clock clock;

    public AccountService(AppUserRepository users, OtpService otp, OtpMailer mailer, PasswordEncoder encoder,
                          SessionTerminator sessions, TaskExecutor taskExecutor, Clock clock) {
        this.users = users;
        this.otp = otp;
        this.mailer = mailer;
        this.encoder = encoder;
        this.sessions = sessions;
        this.taskExecutor = taskExecutor;
        this.clock = clock;
    }

    public AppUser get(String email) {
        return users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalStateException("Signed-in account no longer exists"));
    }

    // ---------------------------------------------------------------- signed in (Settings)

    /** Emails a code to the signed-in user. Sent synchronously so mail errors reach the UI. */
    @Transactional
    public CodeSent sendResetCode(String email) {
        AppUser user = get(email);
        OtpService.IssuedOtp issued = otp.issue(user.getId());
        // If sending fails, the exception rolls back the new code (and its resend wait)
        mailer.sendPasswordResetCode(user.getEmail(), issued.code(), otp.properties().ttl());
        return codeSent(user.getEmail());
    }

    /** Changes the password and signs out every other session of this user. */
    @Transactional
    public void changePassword(String email, String code, String newPassword, String currentSessionId) {
        AppUser user = get(email);
        checkPolicy(user, newPassword);
        otp.verifyAndConsume(user.getId(), code);
        user.changePassword(encoder.encode(newPassword), clock.instant());
        int ended = sessions.expireSessions(user.getEmail(), currentSessionId);
        log.info("Password changed for {}; signed out {} other session(s)", user.getEmail(), ended);
    }

    // ---------------------------------------------------------------- signed out (Forgot password)

    /**
     * Always looks the same to the caller whether or not the email matches the account,
     * so it can't be used to discover the email. Mail is sent in the background for the
     * same reason (no timing difference).
     */
    @Transactional
    public CodeSent requestForgotPasswordCode(String email) {
        String normalized = normalize(email);
        users.findByEmailIgnoreCase(normalized).ifPresent(user -> {
            try {
                OtpService.IssuedOtp issued = otp.issue(user.getId());
                Duration ttl = otp.properties().ttl();
                taskExecutor.execute(() -> {
                    try {
                        mailer.sendPasswordResetCode(user.getEmail(), issued.code(), ttl);
                    } catch (RuntimeException e) {
                        log.warn("Forgot-password email to {} failed: {}", user.getEmail(), e.getMessage());
                    }
                });
            } catch (OtpRateLimitException e) {
                // Silently ignored: the response must not reveal that this email exists
                log.info("Forgot-password code for {} not sent: {}", user.getEmail(), e.getMessage());
            }
        });
        return new CodeSent(null, otp.properties().resendAfter().toSeconds(), otp.properties().ttl().toMinutes());
    }

    @Transactional
    public void resetForgottenPassword(String email, String code, String newPassword) {
        AppUser user = users.findByEmailIgnoreCase(normalize(email))
                .orElseThrow(() -> new InvalidOtpException("That code is incorrect or has expired. Request a new one."));
        checkPolicy(user, newPassword);
        otp.verifyAndConsume(user.getId(), code);
        user.changePassword(encoder.encode(newPassword), clock.instant());
        int ended = sessions.expireSessions(user.getEmail(), null);
        log.info("Password reset (forgot password) for {}; signed out {} session(s)", user.getEmail(), ended);
    }

    // ----------------------------------------------------------------

    private CodeSent codeSent(String email) {
        return new CodeSent(maskEmail(email), otp.properties().resendAfter().toSeconds(),
                otp.properties().ttl().toMinutes());
    }

    private void checkPolicy(AppUser user, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new PasswordPolicyException("Use at least 8 characters.");
        }
        if (newPassword.length() > 128) {
            throw new PasswordPolicyException("Use 128 characters or fewer.");
        }
        if (newPassword.equalsIgnoreCase(user.getEmail())) {
            throw new PasswordPolicyException("Your password can't be your email address.");
        }
        if (encoder.matches(newPassword, user.getPasswordHash())) {
            throw new PasswordPolicyException("Choose a password that's different from your current one.");
        }
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    /** me@gmail.com -> m•@gmail.com, kimlong@x.com -> k•••••g@x.com */
    static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 0) return email;
        String local = email.substring(0, at);
        String masked = local.length() <= 2
                ? local.charAt(0) + "•"
                : local.charAt(0) + "•".repeat(local.length() - 2) + local.charAt(local.length() - 1);
        return masked + email.substring(at);
    }
}
