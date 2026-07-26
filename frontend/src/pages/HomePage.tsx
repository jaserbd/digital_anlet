import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { user } = useAuth();

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
