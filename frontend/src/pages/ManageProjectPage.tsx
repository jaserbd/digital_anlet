import Typography from '@mui/material/Typography';
import { PageShell } from '../components/PageShell';
import { SectionCard } from '../components/SectionCard';
import { BulkCreateUsersForm } from '../components/BulkCreateUsersForm';
import { ManageUsersSection } from '../components/ManageUsersSection';
import { useAuth } from '../context/AuthContext';
import { CreateUserForm, ManageOpCosSection, QuestionnaireSettingsSection } from './AdminManagementPage';

// Project Admin's management page (PROJECTS_PLAN.md): the Management Console sections that apply
// to one organization — members, NatCos and open/close — scoped to the active organization
// (the sections show only that organization; the backend rejects anything else).
export function ManageProjectPage() {
  const { user } = useAuth();
  const organizationName = user?.contexts.find((c) => c.membershipId === user.activeMembershipId)?.organizationName;

  return (
    <PageShell title={`Manage project — ${organizationName ?? ''}`} maxWidth={1400}>
      <SectionCard>
        <Typography variant="body2" color="text.secondary">
          As Project Admin you manage this organization&apos;s members (Executives and Normal Users),
          its NatCos and which assessments accept responses. Other Project Admins and Application
          Admins are managed by an Application Admin.
        </Typography>
      </SectionCard>
      <CreateUserForm />
      <SectionCard title="Bulk-create users">
        <BulkCreateUsersForm />
      </SectionCard>
      <ManageUsersSection />
      <ManageOpCosSection />
      <QuestionnaireSettingsSection />
    </PageShell>
  );
}
