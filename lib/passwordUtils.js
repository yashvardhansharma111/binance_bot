export const PASSWORD_RULES = [
  { id: 'length',  label: 'At least 8 characters',      test: p => p.length >= 8 },
  { id: 'upper',   label: 'Uppercase letter (A–Z)',      test: p => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Lowercase letter (a–z)',      test: p => /[a-z]/.test(p) },
  { id: 'number',  label: 'Number (0–9)',                test: p => /[0-9]/.test(p) },
  { id: 'special', label: 'Special character (!@#$…)',   test: p => /[^A-Za-z0-9]/.test(p) },
];

export function validatePassword(password) {
  const failures = PASSWORD_RULES.filter(r => !r.test(password));
  return { valid: failures.length === 0, failures };
}

export function generatePassword(length = 14) {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const special = '!@#$%^&*_+-?';
  const all     = upper + lower + digits + special;

  // Guarantee one of each required type
  const chars = [
    upper  [Math.floor(Math.random() * upper.length)],
    lower  [Math.floor(Math.random() * lower.length)],
    digits [Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 4; i < length; i++)
    chars.push(all[Math.floor(Math.random() * all.length)]);

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
