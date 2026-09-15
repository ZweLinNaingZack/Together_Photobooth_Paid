/** Translate auth codes without displaying server messages containing account details. */
export function authErrorMessage(error: { code?: string; status?: number }) {
  const messages: Record<string, string> = {
    email_address_not_authorized: 'Confirmation emails are not available for this email address yet. The website owner needs to configure an email delivery service before new accounts can sign up.',
    over_email_send_rate_limit: 'Too many account emails have been requested. Please wait before trying again, and check your inbox and spam folder for an existing confirmation email.',
    over_request_rate_limit: 'Too many attempts. Please wait a few minutes before trying again.',
    email_not_confirmed: 'Please confirm your email before signing in. Check your inbox and spam folder for the confirmation link.',
    invalid_credentials: 'The email or password is incorrect. If sign-up failed, your account may not have been created yet.',
    weak_password: 'Please use a stronger password with uppercase and lowercase letters, numbers, and a symbol.',
    email_address_invalid: 'Please enter a valid email address.',
    signup_disabled: 'New account registration is currently disabled. The website owner needs to enable sign-ups.',
    email_provider_disabled: 'Email sign-in is currently disabled. The website owner needs to enable it.',
    user_already_exists: 'Please try signing in or resetting your password if you already have an account.',
    email_exists: 'Please try signing in or resetting your password if you already have an account.',
    same_password: 'Please choose a different password from your current one.',
    otp_expired: 'This link has expired or has already been used. Please request a new one.',
    captcha_failed: 'Verification failed. Please refresh and try again.',
  };
  if (error.code && messages[error.code]) return messages[error.code];
  if (error.status === 429) return messages.over_request_rate_limit;
  const reference = error.code && /^[a-z_]{1,64}$/.test(error.code) ? error.code : error.status ? `HTTP ${error.status}` : 'unknown';
  return `The account service could not complete this request. Please share this reference with us: ${reference}.`;
}
