package com.example.todo.common;

import com.example.todo.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static com.example.todo.support.SessionCookies.NAME;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** GET /health: public, dependency-aware, and never starts a session. */
@IntegrationTest
class HealthTests {

    @Autowired
    MockMvc mvc;

    @Test
    void reportsDatabaseAndRedisWithoutAskingForASession() throws Exception {
        mvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("UP"))
                .andExpect(jsonPath("$.redis").value("UP"))
                .andExpect(result -> assertThat(result.getResponse().getCookie(NAME))
                        .as("health check must not create a session").isNull());
    }
}