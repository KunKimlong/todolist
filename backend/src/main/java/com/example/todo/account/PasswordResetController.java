package com.example.todo.account;

import com.example.todo.account.AccountService.CodeSent;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** "Forgot password" for people who can't sign in. Public endpoints. */
@RestController
@RequestMapping("/api/auth/password-reset")
public class PasswordResetController {

    public record ResetRequest(
            @NotBlank(message = "Enter your email") @Size(max = 254) String email
    ) {
    }

    public record ResetConfirm(
            @NotBlank(message = "Enter your email") @Size(max = 254) String email,
            @NotBlank(message = "Enter the code from the email") @Size(max = 12) String code,
            @NotBlank(message = "Enter a new password") @Size(max = 128) String newPassword
    ) {
    }

    private final AccountService accounts;

    public PasswordResetController(AccountService accounts) {
        this.accounts = accounts;
    }

    /** Same 202 response whether or not the email belongs to the account. */
    @PostMapping("/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public CodeSent request(@Valid @RequestBody ResetRequest body) {
        return accounts.requestForgotPasswordCode(body.email());
    }

    @PostMapping("/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirm(@Valid @RequestBody ResetConfirm body) {
        accounts.resetForgottenPassword(body.email(), body.code(), body.newPassword());
    }
}
