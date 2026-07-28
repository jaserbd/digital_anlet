import type { Request, Response } from 'express';
import { requireParam } from '../../lib/params';
import {
  getBenchmarkingSummary,
  getOpCoBenchmarkingSummary,
  getOrganizationQuestionnaireSummary,
  QuestionnaireNotFoundError,
} from './insights.service';

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
