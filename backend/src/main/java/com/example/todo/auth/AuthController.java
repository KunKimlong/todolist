package com.example.todo.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.util.Locale;

/**
 * Session-based login: a successful login stores the authentication in the
 * HTTP session, and the browser only holds the HttpOnly session cookie.
 * Logout is handled by Spring Security at POST /api/auth/logout.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final Clock clock;
    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();

    public AuthController(AuthenticationManager authenticationManager,
                          SecurityContextRepository securityContextRepository,
                          Clock clock) {
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.clock = clock;
    }

    @PostMapping("/login")
    public CurrentUser login(@Valid @RequestBody LoginRequest body,
                             HttpServletRequest request,
                             HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(
                        body.email().trim().toLowerCase(Locale.ROOT), body.password()));

        // Session fixation protection: never reuse a session id from before login
        HttpSession existing = request.getSession(false);
        if (existing != null) {
            request.changeSessionId();
        }

        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        contextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        // Starts the clock for the absolute session lifetime (SessionLifetimeFilter)
        request.getSession().setAttribute(SessionLifetimeFilter.SIGNED_IN_AT, clock.instant());

        return new CurrentUser(authentication.getName());
    }

    @GetMapping("/me")
    public CurrentUser me(@AuthenticationPrincipal UserDetails user) {
        return new CurrentUser(user.getUsername());
    }
}
