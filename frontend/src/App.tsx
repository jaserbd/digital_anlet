import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { HomePage } from './pages/HomePage';
import { ContextPickerPage } from './pages/ContextPickerPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { DomainPickerPage } from './pages/DomainPickerPage';
import { QuestionnairePage } from './pages/QuestionnairePage';
import { ResultsPage } from './pages/ResultsPage';
import { ResultsPickerPage } from './pages/ResultsPickerPage';
import { SingleHvsResultsPage } from './pages/SingleHvsResultsPage';
import { CoreHvsResultsPage } from './pages/CoreHvsResultsPage';
import { AdminPage } from './pages/AdminPage';
import { AdminManagementPage } from './pages/AdminManagementPage';
import { OrganizationDeepDivePage } from './pages/OrganizationDeepDivePage';
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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute requireProfile={false} />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/context" element={<ContextPickerPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['NORMAL_USER', 'EXECUTIVE']} />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/domains" element={<DomainPickerPage />} />
            <Route path="/questionnaire/:code" element={<QuestionnaireRoute />} />
            <Route path="/results" element={<ResultsPickerPage />} />
            <Route path="/results/questionnaire/:code" element={<SingleHvsResultsPage />} />
            <Route path="/results/hvs/:groupCode" element={<CoreHvsResultsPage />} />
            <Route path="/results/:responseId" element={<ResultsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/management" element={<AdminManagementPage />} />
            <Route path="/admin/organizations/:orgId" element={<OrganizationDeepDivePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['EXECUTIVE']} requireProfile={false} />}>
            <Route path="/executive" element={<ExecutivePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
