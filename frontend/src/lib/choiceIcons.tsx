import type { ReactElement } from 'react';
import CellTowerIcon from '@mui/icons-material/CellTower';
import HubIcon from '@mui/icons-material/Hub';
import RouterIcon from '@mui/icons-material/Router';
import LanIcon from '@mui/icons-material/Lan';
import CableIcon from '@mui/icons-material/Cable';
import ShieldIcon from '@mui/icons-material/Shield';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import BalanceIcon from '@mui/icons-material/Balance';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import MapIcon from '@mui/icons-material/Map';
import SpeedIcon from '@mui/icons-material/Speed';
import EnergySavingsLeafIcon from '@mui/icons-material/EnergySavingsLeaf';
import BuildIcon from '@mui/icons-material/Build';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedIcon from '@mui/icons-material/Verified';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import CategoryIcon from '@mui/icons-material/Category';

// Icons for the Domain / HVS picker cards (ONBOARDING_SECURITY_PLAN.md Phase 5). Names come from
// the seeded questionnaires (networkType / hvsCategory); anything new falls back to a neutral icon.

const DOMAIN_ICONS: Record<string, ReactElement> = {
  RAN: <CellTowerIcon />,
  Core: <HubIcon />,
  IP: <RouterIcon />,
  Transport: <LanIcon />,
  'Fixed Access': <CableIcon />,
  Security: <ShieldIcon />,
  'Home Broadband': <HomeIcon />,
  'Individual Services': <PersonIcon />,
  'Private Line': <BusinessIcon />,
  'IP Private Line': <BusinessIcon />,
};

const HVS_ICONS: Record<string, ReactElement> = {
  'Fault Management': <ReportProblemOutlinedIcon />,
  Stability: <BalanceIcon />,
  'Change Management': <SwapHorizIcon />,
  'Complaint Handling': <SupportAgentIcon />,
  Deployment: <RocketLaunchOutlinedIcon />,
  'Energy Efficiency Optimization': <EnergySavingsLeafIcon />,
  Planning: <MapIcon />,
  'Proactive Security': <SecurityIcon />,
  'Quality Optimization': <SpeedIcon />,
  'Routine Maintenance': <BuildIcon />,
  'Service Assurance': <VerifiedIcon />,
  'Service Delivery': <LocalShippingIcon />,
  'Service Fault Management': <BugReportOutlinedIcon />,
};

export function domainIcon(domain: string): ReactElement {
  return DOMAIN_ICONS[domain] ?? <CategoryIcon />;
}

export function hvsIcon(hvs: string): ReactElement {
  return HVS_ICONS[hvs] ?? <CategoryIcon />;
}
