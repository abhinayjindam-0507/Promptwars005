import type {
  ActivityEvent,
  DemoPatient,
  DemoReport,
  DemoTrendPoint,
  VerificationItem,
  WorkspaceStat,
} from '../types'

export const DEMO_NOTICE =
  'All figures on this screen are synthetic demo data for product preview.'

export const workspaceStats: WorkspaceStat[] = [
  {
    id: 'patients',
    label: 'Patients',
    value: 24,
    hint: 'Indexed in this demo workspace',
  },
  {
    id: 'reports',
    label: 'Reports Processed',
    value: 86,
    hint: 'Structured from uploaded documents',
  },
  {
    id: 'pending',
    label: 'Pending Verification',
    value: 7,
    hint: 'Awaiting human review',
  },
  {
    id: 'conflicts',
    label: 'Conflicts Detected',
    value: 3,
    hint: 'Values that need source comparison',
  },
]

export const demoPatient: DemoPatient = {
  code: 'ML-PT-4821',
  age: 54,
  sex: 'Female',
  latestReportDate: '4 Sep 2026',
  labResultCount: 18,
  verificationStatus: 'pending_review',
}

export const recentReports: DemoReport[] = [
  {
    id: 'rpt-1048',
    title: 'Comprehensive metabolic panel',
    patientCode: 'ML-PT-4821',
    kind: 'lab_panel',
    receivedAt: '4 Sep 2026',
    status: 'pending_review',
  },
  {
    id: 'rpt-1047',
    title: 'Chest radiograph narrative',
    patientCode: 'ML-PT-3902',
    kind: 'imaging_summary',
    receivedAt: '3 Sep 2026',
    status: 'in_validation',
  },
  {
    id: 'rpt-1044',
    title: 'Discharge summary excerpt',
    patientCode: 'ML-PT-2188',
    kind: 'discharge_note',
    receivedAt: '2 Sep 2026',
    status: 'verified',
  },
  {
    id: 'rpt-1041',
    title: 'Lipid panel',
    patientCode: 'ML-PT-5510',
    kind: 'lab_panel',
    receivedAt: '1 Sep 2026',
    status: 'conflict',
  },
]

export const verificationQueue: VerificationItem[] = [
  {
    id: 'vq-21',
    patientCode: 'ML-PT-4821',
    summary: 'Creatinine value differs across two source pages',
    reason: 'Source mismatch',
    status: 'conflict',
    queuedAt: 'Today, 09:14',
  },
  {
    id: 'vq-20',
    patientCode: 'ML-PT-3902',
    summary: 'Imaging impression extracted; reviewer not assigned',
    reason: 'Needs human review',
    status: 'pending_review',
    queuedAt: 'Yesterday',
  },
  {
    id: 'vq-18',
    patientCode: 'ML-PT-5510',
    summary: 'Reference range text incomplete in source scan',
    reason: 'Low extraction confidence',
    status: 'in_validation',
    queuedAt: '1 Sep 2026',
  },
]

export const activityEvents: ActivityEvent[] = [
  {
    id: 'act-12',
    title: 'Report indexed',
    detail: 'ML-PT-4821 · metabolic panel added to review queue',
    occurredAt: '4 Sep · 16:40',
  },
  {
    id: 'act-11',
    title: 'Provenance linked',
    detail: 'Extraction spans mapped to pages 2–3 of source PDF',
    occurredAt: '4 Sep · 16:41',
  },
  {
    id: 'act-10',
    title: 'Conflict flagged',
    detail: 'Two creatinine mentions did not reconcile automatically',
    occurredAt: '4 Sep · 16:42',
  },
  {
    id: 'act-09',
    title: 'Record verified',
    detail: 'ML-PT-2188 discharge excerpt marked verified by reviewer',
    occurredAt: '2 Sep · 11:05',
  },
]

export const demoTrendSeries: DemoTrendPoint[] = [
  { label: 'W1', value: 12.4 },
  { label: 'W2', value: 12.1 },
  { label: 'W3', value: 12.6 },
  { label: 'W4', value: 12.3 },
  { label: 'W5', value: 12.8 },
  { label: 'W6', value: 12.5 },
]
