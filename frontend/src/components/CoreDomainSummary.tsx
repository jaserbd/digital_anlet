import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { responsesApi } from '../api/responsesApi';

export function CoreDomainSummary() {
  const query = useQuery({
    queryKey: ['core-domain-summary'],
    queryFn: responsesApi.getCoreDomainSummary,
  });

  if (query.isLoading || !query.data) {
    return null;
  }

  const {
    faultManagement,
    faultManagementQuestionnaireCode,
    stability,
    stabilityQuestionnaireCode,
    combinedScore,
  } = query.data;

  return (
    <section style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
      <h2>Core Domain combined score</h2>
      <p>Per the Core Domain guideline: final score = 50% Fault Management + 50% Stability.</p>
      <ul>
        <li>
          Core Fault Management:{' '}
          {faultManagement ? `${faultManagement.finalScore.toFixed(2)} / 4` : 'not yet completed'}
        </li>
        <li>Core Stability: {stability ? `${stability.finalScore.toFixed(2)} / 4` : 'not yet completed'}</li>
      </ul>
      {combinedScore != null ? (
        <p style={{ fontSize: '1.5rem' }}>
          Combined score: <strong>{combinedScore.toFixed(2)} / 4</strong>
        </p>
      ) : (
        <p style={{ color: '#666' }}>
          {faultManagement == null && (
            <>
              <Link to={`/questionnaire/${faultManagementQuestionnaireCode}`}>
                Start the Core Fault Management assessment
              </Link>{' '}
            </>
          )}
          {stability == null && (
            <Link to={`/questionnaire/${stabilityQuestionnaireCode}`}>
              Start the Core Stability assessment
            </Link>
          )}{' '}
          to see your combined score.
        </p>
      )}
    </section>
  );
}
