const nodemailer = require("nodemailer");

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // 16-character Google App Password
  },
});

// Verify connection on server boot to immediately detect if Google rejects
// the SMTP_USER or App Password (SMTP_PASS).
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Error:", error);
  } else {
    console.log("✅ SMTP Server is ready to take our messages");
  }
});

/**
 * Send an OTP email via Nodemailer with strict error logging.
 *
 * @param {Object} options
 * @param {string} options.to      - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html    - HTML body of the email
 * @param {string} [options.text]  - Optional plain-text body
 * @returns {Promise<{success: boolean, messageId: string}>}
 */
const sendOtpEmail = async ({ to, subject, html, text }) => {
  try {
    console.log(
      `Attempting to send OTP email to: ${to} using user: ${process.env.SMTP_USER}`
    );

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"MindCare" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("✅ Email sent successfully. Message ID:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send OTP email via Nodemailer:", error);
    throw new Error(`Email dispatch failed: ${error.message}`);
  }
};

module.exports = { sendOtpEmail, transporter };