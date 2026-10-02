package com.example.todo.account;

import com.example.todo.otp.PasswordOtpRepository;
import com.example.todo.support.IntegrationTest;
import com.example.todo.support.MutableClock;
import com.example.todo.support.TestSupportConfiguration.CapturingOtpMailer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import jakarta.servlet.http.Cookie;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import com.example.todo.support.SessionCookies;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;

import static com.example.todo.support.IntegrationTest.EMAIL;
import static com.example.todo.support.IntegrationTest.PASSWORD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class PasswordResetTests {

    private static final String NEW_PASSWORD = "brand-new-pass-42";

    @Autowired MockMvc mvc;
    @Autowired CapturingOtpMailer mailer;
    @Autowired MutableClock clock;
    @Autowired AppUserRepository users;
    @Autowired PasswordOtpRepository otps;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @Autowired FindByIndexNameSessionRepository<? extends Session> sessions;

    @BeforeEach
    void setUp() {
        clock.reset();
        mailer.clear();
        otps.deleteAll();
    }

    /** Put the account back exactly as other test classes expect it */
    @AfterEach
    void restoreAccount() {
        otps.deleteAll();
        AppUser user = users.findByEmailIgnoreCase(EMAIL).orElseThrow();
        user.changePassword(encoder.encode(PASSWORD), Instant.now());
        users.save(user);
        clock.reset();
    }

    // ------------------------------------------------------------------ helpers

    private Cookie login(String password) throws Exception {
        return SessionCookies.login(mvc, EMAIL, password);
    }

    private int loginStatus(String password) throws Exception {
        return mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(EMAIL, password)))
                .andReturn().getResponse().getStatus();
    }

    private ResultActions sendCode(Cookie session) throws Exception {
        return mvc.perform(post("/api/account/password/code").cookie(session));
    }

    private ResultActions changePassword(Cookie session, String code, String newPassword) throws Exception {
        return mvc.perform(post("/api/account/password").cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"%s\",\"newPassword\":\"%s\"}".formatted(code, newPassword)));
    }

    private ResultActions forgotRequest(String email) throws Exception {
        return mvc.perform(post("/api/auth/password-reset/request")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\"}".formatted(email)));
    }

    private ResultActions forgotConfirm(String email, String code, String newPassword) throws Exception {
        return mvc.perform(post("/api/auth/password-reset/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"code\":\"%s\",\"newPassword\":\"%s\"}".formatted(email, code, newPassword)));
    }

    private static String wrong(String code) {
        return code.equals("000000") ? "111111" : "000000";
    }

    // ------------------------------------------------------------------ Settings (signed in)

    @Test
    void settingsEndpointsRequireLogin() throws Exception {
        mvc.perform(post("/api/account/password/code")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/account")).andExpect(status().isUnauthorized());
        assertThat(mailer.sent()).isEmpty();
    }

    @Test
    void changePasswordWithEmailedCode_signsOutOtherDevicesOnly() throws Exception {
        Cookie thisDevice = login(PASSWORD);
        Cookie otherDevice = login(PASSWORD);

        sendCode(thisDevice)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sentTo").value("t••••r@example.com"))
                .andExpect(jsonPath("$.resendAfterSeconds").value(60))
                .andExpect(jsonPath("$.expiresInMinutes").value(10));
        assertThat(mailer.last().to()).isEqualTo(EMAIL);
        String code = mailer.last().code();
        assertThat(code).matches("\\d{6}");
        // Only a SHA-256 hash is stored, never the code itself
        assertThat(jdbc.queryForList("select code_hash from password_otp", String.class))
                .singleElement()
                .satisfies(hash -> assertThat(hash).hasSize(64).doesNotContain(code));

        changePassword(thisDevice, wrong(code), NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("That code is incorrect. 4 attempts left."));

        changePassword(thisDevice, code, NEW_PASSWORD).andExpect(status().isNoContent());

        mvc.perform(get("/api/todos").cookie(thisDevice)).andExpect(status().isOk());
        mvc.perform(get("/api/todos").cookie(otherDevice)).andExpect(status().isUnauthorized());
        // The other device's session was deleted from Redis, not just flagged
        assertThat(sessions.findById(SessionCookies.sessionId(otherDevice))).isNull();
        assertThat(sessions.findById(SessionCookies.sessionId(thisDevice))).isNotNull();

        assertThat(loginStatus(PASSWORD)).isEqualTo(401);
        assertThat(loginStatus(NEW_PASSWORD)).isEqualTo(200);

        // A code can only be used once
        changePassword(thisDevice, code, "yet-another-pass-1").andExpect(status().isBadRequest());
    }

    @Test
    void resendIsRateLimited_andOnlyNewestCodeWorks() throws Exception {
        Cookie session = login(PASSWORD);
        sendCode(session).andExpect(status().isOk());
        String first = mailer.last().code();

        sendCode(session)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(60));
        assertThat(mailer.sent()).hasSize(1);

        clock.advance(Duration.ofSeconds(61));
        sendCode(session).andExpect(status().isOk());
        String second = mailer.last().code();

        if (!first.equals(second)) {
            changePassword(session, first, NEW_PASSWORD).andExpect(status().isBadRequest());
        }
        changePassword(session, second, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void codeExpiresAfterTenMinutes() throws Exception {
        Cookie session = login(PASSWORD);
        sendCode(session).andExpect(status().isOk());
        String code = mailer.last().code();

        clock.advance(Duration.ofMinutes(10).plusSeconds(1));
        changePassword(session, code, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("That code has expired. Request a new one."));
        assertThat(loginStatus(PASSWORD)).isEqualTo(200);
    }

    @Test
    void codeLocksAfterFiveWrongAttempts() throws Exception {
        Cookie session = login(PASSWORD);
        sendCode(session).andExpect(status().isOk());
        String code = mailer.last().code();

        for (int i = 0; i < 4; i++) {
            changePassword(session, wrong(code), NEW_PASSWORD).andExpect(status().isBadRequest());
        }
        changePassword(session, wrong(code), NEW_PASSWORD)
                .andExpect(jsonPath("$.detail").value("Too many wrong attempts. Request a new code."));
        // Even the right code no longer works
        changePassword(session, code, NEW_PASSWORD).andExpect(status().isBadRequest());
        assertThat(loginStatus(PASSWORD)).isEqualTo(200);
    }

    @Test
    void weakOrUnchangedPasswordIsRejected_withoutUsingUpTheCode() throws Exception {
        Cookie session = login(PASSWORD);
        sendCode(session).andExpect(status().isOk());
        String code = mailer.last().code();

        changePassword(session, code, "short")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Use at least 8 characters."));
        changePassword(session, code, PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Choose a password that's different from your current one."));
        changePassword(session, code, EMAIL)
                .andExpect(jsonPath("$.detail").value("Your password can't be your email address."));

        // The code is still good after those rejections
        changePassword(session, code, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    // ------------------------------------------------------------------ Forgot password (signed out)

    @Test
    void forgotPassword_looksTheSameForUnknownEmails() throws Exception {
        forgotRequest("someone-else@example.com")
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.sentTo").doesNotExist());
        Thread.sleep(300);
        assertThat(mailer.sent()).isEmpty();
        assertThat(otps.count()).isZero();
    }

    @Test
    void forgotPassword_resetsWithCode_andSignsOutEverywhere() throws Exception {
        Cookie existing = login(PASSWORD);

        forgotRequest("  Tester@Example.com ").andExpect(status().isAccepted());
        await().atMost(Duration.ofSeconds(5)).until(() -> mailer.last() != null);
        String code = mailer.last().code();

        // Asking again too soon still answers 202 (nothing is revealed) but sends nothing new
        forgotRequest(EMAIL).andExpect(status().isAccepted());
        Thread.sleep(300);
        assertThat(mailer.sent()).hasSize(1);

        forgotConfirm("someone-else@example.com", code, NEW_PASSWORD).andExpect(status().isBadRequest());
        forgotConfirm(EMAIL, code, NEW_PASSWORD).andExpect(status().isNoContent());

        mvc.perform(get("/api/todos").cookie(existing)).andExpect(status().isUnauthorized());
        assertThat(sessions.findByPrincipalName(EMAIL)).as("all sessions deleted").isEmpty();
        assertThat(loginStatus(PASSWORD)).isEqualTo(401);
        assertThat(loginStatus(NEW_PASSWORD)).isEqualTo(200);
    }

    @Test
    void forgotPasswordEndpointsArePublicButValidated() throws Exception {
        forgotRequest("").andExpect(status().isBadRequest());
        forgotConfirm(EMAIL, "", "").andExpect(status().isBadRequest());
    }
}
