// JJQR - AI (Nov 20, 2026) - PV-3: one place for the password rule shown in the UI. The server (ClinicApp.Auth/PasswordPolicy.cs) is the real gate; keep MIN in step with it.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters. Avoid common passwords and your own email.`;
// JJQR - END
