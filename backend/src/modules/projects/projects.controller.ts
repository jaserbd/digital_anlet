import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireParam } from '../../lib/params';
import {
  addProjectAdmin,
  createProject,
  deleteProject,
  importProject,
  InvalidQuestionnaireSelectionError,
  listProjectAdminCandidates,
  listProjects,
  NotProjectAdminCandidateError,
  OrganizationNotFoundError,
  ProjectHasNoOrganizationsError,
  ProjectOrganizationHasAnswersError,
  ProjectRoleConflictError,
  removeProjectAdmin,
  ProjectNameTakenError,
  ProjectNotEmptyError,
  ProjectNotFoundError,
  updateProject,
} from './projects.service';

const projectNameSchema = z.string().trim().min(1).max(200);

function handleProjectErrors(err: unknown, res: Response): boolean {
  if (err instanceof ProjectNotFoundError) {
    res.status(404).json({ error: 'Project not found' });
    return true;
  }
  if (err instanceof ProjectNameTakenError) {
    res.status(409).json({ error: 'A project with this name already exists' });
    return true;
  }
  if (err instanceof ProjectNotEmptyError) {
    res.status(409).json({ error: 'Remove the project\'s organizations and Project Admins before deleting it' });
    return true;
  }
  if (err instanceof OrganizationNotFoundError) {
    res.status(400).json({ error: 'Organization not found' });
    return true;
  }
  if (err instanceof InvalidQuestionnaireSelectionError) {
    res.status(400).json({
      error: 'Select at least one questionnaire; Core Fault Management and Core Stability go together',
    });
    return true;
  }
  if (err instanceof ProjectOrganizationHasAnswersError) {
    res.status(409).json({
      error: 'Members of this organization already hold answers in this project — move them before removing it',
    });
    return true;
  }
  if (err instanceof NotProjectAdminCandidateError) {
    res.status(400).json({ error: 'Only Application Admins and Detecon members can be Project Admins' });
    return true;
  }
  if (err instanceof ProjectHasNoOrganizationsError) {
    res.status(400).json({ error: 'Add an organization to the project first' });
    return true;
  }
  if (err instanceof ProjectRoleConflictError) {
    res.status(409).json({ error: 'This person already takes part in the project with another role' });
    return true;
  }
  return false;
}

export async function listProjectsHandler(_req: Request, res: Response) {
  res.json(await listProjects());
}

export async function createProjectHandler(req: Request, res: Response) {
  const parsed = z.object({ name: projectNameSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  try {
    res.status(201).json(await createProject(parsed.data.name));
  } catch (err) {
    if (!handleProjectErrors(err, res)) throw err;
  }
}

const updateProjectSchema = z.object({
  name: projectNameSchema.optional(),
  organizationIds: z.array(z.string().min(1)).optional(),
  questionnaireCodes: z.array(z.string().min(1)).optional(),
});

export async function updateProjectHandler(req: Request, res: Response) {
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  try {
    res.json(await updateProject(requireParam(req, 'id'), parsed.data));
  } catch (err) {
    if (!handleProjectErrors(err, res)) throw err;
  }
}

export async function deleteProjectHandler(req: Request, res: Response) {
  try {
    await deleteProject(requireParam(req, 'id'));
    res.status(204).end();
  } catch (err) {
    if (!handleProjectErrors(err, res)) throw err;
  }
}

const nameSchema = z.string().trim().min(1).max(200);
const importProjectSchema = z.object({
  projectName: projectNameSchema,
  organizations: z.array(nameSchema).min(1).max(50),
  questionnaires: z.array(nameSchema).max(50).optional(),
  natCos: z
    .array(z.object({ organization: nameSchema, name: nameSchema, country: z.string().trim().min(1).max(100) }))
    .max(500),
  members: z
    .array(
      z.object({
        // Empty is fine for Project Admins, who administer the whole project.
        organization: z.string().trim().max(200),
        email: z.string().trim().email(),
        role: z.enum(['PROJECT_ADMIN', 'EXECUTIVE', 'NORMAL_USER']),
        firstName: z.string().trim().max(100).optional(),
        lastName: z.string().trim().max(100).optional(),
      }),
    )
    .max(2000),
});

export async function importProjectHandler(req: Request, res: Response) {
  const parsed = importProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: `Invalid import file${issue ? `: ${issue.path.join('.')} ${issue.message}` : ''}` });
    return;
  }
  res.status(201).json(await importProject(parsed.data, req.user!.sub));
}

export async function listProjectAdminCandidatesHandler(_req: Request, res: Response) {
  res.json(await listProjectAdminCandidates());
}

export async function addProjectAdminHandler(req: Request, res: Response) {
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  try {
    res.status(201).json(await addProjectAdmin(requireParam(req, 'id'), parsed.data.userId));
  } catch (err) {
    if (!handleProjectErrors(err, res)) throw err;
  }
}

export async function removeProjectAdminHandler(req: Request, res: Response) {
  try {
    res.json(await removeProjectAdmin(requireParam(req, 'id'), requireParam(req, 'userId')));
  } catch (err) {
    if (!handleProjectErrors(err, res)) throw err;
  }
}
