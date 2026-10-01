package com.example.todo.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Full application on a throwaway Postgres container. Every test class uses the same
 * settings so they share one Spring context (and one container).
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(properties = {
        "app.auth.email=" + IntegrationTest.EMAIL,
        "app.auth.password=" + IntegrationTest.PASSWORD,
        "app.mail.from=tasks@test.local"
})
@AutoConfigureMockMvc
@Import(TestSupportConfiguration.class)
public @interface IntegrationTest {
    String EMAIL = "tester@example.com";
    String PASSWORD = "correct-horse";
}
