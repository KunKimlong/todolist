package com.example.todo.otp;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasswordOtpRepository extends JpaRepository<PasswordOtp, Long> {

    Optional<PasswordOtp> findFirstByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<PasswordOtp> findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(Long userId);

    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);

    /** Retire every unused code so only the newest one can ever be used */
    @Modifying
    @Query("update PasswordOtp o set o.consumedAt = :now where o.userId = :userId and o.consumedAt is null")
    int consumeAllActive(@Param("userId") Long userId, @Param("now") Instant now);
}
