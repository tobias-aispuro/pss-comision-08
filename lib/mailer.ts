import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const globalForMailer = globalThis as unknown as {
  mailer: Transporter | undefined;
};

function crearTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Faltan las variables SMTP_HOST, SMTP_USER o SMTP_PASS en el .env.');
  }

  const port = Number(SMTP_PORT) || 587;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function enviarEmail(email: { to: string; subject: string; text: string; html: string }) {
  const transporter = globalForMailer.mailer ?? crearTransporter();
  if (process.env.NODE_ENV !== 'production') globalForMailer.mailer = transporter;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    ...email,
  });
}
