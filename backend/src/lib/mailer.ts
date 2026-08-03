import { Resend } from "resend";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

/**
 * Transactional email.
 *
 * Behind an interface with two drivers: Resend in production, and a console
 * driver for local development that prints the link instead of sending. That
 * way the verification flow is fully exercisable without an API key, and
 * swapping providers later touches one file.
 */

export interface Mailer {
  readonly name: string;
  send(message: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

class ConsoleMailer implements Mailer {
  readonly name = "console";

  async send(message: { to: string; subject: string; text: string }): Promise<void> {
    logger.info("Email (console driver — not actually sent)", {
      to: message.to,
      subject: message.subject,
      body: message.text,
    });
  }
}

class ResendMailer implements Mailer {
  readonly name = "resend";
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    const { error } = await this.client.emails.send({
      from: config.mail.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (error) {
      // Surfaced to the caller so, for example, registration can still succeed
      // while telling the user to request another verification email.
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (!mailer) {
    mailer = config.mail.resendApiKey
      ? new ResendMailer(config.mail.resendApiKey)
      : new ConsoleMailer();

    if (mailer.name === "console" && !config.isTest) {
      logger.warn("No RESEND_API_KEY set — verification emails will be logged, not sent");
    }
  }
  return mailer;
}

/** Test seam. */
export function __setMailer(next: Mailer | null): void {
  mailer = next;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function layout(heading: string, body: string, cta?: { url: string; label: string }): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
    <div style="font-weight:700;font-size:20px;margin-bottom:24px">DojoPay</div>
    <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
    <div style="font-size:14px;line-height:1.6;color:#4b5563">${body}</div>
    ${
      cta
        ? `<a href="${cta.url}" style="display:inline-block;margin-top:24px;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">${cta.label}</a>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px;word-break:break-all">Or paste this into your browser:<br>${cta.url}</p>`
        : ""
    }
  </div>
</body></html>`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${config.mail.appUrl}/auth/verify?token=${encodeURIComponent(token)}`;

  await getMailer().send({
    to,
    subject: "Verify your DojoPay email",
    html: layout(
      "Confirm your email address",
      `<p>Verify this address to secure your DojoPay account and enable withdrawals.</p>
       <p>This link expires in ${config.auth.emailTokenTtlMinutes} minutes.</p>`,
      { url, label: "Verify email" },
    ),
    text: `Verify your DojoPay email address: ${url}\n\nThis link expires in ${config.auth.emailTokenTtlMinutes} minutes.`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${config.mail.appUrl}/auth/reset?token=${encodeURIComponent(token)}`;

  await getMailer().send({
    to,
    subject: "Reset your DojoPay password",
    html: layout(
      "Reset your password",
      `<p>Someone asked to reset the password on this account. If that was not you, ignore this email — nothing changes until the link is used.</p>
       <p>This link expires in ${config.auth.emailTokenTtlMinutes} minutes and can only be used once.</p>`,
      { url, label: "Reset password" },
    ),
    text: `Reset your DojoPay password: ${url}\n\nIf you did not request this, ignore this email.`,
  });
}

/** Sent when an admin suspends an account, so the person is not left guessing. */
export async function sendAccountSuspendedEmail(to: string, reason: string): Promise<void> {
  await getMailer().send({
    to,
    subject: "Your DojoPay account has been suspended",
    html: layout(
      "Account suspended",
      `<p>Your DojoPay account has been suspended and cannot currently post or complete tasks.</p>
       <p><strong>Reason:</strong> ${reason}</p>
       <p>Any balance you have already earned is unaffected. Reply to this email if you think this is a mistake.</p>`,
    ),
    text: `Your DojoPay account has been suspended.\n\nReason: ${reason}\n\nYour existing balance is unaffected.`,
  });
}
