import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useAuth } from '../context/AuthContext';
import { contextKey, formatContextLabel } from '../lib/contexts';

// Header dropdown for users with more than one organization/role (MULTI_ORG_PLAN.md):
// switching re-issues the session for the chosen context and returns to Home, which routes to
// the right landing page for that role.
export function ContextSwitcher() {
  const { user, switchContext } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  if (!user || user.contexts.length < 2) return null;

  async function handleChange(key: string) {
    setSwitching(true);
    try {
      await switchContext(key === 'admin' ? null : key);
    } catch {
      // The user was re-synced from the server either way (see AuthContext.switchContext).
    } finally {
      setSwitching(false);
      navigate('/', { replace: true });
    }
  }

  return (
    <TextField
      select
      size="small"
      label="Working as"
      value={contextKey(user.activeMembershipId)}
      disabled={switching}
      onChange={(e) => void handleChange(e.target.value)}
      sx={{ minWidth: 220 }}
    >
      {user.contexts.map((c) => (
        <MenuItem key={contextKey(c.membershipId)} value={contextKey(c.membershipId)}>
          {formatContextLabel(c)}
        </MenuItem>
      ))}
    </TextField>
  );
}
