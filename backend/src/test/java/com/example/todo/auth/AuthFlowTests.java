package com.example.todo.auth;

import com.example.todo.support.IntegrationTest;
import com.example.todo.support.SessionCookies;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static com.example.todo.support.IntegrationTest.EMAIL;
import static com.example.todo.support.IntegrationTest.PASSWORD;
import static com.example.todo.support.SessionCookies.loginJson;
import static com.example.todo.support.SessionCookies.sessionId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Session login flow (never modifies todos). */
@IntegrationTest
class AuthFlowTests {

    @Autowired
    MockMvc mvc;

    @Autowired
    FindByIndexNameSessionRepository<? extends Session> sessions;

    @Test
    void todosRequireLogin() throws Exception {
        mvc.perform(get("/api/todos")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void wrongPasswordIsRejectedWithGenericMessage() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(EMAIL, "wrong")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Incorrect email or password"));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("nobody@example.com", PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Incorrect email or password"));
    }

    @Test
    void blankFieldsFailValidation() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("", "")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginStoresSessionInRedis_cookieOnly_untilLogout() throws Exception {
        // Email is case-insensitive and trimmed
        MvcResult login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("  Tester@Example.com ", PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andReturn();

        Cookie cookie = login.getResponse().getCookie(SessionCookies.NAME);
        assertThat(cookie).isNotNull();
        String setCookie = login.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("HttpOnly").contains("SameSite=Lax");
        // No token anywhere in the response
        assertThat(login.getResponse().getContentAsString()).doesNotContainIgnoringCase("token");
        assertThat(login.getResponse().getHeader("Authorization")).isNull();

        // The session lives in Redis, indexed by the user's email
        String id = sessionId(cookie);
        assertThat(sessions.findById(id)).isNotNull();
        assertThat(sessions.findByPrincipalName(EMAIL)).containsKey(id);

        mvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(EMAIL));
        mvc.perform(get("/api/todos").cookie(cookie)).andExpect(status().isOk());

        mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());
        assertThat(sessions.findById(id)).as("session removed from Redis").isNull();
        mvc.perform(get("/api/todos").cookie(cookie)).andExpect(status().isUnauthorized());
    }

    @Test
    void sessionIdChangesOnLogin() throws Exception {
        Cookie first = SessionCookies.login(mvc);
        // Signing in again from an existing session must not keep the old id (session fixation)
        Cookie second = SessionCookies.login(mvc, EMAIL, PASSWORD, first);
        assertThat(sessionId(second)).isNotEqualTo(sessionId(first));
        assertThat(sessions.findById(sessionId(first))).isNull();
    }

    @Test
    void logoutOnlyAcceptsPost() throws Exception {
        mvc.perform(get("/api/auth/logout")).andExpect(status().isUnauthorized());
    }
}
