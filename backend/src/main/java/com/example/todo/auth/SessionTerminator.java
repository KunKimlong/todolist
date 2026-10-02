package com.example.todo.auth;

import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Component;

/**
 * Signs a user out of their other devices, e.g. after a password change, by deleting
 * their sessions from Redis. Spring Session indexes every session by the signed-in
 * user's name (their email), so they can be found without scanning.
 */
@Component
public class SessionTerminator {

    private final FindByIndexNameSessionRepository<? extends Session> sessions;

    public SessionTerminator(FindByIndexNameSessionRepository<? extends Session> sessions) {
        this.sessions = sessions;
    }

    /**
     * Deletes every session belonging to {@code email}, except {@code keepSessionId}
     * (pass null to delete all of them). Returns how many were deleted.
     */
    public int expireSessions(String email, String keepSessionId) {
        var ids = sessions.findByPrincipalName(email).keySet().stream()
                .filter(id -> !id.equals(keepSessionId))
                .toList();
        ids.forEach(sessions::deleteById);
        return ids.size();
    }
}
