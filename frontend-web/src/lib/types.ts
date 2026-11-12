export type TaskStatus = 'published' | 'completed' | 'paused';
export type AssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'expired';
export type SubmissionStatus =
  | 'uploading'
  | 'qc_processing'
  | 'qc_passed'
  | 'qc_failed'
  | 'approved'
  | 'rejected'
  | 'resubmission_requested';

export type DecisionType = 'approved' | 'rejected' | 'resubmission_requested';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  min_duration_seconds: number;
  max_duration_seconds: number;
  required_codec: string;
  min_resolution: string;
  total_slots: number;
  claimed_slots: number;
  status: TaskStatus;
  created_at: string;
  reward_cents?: number;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  worker_id: string;
  status: AssignmentStatus;
  claim_expires_at: string;
  assigned_at: string;
  completed_at?: string;
  task?: Task;
}

export interface ExtractedMetadata {
  duration?: number;
  codec?: string;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  has_audio?: boolean;
  audio_channels?: number;
  file_format?: string;
}

export interface RuleResults {
  duration_pass: boolean;
  duration_actual?: number;
  codec_pass: boolean;
  codec_actual?: string;
  resolution_pass: boolean;
  resolution_actual?: string;
  audio_pass: boolean;
  audio_actual?: boolean;
}

export interface QCRun {
  id: string;
  submission_id: string;
  status: 'pending' | 'passed' | 'failed';
  extracted_metadata?: ExtractedMetadata;
  rule_results?: RuleResults;
  error_message?: string;
  completed_at?: string;
}

export interface ReviewDecision {
  id: string;
  submission_id: string;
  reviewer_id: string;
  decision: DecisionType;
  reason_code?: string;
  feedback_notes?: string;
  created_at: string;
}

export interface VideoSubmission {
  id: string;
  assignment_id: string;
  worker_id: string;
  submission_version: number;
  storage_key: string;
  file_name: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
  video_url?: string;
  qc_run?: QCRun;
  review_decision?: ReviewDecision;
  task?: Task;
}

export interface UploadPartUrl {
  part_number: number;
  presigned_url: string;
}

export interface UploadSessionResponse {
  submission_id: string;
  upload_id: string;
  part_size_bytes: number;
  total_parts: number;
  parts: UploadPartUrl[];
}

export interface CompletedPart {
  part_number: number;
  etag: string;
}
