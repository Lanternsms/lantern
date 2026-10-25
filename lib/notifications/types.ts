import 'server-only';

export type Category =
  | 'results'
  | 'attendance'
  | 'fees'
  | 'learning'
  | 'qa'
  | 'announcements'
  | 'account'
  | 'system';

export type EventKey =
  // Results
  | 'results_published'
  | 'batch_submitted_for_approval'
  | 'batch_approved'
  | 'batch_rejected'
  | 'batch_returned'
  // Attendance
  | 'attendance_marked'
  | 'lms_period_attendance_saved'
  // Fees
  | 'payment_recorded'
  | 'fee_structure_changed'
  // Account
  | 'role_assigned'
  | 'role_removed'
  | 'role_permission_granted'
  | 'role_permission_revoked'
  // Learning (LMS)
  | 'lms_lesson_status_changed'
  | 'lms_activity_status_changed'
  | 'lms_activity_updated'
  | 'lms_activity_brief_attached'
  | 'lms_submission_marked'
  // Q&A
  | 'lms_question_asked'
  | 'lms_question_replied'
  | 'lms_thread_status_changed'
  // Announcements
  | 'announcement_posted'
  // System
  | 'lms_orphan_storage_cleanup_failed';

export interface NotificationInput {
  schoolId: string;
  recipientId: string;
  type: string; // free‑form type identifier
  category: Category;
  title: string;
  body?: string;
  url?: string;
  studentId?: string;
  actorId?: string;
  dedupeKey?: string;
  onDuplicate?: 'ignore' | 'refresh';
}

export interface InsertedNotification {
  id: string;
  recipient: string;
  type: string;
  category: Category;
  studentId?: string | null;
}
