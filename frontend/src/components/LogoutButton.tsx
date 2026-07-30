import Button from '@mui/material/Button';
import { useAuth } from '../context/AuthContext';

export function LogoutButton() {
  const { logout } = useAuth();
  return (
    <Button type="button" variant="outlined" size="small" onClick={() => void logout()}>
      Log out
    </Button>
  );
}
