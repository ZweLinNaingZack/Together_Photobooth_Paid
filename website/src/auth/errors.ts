import { t, type Key } from '../i18n';

/** Turn auth error codes into friendly words, without showing server messages that may contain account details. */
export function authErrorMessage(error: { code?: string; status?: number }) {
  const known = ['email_address_not_authorized', 'over_email_send_rate_limit', 'over_request_rate_limit', 'email_not_confirmed',
    'invalid_credentials', 'weak_password', 'email_address_invalid', 'signup_disabled', 'email_provider_disabled',
    'user_already_exists', 'email_exists', 'same_password', 'otp_expired', 'captcha_failed'];
  if (error.code && known.includes(error.code)) return t(`authError.${error.code}` as Key);
  if (error.status === 429) return t('authError.over_request_rate_limit');
  const reference = error.code && /^[a-z_]{1,64}$/.test(error.code) ? error.code : error.status ? `HTTP ${error.status}` : 'unknown';
  return t('authError.unknown', { reference });
}
