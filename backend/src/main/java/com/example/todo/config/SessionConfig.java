package com.example.todo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.data.redis.config.ConfigureRedisAction;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/**
 * The session cookie, set explicitly so its security flags never depend on how the
 * app is started. Sessions themselves are stored in Redis by Spring Session.
 */
@Configuration
public class SessionConfig {

    /**
     * Don't run CONFIG SET notify-keyspace-events at startup: managed Redis (Render Key
     * Value and most hosted ones) forbids CONFIG, which would stop the app from starting.
     * Sessions still expire through their TTL.
     */
    @Bean
    ConfigureRedisAction configureRedisAction() {
        return ConfigureRedisAction.NO_OP;
    }

    @Bean
    CookieSerializer cookieSerializer(@Value("${app.session.cookie-name}") String name,
                                      @Value("${app.session.cookie-secure}") boolean secure) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName(name);
        serializer.setCookiePath("/");
        // JavaScript can't read it, so an XSS bug can't steal the session
        serializer.setUseHttpOnlyCookie(true);
        // Browsers don't send it with cross-site POST/PUT/DELETE requests (CSRF protection)
        serializer.setSameSite("Lax");
        // HTTPS-only; turn on when the app is served over HTTPS
        serializer.setUseSecureCookie(secure);
        return serializer;
    }
}
