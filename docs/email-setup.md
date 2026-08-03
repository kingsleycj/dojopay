# Sending email

DojoPay sends three transactional emails: **verify your address**, **reset your
password**, and **your account has been suspended**. They are not marketing mail —
if one fails to arrive, somebody is locked out of their account and their
earnings.

This guide covers setting that up with Resend, why Resend rather than Nodemailer,
and how to tell whether it is actually working.

---

## Resend or Nodemailer?

**Use Resend.** These are not really alternatives to each other, which is the part
that usually causes confusion:

| | What it is |
|---|---|
| **Nodemailer** | An SMTP *client*. It formats a message and hands it to a mail server. It does not deliver anything itself. |
| **Resend** | A mail *service*. It runs the sending infrastructure, holds the sender reputation, signs your mail, and reports what happened to it. |

So "just use Nodemailer" still leaves the question of which server it talks to.
The usual answer is Gmail SMTP, and that is where it goes wrong: Gmail's SMTP is
for personal correspondence, caps you around 500 messages a day, requires an app
password, and — most importantly — mail sent that way from an app routinely lands
in spam or is dropped outright, because it fails the authentication checks
receiving servers apply to bulk automated mail. A password-reset link in a spam
folder is the same as no password-reset link.

Resend handles SPF and DKIM signing for you, which is what gets mail into an
inbox. The free tier is generous enough for a devnet project (check
[resend.com/pricing](https://resend.com/pricing) for current limits — it was
3,000/month and 100/day at the time of writing).

**When Nodemailer would be the right call:** you already run your own SMTP
infrastructure, your organisation mandates it, or you want zero third-party
vendors. If that changes, swapping is small — see [Using something else](#using-something-else)
at the end.

---

## Step 0 — You do not need any of this to develop

The mailer has two drivers. With no `RESEND_API_KEY` set, DojoPay uses a **console
driver** that prints the email instead of sending it. Every flow works; the links
just arrive in your terminal.

Start the backend without a key and register an account. In the terminal you will
see:

```json
{"level":"info","message":"Email (console driver — not actually sent)",
 "to":"you@example.com","subject":"Verify your DojoPay email",
 "body":"Verify your DojoPay email address: http://localhost:5174/auth/verify?token=..."}
```

Copy that URL into your browser and the verification completes. You only need a
real provider when you want mail to reach an actual inbox.

You will also see this on boot, which is a reminder, not an error:

```
RESEND_API_KEY is not set — emails will be logged, not sent.
```

---

## Step 1 — Create a Resend account and API key

1. Sign up at [resend.com](https://resend.com).
2. Go to **API Keys** → **Create API Key**.
3. Name it something you will recognise later, e.g. `dojopay-local`.
4. Permission: **Sending access** is enough. Do not grant full access to a key
   that will sit in a `.env` file.
5. Copy the key — it starts `re_` and is shown **once**.

Add it to `backend/.env`:

```env
RESEND_API_KEY=re_your_key_here
```

Restart the backend. The boot warning about `RESEND_API_KEY` disappears, which is
how you know the Resend driver is active.

---

## Step 2 — Send your first real email (no domain needed)

Resend gives every account a shared sender, `onboarding@resend.dev`, which is
already the default `MAIL_FROM` in this project. You can send with it immediately.

> **The gotcha that will waste your afternoon:** `onboarding@resend.dev` can only
> deliver to **the email address you signed up to Resend with**. Register a
> DojoPay account with any other address and Resend accepts the request, the logs
> look clean, and nothing ever arrives. That is a restriction on the shared
> sender, not a bug in DojoPay. To email anyone else you must verify a domain —
> Step 3.

Test it: register a DojoPay account using your Resend signup email. The
verification mail should arrive within seconds. Check Resend's **Logs** tab to see
the delivery recorded.

---

## Step 3 — Verify a domain (required to email real users)

This is the step that decides whether your mail lands in inboxes.

1. In Resend, go to **Domains** → **Add Domain**.
2. Enter a domain you control, e.g. `dojopay.io`. A subdomain such as
   `mail.dojopay.io` is a good choice — it keeps sending reputation separate from
   your main domain, so a bad sending run cannot hurt normal company email.
3. Resend shows a set of DNS records. Add each one at your DNS provider
   (Cloudflare, Namecheap, Vercel, wherever the domain is managed). There will be:

   - a **DKIM** record — cryptographically signs your mail so receivers can prove
     it really came from you and was not modified;
   - an **SPF** record — declares that Resend is allowed to send on your behalf;
   - an **MX** record on the sending subdomain, so bounces come back.

   Copy them exactly from the dashboard. Do not retype them; a single wrong
   character silently fails verification.

4. Click **Verify**. DNS usually propagates in minutes but can take up to 48
   hours. Resend will show the domain as **Verified** when it is done.

5. Point `MAIL_FROM` at an address on that domain:

```env
MAIL_FROM="DojoPay <noreply@mail.dojopay.io>"
```

The address **must** be on a verified domain. Setting `MAIL_FROM` to a domain
Resend has not verified makes every send fail.

### Optional but recommended: DMARC

Once SPF and DKIM pass, add a DMARC record. It tells receiving servers what to do
with mail that fails those checks, and it is increasingly required — Gmail and
Yahoo now expect it from bulk senders. Start in monitor-only mode:

```
Name:  _dmarc.mail.dojopay.io
Type:  TXT
Value: v=DMARC1; p=none; rua=mailto:you@dojopay.io
```

`p=none` means "do not reject anything, just report". Once the reports look clean
for a few weeks, tighten to `p=quarantine`.

---

## Step 4 — Configure production

On Render, set the same variables under **Environment**:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | a **separate** key from your local one, e.g. `dojopay-production` |
| `MAIL_FROM` | `DojoPay <noreply@mail.yourdomain.com>` |
| `FRONTEND_URL` | `https://your-app.vercel.app` |

Use a different API key per environment. If a key leaks you can revoke it without
taking down the other, and Resend's logs will tell you which environment sent
what.

**`FRONTEND_URL` matters more than it looks.** Every link in every email is built
from it:

```
{FRONTEND_URL}/auth/verify?token=...
{FRONTEND_URL}/auth/reset?token=...
```

If it is unset or still points at `localhost`, your production emails will contain
links to `localhost:5174` and nobody will be able to verify anything.

The server does **not** refuse to boot without `RESEND_API_KEY` — it logs a
warning and falls back to the console driver, because an outage is worse than
undelivered email. That means a missing key in production is silent from the
outside. Check the boot logs after deploying:

```
RESEND_API_KEY is not set — verification and password-reset links are being
written to the server log instead of emailed. Users signing up with email
cannot verify or recover their accounts until this is set.
```

---

## Step 5 — Confirm it works end to end

1. Register a DojoPay account with a real address you can open.
2. The email should arrive within seconds.
3. Click the link — it should land on `/auth/verify` and report success.
4. In **Settings**, the email should now read **Verified**.
5. Test recovery too: **Forgot your password** → check the mail arrives → reset →
   sign in with the new password.

Resend's **Logs** tab shows every send with its delivery status. If something is
wrong, that page usually says why more precisely than your own logs will.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Nothing arrives, logs look fine | Using `onboarding@resend.dev` to a non-signup address. Verify a domain. |
| `Email delivery failed: ...` in logs | `MAIL_FROM` is on an unverified domain, or the API key is wrong/revoked. |
| Emails arrive in spam | Domain not verified, or no DMARC. Complete Step 3. |
| Links point at `localhost` | `FRONTEND_URL` is unset or wrong in that environment. |
| Email logged to console in production | `RESEND_API_KEY` is not set there. It warns rather than crashing. |
| "That link has expired" | Links last 60 minutes (`emailTokenTtlMinutes`). Request another. |
| Second link does not work | Only the newest link is valid — issuing a new one invalidates outstanding ones by design. |

A note on the token flow, since it can look like a bug: **only hashes of email
tokens are stored.** A leaked database dump must not hand anyone a working
password-reset link. This means tokens cannot be looked up or resent from the
database — the user must request a new one.

---

## Using something else

Mail sending sits behind a small interface in `backend/src/lib/mailer.ts`:

```ts
export interface Mailer {
  readonly name: string;
  send(message: { to: string; subject: string; html: string; text: string }): Promise<void>;
}
```

Adding a Nodemailer, SendGrid, or Postmark driver means writing one class with a
`send` method and one line in `getMailer()`. Nothing else in the codebase knows
which provider is in use — the templates, the token flow, and the account service
are all provider-agnostic.
