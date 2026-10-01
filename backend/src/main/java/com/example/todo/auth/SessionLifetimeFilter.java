package com.example.todo.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Ends a session a fixed time after sign-in, however active it is. The idle timeout
 * (spring.session.timeout) only ends sessions that go unused; this caps how
 * long a leaked session cookie could ever be used.
 */
public class SessionLifetimeFilter extends OncePerRequestFilter {

    /** Session attribute holding the {@link Instant} the user signed in */
    public static final String SIGNED_IN_AT = "todo.signedInAt";

    private final Duration maxLifetime;
    private final Clock clock;

    public SessionLifetimeFilter(Duration maxLifetime, Clock clock) {
        this.maxLifetime = maxLifetime;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session != null
                && session.getAttribute(SIGNED_IN_AT) instanceof Instant signedInAt
                && !clock.instant().isBefore(signedInAt.plus(maxLifetime))) {
            session.invalidate();
            SecurityContextHolder.clearContext();
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write(
                    "{\"status\":401,\"title\":\"Unauthorized\",\"detail\":\"Your session expired. Please sign in again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
