import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Routes to the landing page for the *active context's* role (MULTI_ORG_PLAN.md).
export function HomePage() {
  const { user } = useAuth();

  // A non-admin with no organization membership left can sign in but has nothing to work on
  // until an admin adds them to an organization — checked first, since their fallback role is
  // NORMAL_USER and would otherwise send them to the domain picker.
  if (user && !user.isAdmin && user.contexts.length === 0) {
    return (
      <p>
        Signed in as {user.email}, but you aren&apos;t assigned to any organization yet. Please
        contact jaserbin.rahman@detecon.com.
      </p>
    );
  }
  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }
  if (user?.role === 'NORMAL_USER') {
    return <Navigate to="/domains" replace />;
  }
  if (user?.role === 'EXECUTIVE') {
    return <Navigate to="/executive" replace />;
  }
  return <p>Signed in as {user?.email}.</p>;
}
