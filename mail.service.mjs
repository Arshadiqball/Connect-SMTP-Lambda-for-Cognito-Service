// mail.service.mjs
import nodemailer from "nodemailer";

const {
  SMTP_HOST = "smtp.office365.com",
  SMTP_PORT = "587",
  SMTP_FROM_NAME = "Hyrise Support",
} = process.env;

// Support both styles: SMTP_* and O365_*
const SMTP_EMAIL = process.env.SMTP_EMAIL || process.env.O365_USER || "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || process.env.O365_PASS || "";

if (!SMTP_EMAIL || !SMTP_PASSWORD) {
  console.warn(
    "[MailService] SMTP credentials are not configured. " +
      `SMTP_EMAIL set: ${!!SMTP_EMAIL}, SMTP_PASSWORD set: ${!!SMTP_PASSWORD}`
  );
}

// Shared transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: false, // STARTTLS on 587
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_PASSWORD,
  },
});

/**
 * Base HTML template in the green gradient style
 */
function buildBaseTemplate({ title, name, bodyHtml }) {
  const year = new Date().getFullYear();
  const safeName = name || "there";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #16a34a 0%, #166534 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 20px;">Hello ${safeName},</h2>
              ${bodyHtml}
              <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions, please reach out to our support team at
                <a href="mailto:help@hyrise.app" style="color: #16a34a; text-decoration: none;">help@hyrise.app</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #cccccc; font-size: 12px;">© ${year} Hyrise. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Base send helper
 */
async function sendMail({ to, subject, html, text }) {
  if (!to) throw new Error("[MailService] 'to' is required");
  if (!subject) throw new Error("[MailService] 'subject' is required");

  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    throw new Error(
      "[MailService] SMTP credentials missing (SMTP_EMAIL / SMTP_PASSWORD or O365_USER / O365_PASS)"
    );
  }

  const from = `"${SMTP_FROM_NAME}" <${SMTP_EMAIL}>`;

  const mailOptions = {
    from,
    to,
    subject,
    text: text ?? html?.replace(/<[^>]+>/g, "") ?? "",
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("[MailService] Email sent:", {
    messageId: info.messageId,
    to,
    subject,
  });
  return info;
}

/**
 * Sign-up verification OTP
 */
async function sendOTPEmail({ to, otp, name }) {
  const subject = "Your Hyrise verification code";

  const bodyHtml = `
    <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
      Welcome to Hyrise! Please use the verification code below to complete your registration:
    </p>
    <p style="margin: 0 0 20px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #16a34a; text-align: center;">
      ${otp}
    </p>
    <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
      This code will expire shortly. If you did not request this, you can safely ignore this email.
    </p>
  `;

  const html = buildBaseTemplate({
    title: "Verify Your Email",
    name,
    bodyHtml,
  });

  return sendMail({ to, subject, html });
}

/**
 * Admin-created / parent invite
 */
async function sendParentInviteEmail({ to, otp, name }) {
  const subject = "Your Hyrise account access code";

  const bodyHtml = `
    <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
      You have been invited to Hyrise. Please use the access code below to complete your account setup:
    </p>
    <p style="margin: 0 0 20px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #16a34a; text-align: center;">
      ${otp}
    </p>
    <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
      Enter this code in the app to complete your account setup.
    </p>
  `;

  const html = buildBaseTemplate({
    title: "Your Hyrise Access Code",
    name,
    bodyHtml,
  });

  return sendMail({ to, subject, html });
}

/**
 * Forgot password OTP
 */
async function sendForgotPasswordEmail({ to, otp, name }) {
  const subject = "Hyrise password reset code";

  const bodyHtml = `
    <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
      You requested to reset your password. Please use the code below to proceed:
    </p>
    <p style="margin: 0 0 20px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #16a34a; text-align: center;">
      ${otp}
    </p>
    <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
      If you did not request a password reset, please ignore this email.
    </p>
  `;

  const html = buildBaseTemplate({
    title: "Reset Your Password",
    name,
    bodyHtml,
  });

  return sendMail({ to, subject, html });
}

/**
 * Resend verification code
 */
async function resendCodeEmail({ to, code, name }) {
  const subject = "Your Hyrise verification code (resend)";

  const bodyHtml = `
    <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
      Here is your verification code:
    </p>
    <p style="margin: 0 0 20px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #16a34a; text-align: center;">
      ${code}
    </p>
    <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
      Use this code to complete your verification.
    </p>
  `;

  const html = buildBaseTemplate({
    title: "Verification Code",
    name,
    bodyHtml,
  });

  return sendMail({ to, subject, html });
}

const MailService = {
  sendMail,
  sendOTPEmail,
  sendParentInviteEmail,
  sendForgotPasswordEmail,
  resendCodeEmail,
};

export default MailService;
