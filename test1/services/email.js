import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

let transporter;

export async function sendPasswordResetEmail({ to, name, token }) {
    if (!env.smtp || !env.passwordResetFrontendUrl) {
        throw new HttpError(503, 'Password recovery is not configured. Please contact support.', 'EMAIL_NOT_CONFIGURED');
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: env.smtp.host,
            port: env.smtp.port,
            secure: env.smtp.secure,
            auth: { user: env.smtp.user, pass: env.smtp.password },
        });
    }

    const resetUrl = new URL(env.passwordResetFrontendUrl);
    resetUrl.searchParams.set('token', token);
    const safeName = String(name).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);

    await transporter.sendMail({
        from: env.smtp.from,
        to,
        subject: 'Reset your Nova AI password',
        text: `Hi ${name},\n\nUse this link to reset your Nova AI password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hi ${safeName},</p><p>Use this link to reset your Nova AI password. It expires in 30 minutes.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
}
