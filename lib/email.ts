type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

function getFromAddress() {
  return process.env.WAITLIST_EMAIL_FROM || "Mint Web <waitlist@mintweb.mintit.pro>";
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is not configured; skipping email send");
    return { skipped: true };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email send failed: HTTP ${res.status}${detail ? ` ${detail}` : ""}`);
  }

  return res.json();
}

export async function sendWaitlistConfirmationEmail(input: {
  email: string;
  fullname?: string | null;
}) {
  const name = input.fullname?.trim() || "Builder";
  const waitlistUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mintweb.mintit.pro";
  const homeUrl = `${waitlistUrl.replace(/\/$/, "")}/home`;

  return sendEmail({
    to: input.email,
    subject: "You're on the Mint Web waitlist",
    text: [
      `Hey ${name},`,
      "",
      "Thanks for joining the Mint Web waitlist.",
      "",
      "Mint Web is a runtime-driven visual app builder for teams exploring dynamic screens, workflows, state, backend actions, and production updates without treating every small change like a full redeploy.",
      "",
      "We are opening access in phases so we can keep the product stable while we learn from early users.",
      "",
      `You can revisit the waitlist page here: ${homeUrl}`,
      "",
      "Thanks for being early.",
      "Mint Web",
    ].join("\n"),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#18181b;max-width:560px;margin:0 auto;padding:32px 20px;">
        <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px;">You're on the Mint Web waitlist</h1>
        <p>Hey ${escapeHtml(name)},</p>
        <p>Thanks for joining the Mint Web waitlist.</p>
        <p>Mint Web is a runtime-driven visual app builder for teams exploring dynamic screens, workflows, state, backend actions, and production updates without treating every small change like a full redeploy.</p>
        <p>We are opening access in phases so we can keep the product stable while we learn from early users.</p>
        <p>
          <a href="${homeUrl}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 16px;font-weight:600;">
            Visit Mint Web
          </a>
        </p>
        <p style="color:#71717a;font-size:14px;">Thanks for being early.<br/>Mint Web</p>
      </div>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendOtpEmail(input: {
  email: string;
  code: string;
}) {
  return sendEmail({
    to: input.email,
    subject: `Your Mint Web Verification Code: ${input.code}`,
    text: [
      "Hello,",
      "",
      `Your verification code is: ${input.code}`,
      "",
      "This code will expire in 15 minutes.",
      "",
      "If you did not request this code, please ignore this email.",
      "",
      "Mint Web",
    ].join("\n"),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#18181b;max-width:560px;margin:0 auto;padding:32px 20px;">
        <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px;">Verify your email</h1>
        <p>Hello,</p>
        <p>Your verification code is:</p>
        <div style="background:#f4f4f5;border-radius:10px;padding:16px;font-size:32px;font-weight:700;letter-spacing:4px;text-align:center;margin:24px 0;font-family:monospace;color:#09090b;">
          ${escapeHtml(input.code)}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p style="color:#71717a;font-size:14px;margin-top:32px;">If you did not request this code, please ignore this email.<br/>Mint Web</p>
      </div>
    `,
  });
}

