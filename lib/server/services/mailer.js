import nodemailer from 'nodemailer';

export const mailConfigured = () => !!process.env.SMTP_HOST;

// A new transport per send: mail is rare here and serverless instances don't keep sockets.
export async function sendMail({ to, subject, text, html }) {
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM || user, to, subject, text, html });
  } finally {
    transport.close();
  }
}
