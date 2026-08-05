/**
 * In-memory state for the password reset flow.
 * Keeps the reset session token out of URLs/history.
 */

let currentEmail: string | null = null;
let currentToken: string | null = null;

export const resetFlow = {
  setEmail(email: string) {
    currentEmail = email.trim().toLowerCase();
  },
  getEmail() {
    return currentEmail;
  },
  setToken(token: string) {
    currentToken = token;
  },
  getToken() {
    return currentToken;
  },
  clear() {
    currentEmail = null;
    currentToken = null;
  },
};
