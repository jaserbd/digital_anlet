import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@anlet/shared';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
  // Whether this route group should enforce the profile-completion redirect below at all
  // (MANAGEMENT_REVIEW2.md item 2) — false for an Executive's dashboard/Home, since they
  // should only be asked to complete their profile once they actually choose to participate
  // in an assessment, not just to view read-only pages. Defaults to true, matching the
  // original behavior for every other route group.
  requireProfile?: boolean;
}

export function ProtectedRoute({ allowedRoles, requireProfile = true }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p>Loading…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // Any admin-created account (single-create or bulk CSV — OVERVIEW.md item 4) must set its
  // own password before reaching anywhere else, regardless of role or route group. Guards
  // against a redirect loop when already on /change-password itself, same pattern as /profile
  // below.
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  // NORMAL_USER always needs an OpCo before answering. EXECUTIVE's OpCo is optional
  // (MANAGEMENT_REVIEW2.md item 2), but Working Domain/Designation are still collected once —
  // checking workingDomain alone is a reliable "has completed the profile step" signal since
  // it's always submitted together with designation in the same call (same pattern the
  // opCoId-only check already relies on for Normal User). Admins never answer questionnaires
  // and skip this entirely. Guards against a redirect loop when already on /profile itself.
  if (requireProfile && location.pathname !== '/profile') {
    const needsProfile =
      (user.role === 'NORMAL_USER' && user.opCoId == null) ||
      (user.role === 'EXECUTIVE' && user.workingDomain == null);
    if (needsProfile) {
      return <Navigate to="/profile" replace />;
    }
  }
  return <Outlet />;
}
