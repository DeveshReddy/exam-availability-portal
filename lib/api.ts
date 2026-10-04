const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  return (await res.text()) as unknown as T;
}

// ─── Auth ───────────────────────────────────────────────────────────────────
export interface LoginRequest { id: string; password: string; }

export async function login(payload: LoginRequest) {
  return request<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Student ────────────────────────────────────────────────────────────────
export interface Student {
  regNo: string;
  name: string;
  email: string;
  department: string;
  faName?: string;
  faMobile?: string;
  submissions?: ExamSubmission[];
}

export interface ExamSubmission {
  id?: number;
  subjectName: string;
  subjectCode: string;
  examDate: string;
  examSlot: 'Morning' | 'Afternoon';
}

export interface ExamSubmissionRequest {
  subjectName: string;
  subjectCode: string;
  examDate: string;
  examSlot: string;
  faName: string;
  faMobile: string;
  faEmail?: string;
}

export async function addStudent(student: Partial<Student> & { password?: string }) {
  return request<{ message: string; regNo: string; generatedPassword?: string }>('/student/add', {
    method: 'POST',
    body: JSON.stringify(student),
  });
}

export async function submitExam(regNo: string, payload: ExamSubmissionRequest) {
  return request<{ message: string; id: number }>(`/student/${regNo}/submit-exam`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteSubmission(id: string | number) {
  return request<{ message: string }>(`/student/exam/${id}`, {
    method: 'DELETE',
  });
}

// ─── Admin ──────────────────────────────────────────────────────────────────
export interface AvailabilityRequest {
  date: string;
  slot: string;
  regNos: string[];
}

export interface AvailabilityResponse {
  regNo: string;
  name: string;
  department: string;
  status: 'HAS EXAM' | 'NO EXAM';
  examSubject: string;
  subjectCode?: string;
  faName: string;
  faMobile: string;
}

export async function getAllStudents(): Promise<Student[]> {
  return request<Student[]>('/admin/students');
}

export async function searchByDept(department: string): Promise<Student[]> {
  return request<Student[]>(`/admin/search/dept/${encodeURIComponent(department)}`);
}

export async function searchByRegNo(regNo: string): Promise<Student> {
  return request<Student>(`/admin/search/${encodeURIComponent(regNo)}`);
}

export async function checkAvailability(payload: AvailabilityRequest): Promise<AvailabilityResponse[]> {
  return request<AvailabilityResponse[]>('/admin/check-availability', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getPhotoUrl(regNo: string) {
  return `${BASE_URL}/admin/view-photo/${regNo}`;
}

export function getExcelExportUrl() {
  return `${BASE_URL}/admin/export/excel`;
}

export function getPdfExportUrl() {
  return `${BASE_URL}/admin/export/pdf`;
}
export interface ExamSubmissionRow {
  id: number;
  subjectName: string;
  subjectCode: string;
  examDate: string;
  examSlot: 'Morning' | 'Afternoon';
  faName: string;
  faMobile: string;
  faEmail?: string;
}
export async function updateExam(regNo: string, id: number, payload: ExamSubmissionRequest) {
  return request<{ message: string }>(`/student/${regNo}/exam/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
export async function fetchStudentSubmissions(regNo: string): Promise<ExamSubmission[]> {
  try {
    // Reuses your existing search endpoint which already includes the submissions array
    const student = await searchByRegNo(regNo);
    return student.submissions || [];
  } catch (error) {
    console.error("Failed to fetch student submissions:", error);
    return [];
  }
}