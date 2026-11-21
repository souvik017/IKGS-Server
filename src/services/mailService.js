const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporter;
function getTransporter() {
  if (!config.mail.host || !config.mail.user || !config.mail.pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
  }
  return transporter;
}

async function sendSystemMail({ to, subject, text, html }) {
  const service = getTransporter();
  if (!service || !to) {
    console.warn(`[mail] Not sent: SMTP or recipient is not configured (${subject})`);
    return { sent: false, reason: 'not-configured' };
  }
  try {
    await service.sendMail({ from: config.mail.from, to, subject, text, html });
    return { sent: true };
  } catch (error) {
    // Notification failures should not undo an appointment or closure request.
    console.error(`[mail] Failed to send "${subject}":`, error.message);
    return { sent: false, reason: 'send-failed' };
  }
}

module.exports = { sendSystemMail };
