import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { questionnaireApi } from '../api/questionnaireApi';
import { LogoutButton } from '../components/LogoutButton';

export function DomainPickerPage() {
  const navigate = useNavigate();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const questionnairesQuery = useQuery({
    queryKey: ['questionnaires'],
    queryFn: questionnaireApi.list,
  });

  if (questionnairesQuery.isLoading) {
    return <p>Loading…</p>;
  }
  if (!questionnairesQuery.data) {
    return <p>Something went wrong loading the available assessments.</p>;
  }

  const domains = [...new Set(questionnairesQuery.data.map((q) => q.networkType))];
  const questionnairesInDomain = questionnairesQuery.data.filter(
    (q) => q.networkType === selectedDomain,
  );

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Anlet</h1>
        <LogoutButton />
      </div>

      {!selectedDomain ? (
        <>
          <h2>Choose a domain</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 320 }}>
            {domains.map((domain) => (
              <button
                key={domain}
                type="button"
                onClick={() => setSelectedDomain(domain)}
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              >
                {domain} Domain
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setSelectedDomain(null)} style={{ marginBottom: '1rem' }}>
            ← Back to domains
          </button>
          <h2>{selectedDomain} Domain — choose an assessment</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 320 }}>
            {questionnairesInDomain.map((q) => (
              <button
                key={q.code}
                type="button"
                onClick={() => navigate(`/questionnaire/${q.code}`)}
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              >
                {q.name}
              </button>
            ))}
            {questionnairesInDomain.length === 0 && <p>No assessments available in this domain yet.</p>}
          </div>
        </>
      )}
    </main>
  );
}
