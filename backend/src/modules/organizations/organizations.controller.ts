import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createOrganization,
  listOrganizations,
  OrganizationNameTakenError,
} from './organizations.service';

const createOrgSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export async function listOrganizationsHandler(_req: Request, res: Response) {
  res.json(await listOrganizations());
}

export async function createOrganizationHandler(req: Request, res: Response) {
  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const org = await createOrganization(parsed.data.name);
    res.status(201).json(org);
  } catch (err) {
    if (err instanceof OrganizationNameTakenError) {
      res.status(409).json({ error: 'An organization with this name already exists' });
      return;
    }
    throw err;
  }
}
