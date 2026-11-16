import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';

// "Send welcome email" (ONBOARDING_SECURITY_PLAN.md Phase 3) — Create user and both Excel imports;
// state from lib/accountEmails.ts's useWelcomeEmailChoice.
export function WelcomeEmailCheckbox({
  checked,
  onChange,
  mailEnabled,
  plural = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  mailEnabled: boolean | undefined;
  plural?: boolean;
}) {
  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />}
        label={
          plural
            ? 'Send new people a welcome email with a link to set their password'
            : 'Send welcome email with a link to set their password'
        }
      />
      {mailEnabled === false && checked && (
        <Alert severity="warning">Email sending is switched off — no welcome email will be sent.</Alert>
      )}
    </Stack>
  );
}
