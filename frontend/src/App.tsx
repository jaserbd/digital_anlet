import { useEffect, useState } from 'react';

function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => setApiStatus(data.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setApiStatus('error'));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Anlet — AN Maturity Assessment</h1>
      <p>Backend API status: {apiStatus}</p>
    </main>
  );
}

export default App;
