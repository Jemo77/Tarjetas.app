import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envío de emails. Usa Resend cuando hay MAIL_API_KEY;
 * en desarrollo imprime el mensaje en el log para poder probar sin SMTP.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('mail.apiKey') ?? '';
    this.from = this.config.get<string>('mail.from') ?? 'Tarjetas <no-reply@localhost>';
    this.appUrl = this.config.get<string>('appUrl') ?? '';
  }

  async send(msg: MailMessage): Promise<{ previewUrl: string | null; dev: boolean }> {
    if (!this.apiKey) {
      this.logger.log(`[mail:dev] to=${msg.to} subject="${msg.subject}"`);
      this.logger.debug(`[mail:dev] body:\n${msg.html}`);
      return { previewUrl: null, dev: true };
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Resend error ${res.status}: ${body}`);
      throw new Error(`No se pudo enviar el email (${res.status})`);
    }
    const data = (await res.json()) as { id?: string };
    return { previewUrl: data.id ? `https://resend.com/emails/${data.id}` : null, dev: false };
  }

  async sendMagicCode(email: string, code: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Tu código de acceso',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Tu código de acceso</h2>
          <p>Usá este código para entrar a tu cuenta de tarjetas de fidelidad:</p>
          <p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p>
          <p style="color:#666">Vence en 10 minutos. Si no lo pediste, ignorá este mensaje.</p>
        </div>`,
    });
  }

  async sendInvitation(email: string, invitationUrl: string, establishmentName: string, role: string): Promise<void> {
    await this.send({
      to: email,
      subject: `Invitación a gestionar ${establishmentName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Te invitaron a ${establishmentName}</h2>
          <p>Rol asignado: <strong>${role}</strong></p>
          <p><a href="${invitationUrl}" style="background:#1F2937;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Aceptar invitación</a></p>
          <p style="color:#666">O copiá este enlace: ${invitationUrl}</p>
        </div>`,
    });
  }

  async sendWinback(email: string, establishmentName: string, customerUrl: string): Promise<void> {
    await this.send({
      to: email,
      subject: `Te extrañamos en ${establishmentName} 💛`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Tu próxima visita suma un sello</h2>
          <p>Hace un tiempo que no pasás por <strong>${establishmentName}</strong>. Tu tarjeta sigue activa y te espera.</p>
          <p><a href="${this.appUrl}">Ver mi tarjeta</a></p>
        </div>`,
    });
  }
}