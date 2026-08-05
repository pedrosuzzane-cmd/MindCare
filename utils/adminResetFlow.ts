/**
 * In-memory state for the administrator password reset flow.
 * Keeps the request ID and reset session token out of URLs/history.
 */

let adminEmail: string | null = null;
let adminRequestId: string | null = null;
let adminResetToken: string | null = null;
let otpExpiresAtMs: number | null = null;

export const adminResetFlow = {
  setEmail(email: string) {
    adminEmail = email.trim().toLowerCase();
  },
  getEmail() {
    return adminEmail;
  },
  setRequestId(id: string) {
    adminRequestId = id;
  },
  getRequestId() {
    return adminRequestId;
  },
  setOtpExpiresAt(ms: number | null) {
    otpExpiresAtMs = ms;
  },
  getOtpExpiresAt() {
    return otpExpiresAtMs;
  },
  setResetToken(token: string) {
    adminResetToken = token;
  },
  getResetToken() {
    return adminResetToken;
  },
  clear() {
    adminEmail = null;
    adminRequestId = null;
    adminResetToken = null;
    otpExpiresAtMs = null;
  },
};
