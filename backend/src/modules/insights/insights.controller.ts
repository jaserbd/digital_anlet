import type { Request, Response } from 'express';
import { requireParam } from '../../lib/params';
import { findHvsGroupByCode, type HvsGroupDefinition } from '../questionnaire/hvsGroups';
import {
  getAnswerDrilldown,
  getBenchmarkingSummary,
  getCognitiveActivitySummary,
  getCombinedBenchmarkingSummary,
  getCrossOrgCommentCollection,
  getOpCoBenchmarkingSummary,
  getOrganizationQuestionnaireSummary,
  QuestionnaireNotFoundError,
} from './insights.service';

function requireHvsGroup(req: Request, res: Response): HvsGroupDefinition | null {
  const groupCode = req.query.groupCode;
  if (typeof groupCode !== 'string') {
    res.status(400).json({ error: 'groupCode query param is required' });
    return null;
  }
  const group = findHvsGroupByCode(groupCode);
  if (!group) {
    res.status(404).json({ error: 'HVS group not found' });
    return null;
  }
  return group;
}

export async function getOrganizationQuestionnaireSummaryHandler(req: Request, res: Response) {
  const orgId = requireParam(req, 'orgId');
  const questionnaireCode = req.query.questionnaireCode;
  if (typeof questionnaireCode !== 'string') {
    res.status(400).json({ error: 'questionnaireCode query param is required' });
    return;
  }

  // Executive: own organization only. Admin: any organization.
  if (req.user!.role === 'EXECUTIVE' && req.user!.organizationId !== orgId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const summary = await getOrganizationQuestionnaireSummary(orgId, questionnaireCode);
    res.json(summary);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

export async function getBenchmarkingSummaryHandler(req: Request, res: Response) {
  const questionnaireCode = req.query.questionnaireCode;
  if (typeof questionnaireCode !== 'string') {
    res.status(400).json({ error: 'questionnaireCode query param is required' });
    return;
  }

  try {
    const summary = await getBenchmarkingSummary(questionnaireCode);
    res.json(summary);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

export async function getOpCoBenchmarkingSummaryHandler(req: Request, res: Response) {
  const orgId = requireParam(req, 'orgId');
  const questionnaireCode = req.query.questionnaireCode;
  if (typeof questionnaireCode !== 'string') {
    res.status(400).json({ error: 'questionnaireCode query param is required' });
    return;
  }

  // Executive: own organization only. Admin: any organization.
  if (req.user!.role === 'EXECUTIVE' && req.user!.organizationId !== orgId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const summary = await getOpCoBenchmarkingSummary(orgId, questionnaireCode);
    res.json(summary);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

export async function getAnswerDrilldownHandler(req: Request, res: Response) {
  const orgId = requireParam(req, 'orgId');
  const questionnaireCode = req.query.questionnaireCode;
  if (typeof questionnaireCode !== 'string') {
    res.status(400).json({ error: 'questionnaireCode query param is required' });
    return;
  }

  // Executive: own organization only. Admin: any organization.
  if (req.user!.role === 'EXECUTIVE' && req.user!.organizationId !== orgId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const drilldown = await getAnswerDrilldown(orgId, questionnaireCode);
    res.json(drilldown);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

export async function getCognitiveActivitySummaryHandler(req: Request, res: Response) {
  const orgId = requireParam(req, 'orgId');
  const questionnaireCode = req.query.questionnaireCode;
  if (typeof questionnaireCode !== 'string') {
    res.status(400).json({ error: 'questionnaireCode query param is required' });
    return;
  }
  const opCoId = typeof req.query.opCoId === 'string' ? req.query.opCoId : undefined;
  const country = typeof req.query.country === 'string' ? req.query.country : undefined;

  // Executive: own organization only. Admin: any organization.
  if (req.user!.role === 'EXECUTIVE' && req.user!.organizationId !== orgId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const summary = await getCognitiveActivitySummary(orgId, questionnaireCode, { opCoId, country });
    res.json(summary);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

export async function getCrossOrgCommentCollectionHandler(req: Request, res: Response) {
  const questionnaireCode = req.query.questionnaireCode;
  if (typeof questionnaireCode !== 'string') {
    res.status(400).json({ error: 'questionnaireCode query param is required' });
    return;
  }

  try {
    const collection = await getCrossOrgCommentCollection(questionnaireCode);
    res.json(collection);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

export async function getCombinedBenchmarkingSummaryHandler(req: Request, res: Response) {
  const group = requireHvsGroup(req, res);
  if (!group) return;

  try {
    const summary = await getCombinedBenchmarkingSummary(group);
    res.json(summary);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

export async function getCombinedOpCoBenchmarkingSummaryHandler(req: Request, res: Response) {
  const orgId = requireParam(req, 'orgId');
  const group = requireHvsGroup(req, res);
  if (!group) return;

  // Executive: own organization only. Admin: any organization.
  if (req.user!.role === 'EXECUTIVE' && req.user!.organizationId !== orgId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const summary = await getCombinedBenchmarkingSummary(group, orgId);
    res.json(summary);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}
