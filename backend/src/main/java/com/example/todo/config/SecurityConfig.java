package com.example.todo.config;

import com.example.todo.account.AppUserRepository;
import com.example.todo.auth.AuthProperties;
import com.example.todo.auth.SessionLifetimeFilter;
import com.example.todo.mail.AppMailProperties;
import com.example.todo.otp.OtpProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.context.SecurityContextHolderFilter;

import java.time.Clock;
import java.time.Duration;

/**
 * Session-based security for a single account. No tokens: the browser keeps an
 * HttpOnly, SameSite=Lax session cookie; the session itself lives in Redis (Spring Session).
 */
@Configuration
@EnableConfigurationProperties({AuthProperties.class, OtpProperties.class, AppMailProperties.class})
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            SecurityContextRepository securityContextRepository,
                                            Clock clock,
                                            @Value("${app.session.cookie-name}") String sessionCookie,
                                            @Value("${app.session.max-lifetime}") Duration maxLifetime)
            throws Exception {
        http
                // Hard cap on how long any session can live, however active it is
                .addFilterAfter(new SessionLifetimeFilter(maxLifetime, clock), SecurityContextHolderFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/password-reset/request").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/password-reset/confirm").permitAll()
                        // Container healthchecks and load balancers have no session
                        .requestMatchers(HttpMethod.GET, "/health").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                // An API, not a website: answer 401 instead of redirecting to a login page
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .logout(logout -> logout
                        .logoutRequestMatcher(PathPatternRequestMatcher.withDefaults()
                                .matcher(HttpMethod.POST, "/api/auth/logout"))
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT))
                        .invalidateHttpSession(true)
                        .deleteCookies(sessionCookie))
                // Token-free CSRF defence: the session cookie is SameSite=Lax, so browsers
                // never attach it to cross-site POST/PUT/PATCH/DELETE requests.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    /** The account (and its current password hash) is read from the database on each login */
    @Bean
    UserDetailsService userDetailsService(AppUserRepository users) {
        return username -> users.findByEmailIgnoreCase(username.trim())
                .map(u -> User.withUsername(u.getEmail()).password(u.getPasswordHash()).roles("USER").build())
                .orElseThrow(() -> new UsernameNotFoundException("No such account"));
    }

    @Bean
    AuthenticationManager authenticationManager(UserDetailsService users, PasswordEncoder encoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
