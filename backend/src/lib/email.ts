// Email addresses are case-insensitive (admin_management.md line 47): every address is stored and
// looked up trimmed and lowercased, so "Jane.Doe@Detecon.com" and "jane.doe@detecon.com" are the
// same account. The "User_email_normalized" check constraint rejects anything written otherwise.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
