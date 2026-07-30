import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createOrganization,
  deleteOrganization,
  listOrganizations,
  OrganizationHasDependentsError,
  OrganizationNameTakenError,
  OrganizationNotFoundError,
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

export async function deleteOrganizationHandler(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid organization id' });
    return;
  }

  try {
    await deleteOrganization(id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof OrganizationNotFoundError) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (err instanceof OrganizationHasDependentsError) {
      res
        .status(409)
        .json({ error: 'Cannot delete an organization that still has OpCos or users — remove those first' });
      return;
    }
    throw err;
  }
}
