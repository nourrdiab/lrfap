const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = 'LRFAP <noreply@lrfap.com>';

const NAVY = '#262b66';
const SKY = '#4192CF';
const GHOST = '#efefef';
const WHITE = '#ffffff';
const FONT_STACK = "'Montserrat', 'Helvetica Neue', Arial, sans-serif";
const LOGO_URL = 'https://lrfap-frontend.vercel.app/logos/logo-navy.png';

const sendEmail = async ({ to, subject, html, text }) => {
  if (!resend) {
    console.warn('Resend not configured, skipping email');
    return { skipped: true };
  }
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    return result;
  } catch (err) {
    console.error('Email send error:', err.message);
    return { error: err.message };
  }
};

const baseLayout = ({ preheader, bodyHtml, footerNote }) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LRFAP</title>
  </head>
  <body style="margin:0; padding:0; background-color:${WHITE}; font-family:${FONT_STACK}; color:${NAVY};">
    <span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden;">${preheader || ''}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${WHITE};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:${WHITE};">
            <tr>
              <td align="center" style="padding:24px 24px 20px 24px; border-bottom:1px solid ${GHOST};">
                <img src="${LOGO_URL}" alt="LRFAP" width="140" style="display:block; border:0; outline:none; text-decoration:none; height:auto; max-width:140px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px 32px; font-family:${FONT_STACK}; color:${NAVY}; font-size:15px; line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px 32px; border-top:1px solid ${GHOST}; font-family:${FONT_STACK}; color:#888888; font-size:12px; line-height:1.6;">
                ${footerNote ? `<p style="margin:0 0 8px 0; color:#888888;">${footerNote}</p>` : ''}
                <p style="margin:0; color:#888888;">&copy; 2026 LRFAP. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const heading = (text) => `<h1 style="margin:0 0 20px 0; font-family:${FONT_STACK}; font-size:20px; font-weight:700; color:${NAVY}; text-transform:uppercase; letter-spacing:1px;">${text}</h1>`;

const paragraph = (text) => `<p style="margin:0 0 16px 0; font-family:${FONT_STACK}; font-size:15px; line-height:1.6; color:${NAVY};">${text}</p>`;

const ctaButton = ({ href, label }) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center" bgcolor="${NAVY}" style="background-color:${NAVY};">
        <a href="${href}" target="_blank" style="display:inline-block; padding:12px 24px; font-family:${FONT_STACK}; font-size:14px; font-weight:700; color:${WHITE}; text-decoration:none; text-transform:uppercase; letter-spacing:1px; background-color:${NAVY};">${label}</a>
      </td>
    </tr>
  </table>
`;

const infoBox = (innerHtml) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
    <tr>
      <td bgcolor="${GHOST}" style="background-color:${GHOST}; padding:16px 20px; border-left:4px solid ${SKY};">
        ${innerHtml}
      </td>
    </tr>
  </table>
`;

const applicationSubmittedTemplate = ({ firstName, submissionReference, applicationLink }) => {
  const bodyHtml = `
    ${heading('Application received')}
    ${paragraph(`Dear ${firstName},`)}
    ${paragraph('Thank you for submitting your application to the Lebanese Residency and Fellowship Application Program. We have received it successfully.')}
    ${infoBox(`
      <p style="margin:0 0 4px 0; font-family:${FONT_STACK}; font-size:13px; color:${NAVY}; text-transform:uppercase; letter-spacing:1px; font-weight:700;">Submission reference</p>
      <p style="margin:0; font-family:${FONT_STACK}; font-size:18px; color:${NAVY}; font-weight:700;">${submissionReference}</p>
    `)}
    ${paragraph('Your selected universities will now review your application. Match results will be published according to the cycle timeline. You can check your application status anytime from your dashboard.')}
    ${ctaButton({ href: applicationLink, label: 'View your application' })}
    ${paragraph('If you have questions, contact the LGC committee through your dashboard.')}
  `;
  return baseLayout({
    preheader: `Your LRFAP application has been received. Reference: ${submissionReference}`,
    bodyHtml,
    footerNote: 'This is an automated message from the LRFAP system. Please do not reply directly to this email.',
  });
};

const matchPublishedTemplate = ({ firstName, programName, universityName, applicationLink }) => {
  const bodyHtml = `
    ${heading('Your match result')}
    ${paragraph(`Dear ${firstName},`)}
    ${paragraph('The LRFAP match results have been published. We are pleased to share that you have been matched.')}
    ${infoBox(`
      <p style="margin:0 0 4px 0; font-family:${FONT_STACK}; font-size:13px; color:${NAVY}; text-transform:uppercase; letter-spacing:1px; font-weight:700;">Matched program</p>
      <p style="margin:0 0 6px 0; font-family:${FONT_STACK}; font-size:18px; color:${NAVY}; font-weight:700;">${programName}</p>
      <p style="margin:0; font-family:${FONT_STACK}; font-size:15px; color:${NAVY};">${universityName}</p>
    `)}
    ${paragraph('You have <strong style="color:' + NAVY + ';">48 hours</strong> to log in and accept your offer. After this acceptance window closes, the offer will expire.')}
    ${ctaButton({ href: applicationLink, label: 'View your match' })}
    ${paragraph('Congratulations, and best of luck as you prepare for the next chapter of your training.')}
  `;
  return baseLayout({
    preheader: `You have been matched to ${programName} at ${universityName}.`,
    bodyHtml,
    footerNote: 'This is an automated message from the LRFAP system. Please do not reply directly to this email.',
  });
};

const matchUnmatchedTemplate = ({ firstName, applicationLink }) => {
  const bodyHtml = `
    ${heading('Your match result')}
    ${paragraph(`Dear ${firstName},`)}
    ${paragraph('The LRFAP match results have been published. Unfortunately, you were not matched to a program in this cycle.')}
    ${paragraph('We understand this is difficult news. You can log in to your account to review your application, and we encourage you to consider applying again in the next cycle. The LGC committee is available through your dashboard if you would like guidance on next steps.')}
    ${ctaButton({ href: applicationLink, label: 'View your application' })}
    ${paragraph('Thank you for your participation in this year’s match.')}
  `;
  return baseLayout({
    preheader: 'LRFAP match results have been published.',
    bodyHtml,
    footerNote: 'This is an automated message from the LRFAP system. Please do not reply directly to this email.',
  });
};

const passwordResetTemplate = ({ firstName, resetLink }) => {
  const bodyHtml = `
    ${heading('Reset your password')}
    ${paragraph(`Dear ${firstName},`)}
    ${paragraph('We received a request to reset the password for your LRFAP account. Click the button below to choose a new password.')}
    ${ctaButton({ href: resetLink, label: 'Reset your password' })}
    ${paragraph('This link will expire in <strong style="color:' + NAVY + ';">1 hour</strong> for your security.')}
  `;
  return baseLayout({
    preheader: 'Reset your LRFAP password. This link expires in 1 hour.',
    bodyHtml,
    footerNote: 'If you didn’t request this email, you can safely ignore it. Your password will remain unchanged.',
  });
};

module.exports = {
  sendEmail,
  applicationSubmittedTemplate,
  matchPublishedTemplate,
  matchUnmatchedTemplate,
  passwordResetTemplate,
};
