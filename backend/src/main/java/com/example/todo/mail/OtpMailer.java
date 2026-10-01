package com.example.todo.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/** Sends one-time password reset codes over SMTP (Brevo in production). */
@Component
public class OtpMailer {

    private static final Logger log = LoggerFactory.getLogger(OtpMailer.class);

    private final JavaMailSender sender;
    private final AppMailProperties props;

    public OtpMailer(JavaMailSender sender, AppMailProperties props) {
        this.sender = sender;
        this.props = props;
    }

    public void sendPasswordResetCode(String to, String code, Duration validFor) {
        if (props.from().isBlank()) {
            throw new EmailDeliveryException("Email isn't set up on the server yet (MAIL_FROM is missing).", null);
        }
        long minutes = Math.max(1, validFor.toMinutes());
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(props.from(), props.fromName());
            helper.setTo(to);
            helper.setSubject(code + " is your Tasks verification code");
            helper.setText(plainText(code, minutes), html(code, minutes));
            sender.send(message);
            log.info("Sent password reset code to {}", to);
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            log.error("Could not send password reset code to {}: {}", to, e.getMessage());
            throw new EmailDeliveryException("We couldn't send the email. Please try again in a moment.", e);
        }
    }

    private static String plainText(String code, long minutes) {
        return """
                Your verification code is: %s

                Enter it in Tasks to reset your password. It expires in %d minutes.

                If you didn't ask to reset your password, you can ignore this email; \
                your password won't change.
                """.formatted(code, minutes);
    }

    private static String html(String code, long minutes) {
        String safeCode = HtmlUtils.htmlEscape(code);
        return """
                <!doctype html>
                <html>
                <body style="margin:0;padding:0;background:#f6f6f6;">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:32px 16px;">
                    <tr><td align="center">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0"
                             style="max-width:440px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;
                                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717;">
                        <tr><td style="padding:32px 32px 8px;">
                          <p style="margin:0 0 4px;font-size:14px;color:#737373;">Tasks</p>
                          <h1 style="margin:0;font-size:20px;font-weight:600;">Your verification code</h1>
                        </td></tr>
                        <tr><td style="padding:16px 32px;">
                          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#404040;">
                            Enter this code to reset your password. It expires in %d minutes.
                          </p>
                          <div style="font-size:32px;font-weight:600;letter-spacing:8px;font-family:ui-monospace,Menlo,Consolas,monospace;
                                      background:#f5f5f5;border-radius:8px;padding:16px;text-align:center;">%s</div>
                        </td></tr>
                        <tr><td style="padding:8px 32px 32px;">
                          <p style="margin:0;font-size:13px;line-height:1.5;color:#737373;">
                            If you didn't ask to reset your password, you can ignore this email. Your password won't change.
                          </p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(minutes, safeCode);
    }
}
