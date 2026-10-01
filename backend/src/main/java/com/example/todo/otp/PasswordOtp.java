package com.example.todo.otp;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "password_otp")
public class PasswordOtp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    /** Hex SHA-256 of the code; the code itself is never stored */
    @Column(name = "code_hash", nullable = false, length = 64, updatable = false)
    private String codeHash;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PasswordOtp() {
    }

    PasswordOtp(Long userId, String codeHash, Instant createdAt, Instant expiresAt) {
        this.userId = userId;
        this.codeHash = codeHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    boolean isExpired(Instant now) { return !now.isBefore(expiresAt); }
    void recordFailedAttempt() { attempts++; }
    void consume(Instant now) { consumedAt = now; }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    String getCodeHash() { return codeHash; }
    public Instant getExpiresAt() { return expiresAt; }
    public int getAttempts() { return attempts; }
    public Instant getConsumedAt() { return consumedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
