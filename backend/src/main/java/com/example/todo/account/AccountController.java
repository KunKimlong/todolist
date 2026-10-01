package com.example.todo.account;

import com.example.todo.account.AccountService.CodeSent;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/** Settings for the signed-in user. */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    public record AccountResponse(String email, String passwordChangedAt) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Enter the code from the email") @Size(max = 12) String code,
            @NotBlank(message = "Enter a new password") @Size(max = 128) String newPassword
    ) {
    }

    private final AccountService accounts;

    public AccountController(AccountService accounts) {
        this.accounts = accounts;
    }

    @GetMapping
    public AccountResponse get(@AuthenticationPrincipal UserDetails principal) {
        AppUser user = accounts.get(principal.getUsername());
        return new AccountResponse(user.getEmail(), user.getPasswordChangedAt().toString());
    }

    @PostMapping("/password/code")
    public CodeSent sendCode(@AuthenticationPrincipal UserDetails principal) {
        return accounts.sendResetCode(principal.getUsername());
    }

    @PostMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal UserDetails principal,
                               @Valid @RequestBody ChangePasswordRequest body,
                               HttpServletRequest request) {
        accounts.changePassword(principal.getUsername(), body.code(), body.newPassword(),
                request.getSession().getId());
    }
}
