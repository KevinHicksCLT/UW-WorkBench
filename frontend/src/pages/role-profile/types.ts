// Client types for GET /roles/:id/profile (backend/src/lib/roleProfile.ts).
import type { TaskValidation } from '../../components/TaskValidationControl';

export type ProfileParticipation = {
  valueStreamId: string;
  valueStreamName: string;
  participationType: 'Lead' | 'Support';
};
export type ProfileDeliverableTask = {
  name: string;
  nodeRoleId: string;
  relation: 'Lead' | 'Support';
  l3: string | null;
  l4: string | null;
  validation: TaskValidation;
};
export type ProfileDeliverable = {
  id: string;
  title: string;
  role_: 'Owner' | 'Contributor' | null;
  valueStreamName: string | null;
  tasks: ProfileDeliverableTask[];
};
export type ProfileTask = {
  nodeId: string;
  nodeRoleId: string;
  name: string;
  relation: 'Lead' | 'Support';
  valueStreamId: string | null;
  valueStreamName: string;
  l3: string | null;
  l4: string | null;
  stepNumber: number;
  deliverables: { id: string; title: string }[];
  /** Applications the task is performed in (task-level NodeAppUsage). */
  apps: { id: string; name: string }[];
  /** Ordered checklist steps wired to the task node (task-level NodeChecklist). */
  checklist: { id: string; text: string }[];
  validation: TaskValidation;
};
export type ProfileApplication = { id: string; name: string; taskCount: number };
export type RoleProfilePayload = {
  id: string;
  name: string;
  description: string | null;
  roleFamily: string | null;
  roleLevel: string | null;
  company: { id: string; name: string };
  division: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  participation: ProfileParticipation[];
  applications: ProfileApplication[];
  deliverables: ProfileDeliverable[];
  taskSummary: ProfileTask[];
  responsibilities: { category: string; items: string[] }[];
};
