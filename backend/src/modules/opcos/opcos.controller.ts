import type { Request, Response } from 'express';
import { z } from 'zod';
import { createOpCo, listOpCos, OpCoNameTakenError, OrganizationNotFoundError } from './opcos.service';

const createOpCoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  country: z.string().trim().min(1).max(100),
  organizationId: z.string().min(1),
});

// Any authenticated user can list OpCos for their own organization (needed for
// ProfilePage's self-service dropdown) — Admin may additionally query any organization.
export async function listOpCosHandler(req: Request, res: Response) {
  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
  if (!organizationId) {
    res.status(400).json({ error: 'organizationId query param is required' });
    return;
  }
  if (req.user!.role !== 'ADMIN' && req.user!.organizationId !== organizationId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.json(await listOpCos(organizationId));
}

export async function createOpCoHandler(req: Request, res: Response) {
  const parsed = createOpCoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const opCo = await createOpCo(parsed.data);
    res.status(201).json(opCo);
  } catch (err) {
    if (err instanceof OpCoNameTakenError) {
      res.status(409).json({ error: 'An OpCo with this name already exists in this organization' });
      return;
    }
    if (err instanceof OrganizationNotFoundError) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }
    throw err;
  }
}
