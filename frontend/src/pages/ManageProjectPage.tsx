import Typography from '@mui/material/Typography';
import { PageShell } from '../components/PageShell';
import { SectionCard } from '../components/SectionCard';
import { ManageUsersSection } from '../components/ManageUsersSection';
import { useAuth } from '../context/AuthContext';
import { CreateUserForm, ManageOpCosSection, QuestionnaireSettingsSection } from './AdminManagementPage';

// Project Admin's management page (PROJECTS_PLAN.md): the Management Console sections that apply
// to one organization — members, NatCos and open/close — scoped to the active organization
// (the sections show only that organization; the backend rejects anything else).
export function ManageProjectPage() {
  const { user } = useAuth();
  const active = user?.contexts.find((c) => c.membershipId === user.activeMembershipId);
  const where = active ? (active.projectName ? `${active.projectName} · ${active.organizationName}` : active.organizationName) : '';

  return (
    <PageShell title={`Manage project — ${where}`} maxWidth={1400}>
      <SectionCard>
        <Typography variant="body2" color="text.secondary">
          As Project Admin you manage this organization&apos;s members in this project (Executives and
          Normal Users), its NatCos and which assessments accept responses here. Project Admins are
          added and removed by an Application Admin on the Projects list.
        </Typography>
      </SectionCard>
      <CreateUserForm />
      <ManageUsersSection />
      <ManageOpCosSection />
      <QuestionnaireSettingsSection />
    </PageShell>
  );
}
