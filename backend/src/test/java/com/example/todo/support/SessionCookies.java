package com.example.todo.support;

import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Sessions live in Redis and are found from the TODO_SESSION cookie, so tests carry
 * that cookie between requests exactly like a browser does.
 */
public final class SessionCookies {

    public static final String NAME = "TODO_SESSION";

    private SessionCookies() {
    }

    public static String loginJson(String email, String password) {
        return "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password);
    }

    /** Signs in (optionally from an existing session) and returns the new session cookie. */
    public static Cookie login(MockMvc mvc, String email, String password, Cookie... existing) throws Exception {
        var request = post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginJson(email, password));
        if (existing.length > 0) request.cookie(existing);
        MvcResult result = mvc.perform(request).andReturn();
        assertThat(result.getResponse().getStatus()).as("login status").isEqualTo(200);
        Cookie cookie = result.getResponse().getCookie(NAME);
        assertThat(cookie).as("session cookie; headers=" + result.getResponse().getHeaderNames().stream()
                .map(h -> h + ": " + result.getResponse().getHeaders(h)).toList()).isNotNull();
        return cookie;
    }

    public static Cookie login(MockMvc mvc) throws Exception {
        return login(mvc, IntegrationTest.EMAIL, IntegrationTest.PASSWORD);
    }

    /** The cookie value is the Base64-encoded session id */
    public static String sessionId(Cookie cookie) {
        return new String(Base64.getDecoder().decode(cookie.getValue()), StandardCharsets.UTF_8);
    }
}
