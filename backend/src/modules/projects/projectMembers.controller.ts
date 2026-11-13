import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  getMemberImportContext,
  getProjectQuestionnaireSelection,
  importProjectMembers,
  setProjectQuestionnaireSelection,
} from './projectMembers.service';
import { InvalidQuestionnaireSelectionError } from './projects.service';
import { importMemberSchema } from './projects.controller';

// The Project Admin's project is the active context's (requireRole('PROJECT_ADMIN') on the router).
function activeProjectId(req: Request, res: Response): string | null {
  const projectId = req.user!.projectId;
  if (!projectId) res.status(400).json({ error: 'Switch to a project to import members' });
  return projectId;
}

export async function getMemberImportContextHandler(req: Request, res: Response) {
  const projectId = activeProjectId(req, res);
  if (projectId) res.json(await getMemberImportContext(projectId));
}

const importProjectMembersSchema = z.object({
  members: z.array(importMemberSchema.extend({ role: z.enum(['EXECUTIVE', 'NORMAL_USER']) })).min(1).max(2000),
});

export async function importProjectMembersHandler(req: Request, res: Response) {
  const parsed = importProjectMembersSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: `Invalid import file${issue ? `: ${issue.path.join('.')} ${issue.message}` : ''}` });
    return;
  }
  const projectId = activeProjectId(req, res);
  if (projectId) res.status(201).json(await importProjectMembers(projectId, parsed.data.members, req.user!.sub));
}

export async function getProjectQuestionnairesHandler(req: Request, res: Response) {
  const projectId = activeProjectId(req, res);
  if (projectId) res.json(await getProjectQuestionnaireSelection(projectId));
}

const projectQuestionnairesSchema = z.object({ questionnaireCodes: z.array(z.string().min(1).max(100)).max(100) });

export async function setProjectQuestionnairesHandler(req: Request, res: Response) {
  const parsed = projectQuestionnairesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const projectId = activeProjectId(req, res);
  if (!projectId) return;
  try {
    res.json(await setProjectQuestionnaireSelection(projectId, parsed.data.questionnaireCodes));
  } catch (err) {
    if (err instanceof InvalidQuestionnaireSelectionError) {
      res.status(400).json({ error: 'Select at least one questionnaire; Core Fault Management and Core Stability go together' });
      return;
    }
    throw err;
  }
}
