import type { ReferenceListCategory } from '@prisma/client';
import type { ProjectImportMemberDto, ProjectImportResultRowDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { generatePassword } from '../../lib/generatePassword';
import { normalizeEmail } from '../../lib/email';
import {
  AlreadyMemberError,
  EmailTakenError,
  OtherOrganizationError,
  OutsideProjectError,
  SuperAdminRequiredError,
  createUser,
} from '../users/users.service';

// Members rows of an Excel import (PROJECT_ADMIN_IMPORT_PLAN.md), shared by the Application
// Admin's project import and the Project Admin's member import: creates the account or adds the
// membership, then fills the membership's profile (NatCo, working domain, designation) — empty
// fields only, so nothing a user or admin already set is overwritten.

/** Matching key for names typed by hand: ignores case, spacing and punctuation
 * ("Sr. Engineer" = "sr engineer" = "SR-Engineer"). */
export function labelKey(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** The spelling stored for a new entry: trimmed, single spaces. */
export function cleanLabel(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export interface ImportOrganization {
  id: string;
  name: string;
}

export interface MemberImportOptions {
  projectId: string;
  // Organizations rows may name, by labelKey.
  organizations: Map<string, ImportOrganization>;
  callerId: string;
  // Project Admin import: createUser is scoped to the row's organization + this project.
  asProjectAdmin: boolean;
  unknownOrganization: (name: string) => string;
}

/** A global reference list (Working Domain, Designation) that grows with new values. */
class GrowingCatalog {
  private byKey: Map<string, string> | null = null;
  constructor(private readonly category: ReferenceListCategory) {}

  async resolve(raw: string | undefined): Promise<string | null> {
    const name = raw ? cleanLabel(raw) : '';
    if (!name || !labelKey(name)) return null;
    if (!this.byKey) {
      const entries = await prisma.referenceListEntry.findMany({
        where: { category: this.category, organizationId: null },
        select: { name: true },
      });
      this.byKey = new Map(entries.map((e) => [labelKey(e.name), e.name]));
    }
    const existing = this.byKey.get(labelKey(name));
    if (existing) return existing;
    await prisma.referenceListEntry.create({ data: { category: this.category, name, organizationId: null } });
    this.byKey.set(labelKey(name), name);
    return name;
  }
}

/** NatCos of the import's organizations, created on demand when a country is given. */
class NatCoCatalog {
  private opCos = new Map<string, Map<string, string>>(); // organizationId -> key -> opCoId
  private countries: Map<string, string> | null = null;

  async resolve(
    organizationId: string,
    rawName: string | undefined,
    rawCountry: string | undefined,
  ): Promise<{ opCoId: string | null; warning?: string }> {
    const name = rawName ? cleanLabel(rawName) : '';
    if (!name) return { opCoId: null };
    let byKey = this.opCos.get(organizationId);
    if (!byKey) {
      const existing = await prisma.opCo.findMany({ where: { organizationId }, select: { id: true, name: true } });
      byKey = new Map(existing.map((o) => [labelKey(o.name), o.id]));
      this.opCos.set(organizationId, byKey);
    }
    const found = byKey.get(labelKey(name));
    if (found) return { opCoId: found };

    if (!rawCountry?.trim()) {
      return { opCoId: null, warning: `NatCo "${name}" does not exist — add its Country to create it` };
    }
    if (!this.countries) {
      const entries = await prisma.referenceListEntry.findMany({
        where: { category: 'COUNTRY', organizationId: null },
        select: { name: true },
      });
      this.countries = new Map(entries.map((e) => [labelKey(e.name), e.name]));
    }
    const country = this.countries.get(labelKey(rawCountry));
    if (!country) {
      return { opCoId: null, warning: `Country "${rawCountry.trim()}" is not in the Country list — NatCo "${name}" not created` };
    }
    // Same catalogs as the Management Console: the name goes on the organization's NatCo Name list.
    const catalog = await prisma.referenceListEntry.findMany({
      where: { category: 'NATCO_NAME', organizationId },
      select: { name: true },
    });
    const catalogName = catalog.find((e) => labelKey(e.name) === labelKey(name))?.name;
    if (!catalogName) {
      await prisma.referenceListEntry.create({ data: { category: 'NATCO_NAME', organizationId, name } });
    }
    const opCo = await prisma.opCo.create({
      data: { name: catalogName ?? name, country, organizationId },
      select: { id: true },
    });
    byKey.set(labelKey(name), opCo.id);
    return { opCoId: opCo.id };
  }
}

export async function importMembers(
  members: ProjectImportMemberDto[],
  options: MemberImportOptions,
): Promise<ProjectImportResultRowDto[]> {
  const rows: ProjectImportResultRowDto[] = [];
  const natCos = new NatCoCatalog();
  const workingDomains = new GrowingCatalog('WORKING_DOMAIN');
  const designations = new GrowingCatalog('DESIGNATION');

  for (const [index, member] of members.entries()) {
    const email = normalizeEmail(member.email);
    const base = { sheet: 'Members' as const, row: index + 1, label: email, role: member.role };
    // Project Admin rows are handled by the caller (Application Admin import only).
    const organization = options.organizations.get(labelKey(member.organization));
    if (!organization) {
      rows.push({ ...base, organization: member.organization, status: 'error', error: options.unknownOrganization(member.organization) });
      continue;
    }
    const withOrganization = { ...base, organization: organization.name };

    const password = generatePassword();
    let status: ProjectImportResultRowDto['status'];
    let tempPassword: string | undefined;
    try {
      const result = await createUser(
        {
          email,
          password,
          role: member.role,
          organizationId: organization.id,
          projectId: options.projectId,
          firstName: member.firstName?.trim() || undefined,
          lastName: member.lastName?.trim() || undefined,
        },
        options.callerId,
        options.asProjectAdmin ? { organizationId: organization.id, projectId: options.projectId } : undefined,
      );
      status = result.status;
      if (result.status === 'created') tempPassword = password;
    } catch (err) {
      if (!(err instanceof AlreadyMemberError)) {
        const error =
          err instanceof EmailTakenError || err instanceof SuperAdminRequiredError || err instanceof OutsideProjectError
            ? 'This email belongs to an admin account'
            : err instanceof OtherOrganizationError
              ? `Already belongs to ${err.organizationName} — a user is in one organization only`
              : 'Failed to create user';
        rows.push({ ...withOrganization, status: 'error', error });
        continue;
      }
      status = 'existing';
    }

    const membership = await prisma.membership.findFirst({
      where: { organizationId: organization.id, projectId: options.projectId, user: { email } },
      select: { id: true, role: true, opCoId: true, workingDomain: true, designation: true },
    });
    if (status === 'existing' && membership?.role !== member.role) {
      rows.push({
        ...withOrganization,
        status: 'error',
        error: `Already in this project with another role (${membership?.role ?? 'unknown'}) — change it under Existing users`,
      });
      continue;
    }

    const warning = membership
      ? await fillProfile(membership, organization.id, member, { natCos, workingDomains, designations })
      : undefined;
    rows.push({ ...withOrganization, status, ...(tempPassword ? { tempPassword } : {}), ...(warning ? { warning } : {}) });
  }
  return rows;
}

/** Fills the membership's empty profile fields from the row; returns a warning for what was left out. */
async function fillProfile(
  membership: { id: string; opCoId: string | null; workingDomain: string | null; designation: string | null },
  organizationId: string,
  member: ProjectImportMemberDto,
  catalogs: { natCos: NatCoCatalog; workingDomains: GrowingCatalog; designations: GrowingCatalog },
): Promise<string | undefined> {
  const warnings: string[] = [];
  const kept: string[] = [];
  const data: { opCoId?: string; workingDomain?: string; designation?: string } = {};

  if (member.natCo?.trim()) {
    const { opCoId, warning } = await catalogs.natCos.resolve(organizationId, member.natCo, member.country);
    if (warning) warnings.push(warning);
    if (opCoId && !membership.opCoId) data.opCoId = opCoId;
    else if (opCoId && membership.opCoId !== opCoId) kept.push('NatCo');
  }
  const workingDomain = await catalogs.workingDomains.resolve(member.workingDomain);
  if (workingDomain && !membership.workingDomain) data.workingDomain = workingDomain;
  else if (workingDomain && membership.workingDomain !== workingDomain) kept.push('working domain');
  const designation = await catalogs.designations.resolve(member.designation);
  if (designation && !membership.designation) data.designation = designation;
  else if (designation && membership.designation !== designation) kept.push('designation');

  if (Object.keys(data).length > 0) {
    await prisma.membership.update({ where: { id: membership.id }, data });
  }
  if (kept.length > 0) warnings.push(`Kept the existing ${kept.join(', ')}`);
  return warnings.length > 0 ? warnings.join('; ') : undefined;
}
