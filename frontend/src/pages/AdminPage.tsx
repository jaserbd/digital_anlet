import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@anlet/shared';
import { organizationsApi } from '../api/organizationsApi';
import { usersApi } from '../api/usersApi';
import { ApiError } from '../api/client';
import { LogoutButton } from '../components/LogoutButton';

export function AdminPage() {
  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin</h1>
        <LogoutButton />
      </div>
      <CreateOrganizationForm />
      <hr style={{ margin: '2rem 0' }} />
      <CreateUserForm />
    </main>
  );
}

function CreateOrganizationForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const createOrg = useMutation({
    mutationFn: () => organizationsApi.create(name),
    onSuccess: (org) => {
      setMessage({ kind: 'success', text: `Created organization "${org.name}"` });
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (err) => {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to create organization' });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    createOrg.mutate();
  }

  return (
    <section>
      <h2>Create organization</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          required
          placeholder="Organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={createOrg.isPending}>
          {createOrg.isPending ? 'Creating…' : 'Create'}
        </button>
      </form>
      {message && (
        <p style={{ color: message.kind === 'error' ? 'crimson' : 'green' }}>{message.text}</p>
      )}
    </section>
  );
}

function CreateUserForm() {
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>>('NORMAL_USER');
  const [organizationId, setOrganizationId] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const createUser = useMutation({
    mutationFn: () => usersApi.create({ email, password, role, organizationId }),
    onSuccess: (user) => {
      setMessage({ kind: 'success', text: `Created user "${user.email}"` });
      setEmail('');
      setPassword('');
    },
    onError: (err) => {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to create user' });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    createUser.mutate();
  }

  return (
    <section>
      <h2>Create user</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            style={{ display: 'block', width: '100%' }}
          >
            <option value="NORMAL_USER">Normal User</option>
            <option value="EXECUTIVE">Executive</option>
          </select>
        </label>
        <label>
          Organization
          <select
            required
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          >
            <option value="" disabled>
              {orgsQuery.isLoading ? 'Loading…' : 'Select an organization'}
            </option>
            {orgsQuery.data?.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={createUser.isPending || !organizationId}>
          {createUser.isPending ? 'Creating…' : 'Create user'}
        </button>
      </form>
      {message && (
        <p style={{ color: message.kind === 'error' ? 'crimson' : 'green' }}>{message.text}</p>
      )}
    </section>
  );
}
