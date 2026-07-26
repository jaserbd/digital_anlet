import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@anlet/shared';
import { organizationsApi } from '../api/organizationsApi';
import { usersApi } from '../api/usersApi';
import { insightsApi } from '../api/insightsApi';
import { questionnaireApi } from '../api/questionnaireApi';
import { ApiError } from '../api/client';
import { LogoutButton } from '../components/LogoutButton';

const QUESTIONNAIRE_CODE = 'RAN_FM_GB1059A';

export function AdminPage() {
  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin</h1>
        <LogoutButton />
      </div>
      <CreateOrganizationForm />
      <hr style={{ margin: '2rem 0' }} />
      <CreateUserForm />
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

const SCORE_BAR_MAX = 4;
const SCORE_BAR_FILL = '#2563eb';
const SCORE_BAR_TRACK = '#e5e7eb';

function ScoreBar({ value }: { value: number | null }) {
  if (value == null) {
    return <span style={{ color: '#999' }}>—</span>;
  }
  const pct = Math.max(0, Math.min(100, (value / SCORE_BAR_MAX) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div
        style={{
          background: SCORE_BAR_TRACK,
          borderRadius: 4,
          height: 10,
          width: 100,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div style={{ background: SCORE_BAR_FILL, height: '100%', width: `${pct}%`, borderRadius: 4 }} />
      </div>
      <span>{value.toFixed(2)}</span>
    </div>
  );
}

function BenchmarkingSection() {
  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', QUESTIONNAIRE_CODE],
    queryFn: () => questionnaireApi.get(QUESTIONNAIRE_CODE),
  });
  const benchmarkQuery = useQuery({
    queryKey: ['benchmarking', QUESTIONNAIRE_CODE],
    queryFn: () => insightsApi.getBenchmarkingSummary(QUESTIONNAIRE_CODE),
  });

  if (questionnaireQuery.isLoading || benchmarkQuery.isLoading) {
    return (
      <section>
        <h2>Organization benchmarking</h2>
        <p>Loading…</p>
      </section>
    );
  }
  if (!questionnaireQuery.data || !benchmarkQuery.data) {
    return (
      <section>
        <h2>Organization benchmarking</h2>
        <p>Something went wrong loading the benchmarking summary.</p>
      </section>
    );
  }

  const { subScenarios } = questionnaireQuery.data;

  return (
    <section>
      <h2>Organization benchmarking</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={cellStyle}>Organization</th>
              <th style={cellStyle}>Respondents</th>
              <th style={cellStyle}>Submitted</th>
              <th style={cellStyle}>Avg. final score</th>
              <th style={cellStyle}>Avg. E2E rate</th>
              {subScenarios.map((s) => (
                <th key={s.id} style={cellStyle}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benchmarkQuery.data.organizations.map((org) => (
              <tr key={org.organizationId}>
                <td style={cellStyle}>{org.organizationName}</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{org.respondentCount}</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{org.submittedCount}</td>
                <td style={cellStyle}>
                  <ScoreBar value={org.averageFinalScore} />
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  {org.averageE2eAutomationRate != null
                    ? `${(org.averageE2eAutomationRate * 100).toFixed(0)}%`
                    : '—'}
                </td>
                {subScenarios.map((s) => {
                  const avg = org.subScenarioAverages.find((a) => a.subScenarioCode === s.code);
                  return (
                    <td key={s.id} style={{ ...cellStyle, textAlign: 'center' }}>
                      {avg?.averageScore != null ? avg.averageScore.toFixed(2) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '0.85em', color: '#666' }}>
        Averages are computed over submitted responses only; an organization with none shows
        "—" rather than a misleading zero.
      </p>
    </section>
  );
}

const cellStyle = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  textAlign: 'left' as const,
};
