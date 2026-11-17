"""SMTP email delivery service with safe no-op fallback."""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_email(
    to_email: str, subject: str, text_content: str, html_content: str, reply_to: str | None = None
) -> None:
    """
    Deliver an email via configured SMTP.
    If EMAIL_USER or EMAIL_PASS is empty, logs 'email not sent' and returns safely without raising.
    """
    settings = get_settings()

    if not settings.EMAIL_USER or not settings.EMAIL_PASS:
        logger.warning("email not sent: SMTP credentials empty in configuration.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_USER
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASS)
            server.send_message(msg)

        logger.info("Email '%s' to %s sent successfully.", subject, to_email)
    except Exception as e:
        logger.error("email not sent: SMTP delivery failed for %s: %s", to_email, e)


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Deliver a password reset link to an admin."""
    subject = "[Portfolio Admin] Password Reset Request"
    text = (
        f"A password reset was requested for your portfolio admin account.\n\n"
        f"Reset your password by visiting:\n{reset_link}\n\n"
        f"This link expires in 30 minutes. If you did not request this, please ignore this email."
    )
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.5; color: #222;">
  <h2>Password Reset Request</h2>
  <p>A password reset was requested for your portfolio admin account.</p>
  <p><a href="{reset_link}" style="background-color: #2563eb; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a></p>
  <p>Or copy this link into your browser: <br/><a href="{reset_link}">{reset_link}</a></p>
  <p><small>This link expires in 30 minutes. If you did not request this, please ignore this email.</small></p>
</body>
</html>"""
    send_email(to_email, subject, text, html)
