export const passwordRequirements = [
  ['At least 8 characters', value => value.length >= 8],
  ['An uppercase letter', value => /[A-Z]/.test(value)],
  ['A lowercase letter', value => /[a-z]/.test(value)],
  ['A number', value => /[0-9]/.test(value)],
  ['A special character (!@#$%^&*(),.?":{}|<>)', value => /[!@#$%^&*(),.?":{}|<>]/.test(value)],
];
export const strongPassword = value => typeof value === 'string' && value.length <= 128 && passwordRequirements.every(([,check]) => check(value));
