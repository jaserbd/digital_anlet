import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { opCoApi } from '../api/opCoApi';
import { authApi } from '../api/authApi';
import { ApiError } from '../api/client';
import { ME_QUERY_KEY, useAuth } from '../context/AuthContext';
import { LogoutButton } from '../components/LogoutButton';

// One-time profile completion for a NORMAL_USER before they can reach the domain picker
// (see ProtectedRoute.tsx — a user with opCoId == null is routed here). Country + Company
// are captured together by picking an admin-managed OpCo; Working Domain and Designation
// are free text.
export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const opCosQuery = useQuery({
    queryKey: ['opcos', user!.organizationId],
    queryFn: () => opCoApi.list(user!.organizationId),
  });

  const [opCoId, setOpCoId] = useState('');
  const [workingDomain, setWorkingDomain] = useState('');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateProfile = useMutation({
    mutationFn: () => authApi.updateProfile({ opCoId, workingDomain, designation }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      navigate('/domains', { replace: true });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to save profile');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    updateProfile.mutate();
  }

  return (
    <main style={{ maxWidth: 480, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Complete your profile</h1>
        <LogoutButton />
      </div>
      <p>Before starting an assessment, tell us a bit about yourself.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          Country / Company (OpCo)
          <select
            required
            value={opCoId}
            onChange={(e) => setOpCoId(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          >
            <option value="" disabled>
              {opCosQuery.isLoading ? 'Loading…' : 'Select your OpCo'}
            </option>
            {opCosQuery.data?.map((opCo) => (
              <option key={opCo.id} value={opCo.id}>
                {opCo.name} ({opCo.country})
              </option>
            ))}
          </select>
          {opCosQuery.data?.length === 0 && (
            <span style={{ fontSize: '0.85em', color: '#666' }}>
              No OpCos exist for your organization yet — ask your Admin to create one.
            </span>
          )}
        </label>
        <label>
          Working Domain
          <input
            type="text"
            required
            placeholder="e.g. RAN Operations"
            value={workingDomain}
            onChange={(e) => setWorkingDomain(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Designation
          <input
            type="text"
            required
            placeholder="e.g. Network Engineer"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <button type="submit" disabled={updateProfile.isPending || !opCoId}>
          {updateProfile.isPending ? 'Saving…' : 'Continue'}
        </button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </main>
  );
}
