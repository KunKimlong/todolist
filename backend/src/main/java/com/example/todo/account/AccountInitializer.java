package com.example.todo.account;

import com.example.todo.auth.AuthProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Locale;

/**
 * Makes sure the single login account exists.
 * <ul>
 *   <li>First start: creates it from {@code app.auth.email} / {@code app.auth.password}.</li>
 *   <li>Later starts: keeps the stored password (it may have been changed in the app)
 *       and only updates the email if {@code app.auth.email} was changed.</li>
 * </ul>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AccountInitializer implements ApplicationRunner {

    public static final String DEFAULT_PASSWORD = "changeme123";
    private static final Logger log = LoggerFactory.getLogger(AccountInitializer.class);

    private final AppUserRepository users;
    private final AuthProperties props;
    private final PasswordEncoder encoder;
    private final Clock clock;

    public AccountInitializer(AppUserRepository users, AuthProperties props, PasswordEncoder encoder, Clock clock) {
        this.users = users;
        this.props = props;
        this.encoder = encoder;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String email = props.email().trim().toLowerCase(Locale.ROOT);

        AppUser user = users.findFirstByOrderByIdAsc().orElse(null);
        if (user == null) {
            String password = props.password();
            String hash = password.startsWith("{") ? password : encoder.encode(password);
            user = users.save(new AppUser(email, hash, clock.instant()));
            log.info("Created login account {}", email);
        } else if (!user.getEmail().equals(email)) {
            log.info("Login email changed from {} to {}", user.getEmail(), email);
            user.setEmail(email);
        }

        if (encoder.matches(DEFAULT_PASSWORD, user.getPasswordHash())) {
            log.warn("The login account still uses the default password. Change it in Settings.");
        }
    }
}
