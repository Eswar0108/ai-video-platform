// Real API Client connecting to FastAPI Backend
const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000/api/v1';
    }
    return '/api/v1'; // Proxies via next.config.js rewrites on Vercel
  }
  return 'http://localhost:8000/api/v1';
};

const API_BASE = getApiBase();

// Token storage
let workerToken: string | null = null;
let adminToken: string | null = null;

export async function getAuthToken(role: 'worker' | 'admin'): Promise<string> {
  if (role === 'admin' && adminToken) return adminToken;
  if (role === 'worker' && workerToken) return workerToken;

  const email = role === 'admin' ? 'admin@example.com' : 'worker@example.com';
  const password = role === 'admin' ? 'admin123' : 'worker123';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      throw new Error(`Login failed for ${email}: ${res.statusText}`);
    }

    const data = await res.json();
    if (role === 'admin') {
      adminToken = data.access_token;
      return adminToken!;
    } else {
      workerToken = data.access_token;
      return workerToken!;
    }
  } catch (err) {
    console.error('Auth error:', err);
    throw err;
  }
}

export const api = {
  // TASKS
  async getTasks(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return await res.json();
  },

  async createTask(taskData: any): Promise<any> {
    const token = await getAuthToken('admin');
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(taskData),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return await res.json();
  },

  async claimTask(taskId: string): Promise<any> {
    const token = await getAuthToken('worker');
    const res = await fetch(`${API_BASE}/tasks/${taskId}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to claim task' }));
      throw new Error(err.detail || 'Failed to claim task');
    }
    return await res.json();
  },

  // SUBMISSIONS & UPLOAD
  async createSubmission(assignmentId: string, fileName: string, fileSizeBytes: number): Promise<any> {
    const token = await getAuthToken('worker');
    const res = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assignment_id: assignmentId,
        file_name: fileName,
        file_size_bytes: fileSizeBytes,
      }),
    });
    if (!res.ok) throw new Error('Failed to initialize submission');
    return await res.json();
  },

  async createUploadSession(submissionId: string, partSizeBytes: number, totalParts: number): Promise<any> {
    const token = await getAuthToken('worker');
    const res = await fetch(`${API_BASE}/submissions/${submissionId}/upload-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        part_size_bytes: partSizeBytes,
        total_parts: totalParts,
      }),
    });
    if (!res.ok) throw new Error('Failed to create upload session');
    return await res.json();
  },

  async uploadPart(uploadUrl: string, chunkBlob: Blob): Promise<string> {
    // If the upload_url is relative, prefix with API base origin
    let targetUrl = uploadUrl;
    if (uploadUrl.startsWith('/')) {
      targetUrl = `http://localhost:8000${uploadUrl}`;
    }

    const res = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: chunkBlob,
    });

    if (!res.ok) {
      throw new Error(`Part upload failed with status ${res.status}`);
    }

    // Extract ETag header
    const etagHeader = res.headers.get('ETag') || res.headers.get('etag');
    if (etagHeader) {
      return etagHeader.replace(/"/g, '');
    }

    // If local endpoint returns JSON with etag
    try {
      const data = await res.json();
      if (data.etag) return data.etag.replace(/"/g, '');
    } catch {}

    return `part-etag-${Date.now()}`;
  },

  async completeUpload(submissionId: string, parts: { part_number: number; etag: string }[], fileSizeBytes: number): Promise<any> {
    const token = await getAuthToken('worker');
    const res = await fetch(`${API_BASE}/submissions/${submissionId}/complete-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        parts: parts,
        file_size_bytes: fileSizeBytes,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload completion failed' }));
      throw new Error(err.detail || 'Upload completion failed');
    }
    return await res.json();
  },

  async getSubmission(submissionId: string): Promise<any> {
    const token = await getAuthToken('worker');
    const res = await fetch(`${API_BASE}/submissions/${submissionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  },

  async getWorkerSubmissions(): Promise<any[]> {
    const token = await getAuthToken('worker');
    const res = await fetch(`${API_BASE}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  },

  // REVIEW
  async getReviewQueue(): Promise<any[]> {
    const token = await getAuthToken('admin');
    const res = await fetch(`${API_BASE}/review/queue`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch review queue');
    return await res.json();
  },

  async submitReview(submissionId: string, decision: 'approved' | 'rejected' | 'resubmission_requested', reasonCode?: string, feedbackNotes?: string): Promise<any> {
    const token = await getAuthToken('admin');
    const res = await fetch(`${API_BASE}/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        decision,
        reason_code: reasonCode || null,
        feedback_notes: feedbackNotes || null,
      }),
    });
    if (!res.ok) throw new Error('Failed to record review decision');
    return await res.json();
  },

  // DATASET MANIFEST
  async getApprovedDataset(): Promise<any> {
    const res = await fetch(`${API_BASE}/datasets/approved`);
    if (!res.ok) throw new Error('Failed to fetch dataset manifest');
    return await res.json();
  },
};
