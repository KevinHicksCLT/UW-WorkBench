// Client types for GET /roles/:id/profile (backend/src/lib/roleProfile.ts).
export type ProfileParticipation = {
  valueStreamId: string;
  valueStreamName: string;
  participationType: 'Lead' | 'Support';
};
export type ProfileDeliverableTask = {
  name: string;
  relation: 'Lead' | 'Support';
  l3: string | null;
  l4: string | null;
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
  name: string;
  relation: 'Lead' | 'Support';
  valueStreamId: string | null;
  valueStreamName: string;
  l3: string | null;
  l4: string | null;
  stepNumber: number;
  deliverables: { id: string; title: string }[];
};
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
  deliverables: ProfileDeliverable[];
  taskSummary: ProfileTask[];
  responsibilities: { category: string; items: string[] }[];
};
