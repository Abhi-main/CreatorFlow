import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
});

async function sendMail({ to, subject, html }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`Email skipped (${subject}) -> ${to}`);
    return { skipped: true };
  }
  return transporter.sendMail({ from: process.env.SMTP_FROM || "noreply@smartsocial.app", to, subject, html });
}

export const sendPasswordReset = async (email, resetUrl) =>
  sendMail({
    to: email,
    subject: "Reset your Smart Social password",
    html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset password</a></p>`
  });

export const sendInvite = async (email, teamName, inviteUrl) =>
  sendMail({
    to: email,
    subject: `You're invited to ${teamName}`,
    html: `<p>You have been invited to join ${teamName}.</p><p><a href="${inviteUrl}">Accept invite</a></p>`
  });

export const sendWelcome = async (email, firstName) =>
  sendMail({
    to: email,
    subject: "Welcome to Smart Social",
    html: `<p>Welcome ${firstName}, your Smart Social workspace is ready.</p>`
  });
