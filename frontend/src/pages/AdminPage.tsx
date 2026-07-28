import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrganizationDto, Role, UpdateUserRequestDto, UserDto } from '@anlet/shared';
import { organizationsApi } from '../api/organizationsApi';
import { opCoApi } from '../api/opCoApi';
import { usersApi } from '../api/usersApi';
import { insightsApi } from '../api/insightsApi';
import { questionnaireApi } from '../api/questionnaireApi';
import { ApiError } from '../api/client';
import { LogoutButton } from '../components/LogoutButton';
import { BenchmarkTable } from '../components/BenchmarkTable';

export function AdminPage() {
  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin</h1>
        <LogoutButton />
      </div>
      <CreateOrganizationForm />
      <hr style={{ margin: '2rem 0' }} />
      <CreateOpCoForm />
      <hr style={{ margin: '2rem 0' }} />
      <CreateUserForm />
      <hr style={{ margin: '2rem 0' }} />
      <ManageUsersSection />
      <hr style={{ margin: '2rem 0' }} />
      <BenchmarkingSection />
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

function CreateOpCoForm() {
  const queryClient = useQueryClient();
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const createOpCo = useMutation({
    mutationFn: () => opCoApi.create({ name, country, organizationId }),
    onSuccess: (opCo) => {
      setMessage({ kind: 'success', text: `Created OpCo "${opCo.name}" (${opCo.country})` });
      setName('');
      setCountry('');
      void queryClient.invalidateQueries({ queryKey: ['opcos', organizationId] });
    },
    onError: (err) => {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to create OpCo' });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    createOpCo.mutate();
  }

  return (
    <section>
      <h2>Create OpCo</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
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
        <label>
          OpCo / NatCo name
          <input
            type="text"
            required
            placeholder="e.g. Vodafone Kenya"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Country
          <input
            type="text"
            required
            placeholder="e.g. Kenya"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <button type="submit" disabled={createOpCo.isPending || !organizationId}>
          {createOpCo.isPending ? 'Creating…' : 'Create OpCo'}
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

// Admin can only create brand-new users elsewhere (CreateUserForm) — this lets Admin
// reassign an *existing* Executive/Normal-User account's Organization (and OpCo) without
// recreating it (SECOND_REVIEW.md item 8). Reassigning org clears OpCo server-side (an OpCo
// belongs to a specific org), which naturally re-triggers profile completion for a
// NORMAL_USER on their next visit.
function ManageUsersSection() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  return (
    <section>
      <h2>Existing users</h2>
      {usersQuery.isLoading || orgsQuery.isLoading ? (
        <p>Loading…</p>
      ) : !usersQuery.data || !orgsQuery.data ? (
        <p>Something went wrong loading users.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={cellStyle}>Email</th>
                <th style={cellStyle}>Role</th>
                <th style={cellStyle}>Organization</th>
                <th style={cellStyle}>OpCo</th>
                <th style={cellStyle}></th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  organizations={orgsQuery.data!}
                  onSaved={() => void queryClient.invalidateQueries({ queryKey: ['users'] })}
                />
              ))}
              {usersQuery.data.length === 0 && (
                <tr>
                  <td style={cellStyle} colSpan={5}>
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UserRow({
  user,
  organizations,
  onSaved,
}: {
  user: UserDto;
  organizations: OrganizationDto[];
  onSaved: () => void;
}) {
  const [organizationId, setOrganizationId] = useState(user.organizationId);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const opCosQuery = useQuery({
    queryKey: ['opcos', organizationId],
    queryFn: () => opCoApi.list(organizationId),
  });

  const updateUser = useMutation({
    mutationFn: (input: UpdateUserRequestDto) => usersApi.update(user.id, input),
    onSuccess: () => {
      setMessage({ kind: 'success', text: 'Saved' });
      onSaved();
    },
    onError: (err) => {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to save' });
    },
  });

  const dirty = organizationId !== user.organizationId;

  return (
    <tr>
      <td style={cellStyle}>{user.email}</td>
      <td style={cellStyle}>{user.role}</td>
      <td style={cellStyle}>
        <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </td>
      <td style={cellStyle}>
        {dirty
          ? '— will be cleared —'
          : (opCosQuery.data?.find((o) => o.id === user.opCoId)?.name ?? '—')}
      </td>
      <td style={cellStyle}>
        <button
          type="button"
          disabled={!dirty || updateUser.isPending}
          onClick={() => {
            setMessage(null);
            updateUser.mutate({ organizationId });
          }}
        >
          {updateUser.isPending ? 'Saving…' : 'Save'}
        </button>
        {message && (
          <span style={{ marginLeft: '0.5rem', color: message.kind === 'error' ? 'crimson' : 'green' }}>
            {message.text}
          </span>
        )}
      </td>
    </tr>
  );
}

function BenchmarkingSection() {
  const questionnairesQuery = useQuery({ queryKey: ['questionnaires'], queryFn: questionnaireApi.list });
  const [questionnaireCode, setQuestionnaireCode] = useState('');

  const effectiveCode = questionnaireCode || questionnairesQuery.data?.[0]?.code || '';

  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', effectiveCode],
    queryFn: () => questionnaireApi.get(effectiveCode),
    enabled: !!effectiveCode,
  });
  const benchmarkQuery = useQuery({
    queryKey: ['benchmarking', effectiveCode],
    queryFn: () => insightsApi.getBenchmarkingSummary(effectiveCode),
    enabled: !!effectiveCode,
  });

  if (questionnairesQuery.isLoading || questionnaireQuery.isLoading || benchmarkQuery.isLoading) {
    return (
      <section>
        <h2>Benchmarking</h2>
        <p>Loading…</p>
      </section>
    );
  }
  if (!questionnaireQuery.data || !benchmarkQuery.data) {
    return (
      <section>
        <h2>Benchmarking</h2>
        <p>Something went wrong loading the benchmarking summary.</p>
      </section>
    );
  }

  const { subScenarios } = questionnaireQuery.data;

  return (
    <section>
      <h2>Benchmarking</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Assessment
          <select
            value={effectiveCode}
            onChange={(e) => setQuestionnaireCode(e.target.value)}
            style={{ display: 'block' }}
          >
            {questionnairesQuery.data?.map((q) => (
              <option key={q.code} value={q.code}>
                {q.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <BenchmarkTable rows={benchmarkQuery.data.rows} subScenarios={subScenarios} />
      <p style={{ fontSize: '0.85em', color: '#666' }}>
        Averages are computed over submitted responses only; a row with none shows "—" rather
        than a misleading zero. A blank OpCo/Country means the respondent(s) haven't been
        assigned an OpCo yet — for a small organization with no OpCos at all, the NatCo
        column shows the organization's own name.
      </p>
    </section>
  );
}

const cellStyle = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  textAlign: 'left' as const,
};
