// HTML email templates for auth flows. MailPace's client sends HTML only
// (see server/clients/mailClient.ts) — no plain-text alternative — so
// keep the markup simple and inline any styling.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(title: string, body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 16px 0">${escapeHtml(title)}</h2>
    ${body}
    <p style="margin-top:32px;color:#888;font-size:12px">Olvid - Alerting Bot</p>
  </div>`;
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#2f65f5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(label)}</a></p>
  <p style="color:#666;font-size:13px">Or copy this link into your browser:<br/><span style="word-break:break-all">${href}</span></p>`;
}

export function inviteEmail(origin: string, token: string, invitedBy?: string) {
  const url = `${origin}/invite?token=${encodeURIComponent(token)}`;
  const who = invitedBy ? escapeHtml(invitedBy) : "an administrator";
  return {
    subject: "You've been invited to Alerting Bot",
    html: shell(
      "You've been invited",
      `<p>${who} has invited you to join Alerting Bot. Click the button below to set your password and activate your account. The link expires in 7 days.</p>${ctaButton(url, "Accept invitation")}`,
    ),
  };
}

export function verifyEmail(origin: string, token: string) {
  const url = `${origin}/verify?token=${encodeURIComponent(token)}`;
  return {
    subject: "Verify your email address",
    html: shell(
      "Verify your email",
      `<p>Confirm this email address to finish setting up your Alerting Bot account. The link expires in 24 hours.</p>${ctaButton(url, "Verify email")}`,
    ),
  };
}
