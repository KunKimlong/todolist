package com.example.todo.auth;

import com.example.todo.support.IntegrationTest;
import com.example.todo.support.MutableClock;
import com.example.todo.support.SessionCookies;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;

import static com.example.todo.support.SessionCookies.sessionId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class SessionLifetimeTests {

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired Environment env;
    @Autowired FindByIndexNameSessionRepository<? extends Session> sessions;

    @BeforeEach
    @AfterEach
    void resetClock() {
        clock.reset();
    }

    @Test
    void sessionEndsEightHoursAfterSignIn_evenIfActive() throws Exception {
        Cookie cookie = SessionCookies.login(mvc);

        // Busy all day: a request every hour keeps it alive...
        for (int hour = 1; hour < 8; hour++) {
            clock.advance(Duration.ofHours(1));
            mvc.perform(get("/api/todos").cookie(cookie)).andExpect(status().isOk());
        }
        clock.advance(Duration.ofMinutes(59));
        mvc.perform(get("/api/todos").cookie(cookie)).andExpect(status().isOk());

        // ...but not past 8 hours
        clock.advance(Duration.ofMinutes(1));
        mvc.perform(get("/api/todos").cookie(cookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Your session expired. Please sign in again."));
        assertThat(sessions.findById(sessionId(cookie))).as("deleted from Redis").isNull();

        // Signing in again starts a fresh 8 hours
        Cookie fresh = SessionCookies.login(mvc);
        mvc.perform(get("/api/todos").cookie(fresh)).andExpect(status().isOk());
    }

    @Test
    void limitsAreThirtyMinutesIdleAndEightHoursTotal() {
        assertThat(env.getProperty("spring.session.timeout", Duration.class)).isEqualTo(Duration.ofMinutes(30));
        assertThat(env.getProperty("app.session.max-lifetime", Duration.class)).isEqualTo(Duration.ofHours(8));
    }

    @Test
    void redisSessionUsesThirtyMinuteIdleTimeout() throws Exception {
        Cookie cookie = SessionCookies.login(mvc);
        Session session = sessions.findById(sessionId(cookie));
        assertThat(session.getMaxInactiveInterval()).isEqualTo(Duration.ofMinutes(30));
    }
}
