import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createReferenceListEntry,
  deleteReferenceListEntry,
  listReferenceListEntries,
  OrganizationIdNotAllowedError,
  OrganizationIdRequiredError,
  OrganizationNotFoundError,
  ReferenceListEntryNameTakenError,
  ReferenceListEntryNotFoundError,
} from './referenceLists.service';

const categorySchema = z.enum(['COUNTRY', 'WORKING_DOMAIN', 'DESIGNATION', 'NATCO_NAME']);

const createReferenceListEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  organizationId: z.string().min(1).optional(),
});

// Any authenticated user can list a category (needed for ProfilePage's/OpCo creation's
// dropdowns) — for NATCO_NAME, a non-Admin may only query their own organization, same
// convention as GET /opcos.
export async function listReferenceListEntriesHandler(req: Request, res: Response) {
  const categoryParsed = categorySchema.safeParse(req.params.category);
  if (!categoryParsed.success) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }
  const category = categoryParsed.data;

  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
  if (category === 'NATCO_NAME') {
    if (!organizationId) {
      res.status(400).json({ error: 'organizationId query param is required for NATCO_NAME' });
      return;
    }
    if (req.user!.role !== 'ADMIN' && req.user!.organizationId !== organizationId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  } else if (organizationId) {
    res.status(400).json({ error: 'organizationId is not applicable to this category' });
    return;
  }

  res.json(await listReferenceListEntries(category, organizationId));
}

export async function createReferenceListEntryHandler(req: Request, res: Response) {
  const categoryParsed = categorySchema.safeParse(req.params.category);
  if (!categoryParsed.success) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }

  const bodyParsed = createReferenceListEntrySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const entry = await createReferenceListEntry({ category: categoryParsed.data, ...bodyParsed.data });
    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof ReferenceListEntryNameTakenError) {
      res.status(409).json({ error: 'This value already exists in the list' });
      return;
    }
    if (err instanceof OrganizationNotFoundError) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }
    if (err instanceof OrganizationIdRequiredError) {
      res.status(400).json({ error: 'organizationId is required for NATCO_NAME' });
      return;
    }
    if (err instanceof OrganizationIdNotAllowedError) {
      res.status(400).json({ error: 'organizationId is not applicable to this category' });
      return;
    }
    throw err;
  }
}

export async function deleteReferenceListEntryHandler(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  try {
    await deleteReferenceListEntry(id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ReferenceListEntryNotFoundError) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    throw err;
  }
}
