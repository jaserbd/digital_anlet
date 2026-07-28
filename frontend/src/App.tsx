import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { DomainPickerPage } from './pages/DomainPickerPage';
import { QuestionnairePage } from './pages/QuestionnairePage';
import { ResultsPage } from './pages/ResultsPage';
import { AdminPage } from './pages/AdminPage';
import { ExecutivePage } from './pages/ExecutivePage';

// Forces QuestionnairePage to remount (resetting its local answer/step state) when the
// questionnaire code in the URL changes, rather than reusing the same instance.
function QuestionnaireRoute() {
  const { code } = useParams<{ code: string }>();
  return <QuestionnairePage key={code} />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['NORMAL_USER']} />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/domains" element={<DomainPickerPage />} />
            <Route path="/questionnaire/:code" element={<QuestionnaireRoute />} />
            <Route path="/results/:responseId" element={<ResultsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['EXECUTIVE']} />}>
            <Route path="/executive" element={<ExecutivePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
