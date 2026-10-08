import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const globalForMailer = globalThis as unknown as {
  mailer: Transporter | undefined;
};

// Mismas credenciales de Gmail que usa lib/email.ts
function crearTransporter() {
  const { EMAIL_USER, EMAIL_PASSWORD } = process.env;

  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    throw new Error('Faltan las variables EMAIL_USER o EMAIL_PASSWORD en el .env.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  });
}

export async function enviarEmail(email: { to: string; subject: string; text: string; html: string }) {
  const transporter = globalForMailer.mailer ?? crearTransporter();
  if (process.env.NODE_ENV !== 'production') globalForMailer.mailer = transporter;

  await transporter.sendMail({
    from: `SkyLink <${process.env.EMAIL_USER}>`,
    ...email,
  });
}
