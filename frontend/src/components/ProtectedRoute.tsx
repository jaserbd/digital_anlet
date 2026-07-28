import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@anlet/shared';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p>Loading…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  // NORMAL_USER only — Executives/Admins don't answer questionnaires, so they don't need
  // an OpCo/profile. Guards against a redirect loop when already on /profile itself.
  if (user.role === 'NORMAL_USER' && user.opCoId == null && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }
  return <Outlet />;
}
