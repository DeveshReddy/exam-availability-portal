'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  submitExam,
  updateExam,
  fetchStudentSubmissions,
  deleteSubmission,
  ExamSubmissionRequest,
  ExamSubmissionRow,
} from '@/lib/api';
import {
  GraduationCap, LogOut, Send, History, User, Mail, BookOpen,
  Calendar, Clock, Phone, CheckCircle2, AlertCircle, Loader2, Trash2, Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SubjectEntry {
  name: string;
  code: string;
  date: string;
  slot: 'Morning' | 'Afternoon';
}

interface Submission {
  dbId?: string;
  localId: string;
  subject: SubjectEntry;
  faName: string;
  faMobile: string;
  faEmail: string;
  submittedAt: string;
}

interface SubjectBlock {
  clientId: string;
  name: string;
  code: string;
  date: string;
  slot: 'Morning' | 'Afternoon';
}

interface ExamFormState {
  subjects: SubjectBlock[];
  faName: string;
  faMobile: string;
  faEmail: string;
}

function newSubjectBlock(): SubjectBlock {
  return {
    clientId:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `b-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: '',
    code: '',
    date: '',
    slot: 'Morning',
  };
}

const emptyForm = (): ExamFormState => ({
  subjects: [newSubjectBlock()],
  faName: '',
  faMobile: '',
  faEmail: '',
});

function normalizeExamDate(d: ExamSubmissionRow['examDate']): string {
  if (typeof d === 'string') return d.split('T')[0];
  if (Array.isArray(d) && (d as any[]).length >= 3) {
    const [yy, mm, day] = d as [number, number, number];
    return `${yy}-${String(mm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return '';
}

function rowToSubmission(row: ExamSubmissionRow): Submission {
  const slot = row.examSlot === 'Afternoon' ? 'Afternoon' : 'Morning';
  return {
    dbId: String(row.id),
    localId: `db-${row.id}`,
    subject: {
      name: row.subjectName,
      code: row.subjectCode,
      date: normalizeExamDate(row.examDate),
      slot,
    },
    faName: row.faName || '',
    faMobile: row.faMobile || '',
    faEmail: row.faEmail || '',
    submittedAt: 'Saved in database',
  };
}

export default function StudentDashboard() {
  const { student, logout } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingDbId, setEditingDbId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  const [formData, setFormData] = useState<ExamFormState>(() => emptyForm());

  const regNo = student?.registerNumber || student?.regNo || '';

  const studentEmail =
    student?.email ||
    student?.mail ||
    student?.studentEmail ||
    student?.emailId ||
    '—';

  const sharedFaDisplay = useMemo(() => {
    const s = submissions.find(x => x.faName || x.faMobile || x.faEmail);
    if (!s) return null;
    return { faName: s.faName, faMobile: s.faMobile, faEmail: s.faEmail };
  }, [submissions]);

  const loadSubmissions = useCallback(async () => {
    if (!regNo) return;
    setListLoading(true);
    try {
      const rows = await fetchStudentSubmissions(regNo) as ExamSubmissionRow[];
      setSubmissions(rows.map(rowToSubmission));
    } catch (e) {
      console.error(e);
      setSubmissions([]);
    } finally {
      setListLoading(false);
    }
  }, [regNo]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!student) {
      router.push('/student/login');
      return;
    }
    loadSubmissions();
  }, [mounted, student, router, loadSubmissions]);

  const addSubject = () => {
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, newSubjectBlock()],
    }));
  };

  const removeSubject = (i: number) => {
    if (formData.subjects.length <= 1 || editingDbId != null) return;
    const next = [...formData.subjects];
    next.splice(i, 1);
    setFormData(prev => ({ ...prev, subjects: next }));
  };

  const handleSubjectChange = (i: number, field: keyof Omit<SubjectBlock, 'clientId'>, value: string) => {
    const next = [...formData.subjects];
    if (field === 'code') {
      next[i] = { ...next[i], code: value.toUpperCase() };
    } else {
      next[i] = { ...next[i], [field]: value } as SubjectBlock;
    }
    setFormData(prev => ({ ...prev, subjects: next }));
  };

  const buildPayload = (
    s: SubjectBlock,
    fa: Pick<ExamFormState, 'faName' | 'faMobile' | 'faEmail'>
  ): ExamSubmissionRequest => ({
    subjectName: s.name,
    subjectCode: s.code,
    examDate: s.date,
    examSlot: s.slot,
    faName: fa.faName,
    faMobile: fa.faMobile,
    faEmail: fa.faEmail || undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !regNo) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!formData.faName.trim() || !formData.faMobile.trim()) {
      setMessage({ type: 'error', text: 'Enter faculty advisor name and mobile once (applies to all subjects).' });
      return;
    }

    for (let i = 0; i < formData.subjects.length; i++) {
      const s = formData.subjects[i];
      if (!s.name || !s.code || !s.date || !s.slot) {
        setMessage({
          type: 'error',
          text: `Fill all exam fields for subject ${i + 1}.`,
        });
        return;
      }
      if (new Date(s.date) < today) {
        setMessage({
          type: 'error',
          text: `Date for "${s.name}" cannot be in the past.`,
        });
        return;
      }
    }

    const fa = {
      faName: formData.faName.trim(),
      faMobile: formData.faMobile.trim(),
      faEmail: formData.faEmail.trim(),
    };

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      if (editingDbId != null) {
        const s = formData.subjects[0];
        await updateExam(regNo, editingDbId, buildPayload(s, fa));
        setMessage({ type: 'success', text: 'Exam details updated successfully.' });
        setEditingDbId(null);
      } else {
        for (const s of formData.subjects) {
          await submitExam(regNo, buildPayload(s, fa));
        }
        setMessage({
          type: 'success',
          text:
            formData.subjects.length > 1
              ? `${formData.subjects.length} subjects saved (same FA on each row).`
              : 'Exam details submitted successfully.',
        });
      }

      setFormData(emptyForm());
      await loadSubmissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  const handleEdit = (sub: Submission) => {
    const id = sub.dbId ? parseInt(sub.dbId, 10) : NaN;
    if (Number.isNaN(id)) return;

    setFormData({
      subjects: [
        {
          clientId: newSubjectBlock().clientId,
          name: sub.subject.name,
          code: sub.subject.code,
          date: sub.subject.date,
          slot: sub.subject.slot,
        },
      ],
      faName: sub.faName,
      faMobile: sub.faMobile,
      faEmail: sub.faEmail,
    });
    setEditingDbId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (localId: string) => {
    const item = submissions.find(s => s.localId === localId);
    if (!item?.dbId) {
      setShowDeleteModal(null);
      return;
    }
    const id = parseInt(item.dbId, 10);
    if (Number.isNaN(id)) return;

    try {
      await deleteSubmission(id);
      await loadSubmissions();
      setShowDeleteModal(null);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Could not delete from server. Try again.' });
      setShowDeleteModal(null);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">Exam Portal</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081/api'}/admin/view-photo/${regNo}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <User className="w-12 h-12 absolute" />
                </div>
                <div className="flex-grow">
                  <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
                  <p className="text-gray-500 font-medium">{regNo}</p>
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 mr-2 text-gray-400" />
                      {studentEmail}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <BookOpen className="w-4 h-4 mr-2 text-gray-400" />
                      {student.department}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100"
            >
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingDbId != null ? 'Edit one subject' : 'Submit exam details'}
                  </h3>
                </div>
                {editingDbId != null && (
                  <p className="text-sm text-gray-500 pl-[52px] -mt-1">
                    Editing a single subject row. FA fields apply to this row only.
                  </p>
                )}
              </div>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                      Subjects
                    </span>
                    {editingDbId == null && (
                      <button
                        type="button"
                        onClick={addSubject}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2"
                      >
                        <BookOpen className="w-4 h-4" /> Add another subject
                      </button>
                    )}
                  </div>

                  {formData.subjects.map((block, index) => (
                    <motion.div
                      key={block.clientId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-2xl border-2 border-blue-100 bg-gradient-to-b from-blue-50/40 to-gray-50 p-5 sm:p-6 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="font-bold text-gray-900">Subject {index + 1}</span>
                        </div>
                        {formData.subjects.length > 1 && editingDbId == null && (
                          <button
                            type="button"
                            onClick={() => removeSubject(index)}
                            className="text-xs font-bold text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                            Subject name
                          </label>
                          <input
                            type="text"
                            required
                            value={block.name}
                            onChange={(e) => handleSubjectChange(index, 'name', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="e.g. Data Structures"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                            Subject code
                          </label>
                          <input
                            type="text"
                            required
                            value={block.code}
                            onChange={(e) => handleSubjectChange(index, 'code', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. 21CS301J"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                            Exam date
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="date"
                              required
                              value={block.date}
                              onChange={(e) => handleSubjectChange(index, 'date', e.target.value)}
                              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                            Exam slot
                          </label>
                          <div className="flex gap-2">
                            {(['Morning', 'Afternoon'] as const).map((slot) => (
                              <label key={slot} className="flex-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`slot-${block.clientId}`}
                                  value={slot}
                                  checked={block.slot === slot}
                                  onChange={(e) => handleSubjectChange(index, 'slot', e.target.value)}
                                  className="sr-only peer"
                                />
                                <div className="w-full py-2.5 text-center rounded-xl border border-gray-200 bg-white peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-all font-bold text-xs">
                                  {slot}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {editingDbId == null && formData.subjects.length >= 1 && (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/70 p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
                      <User className="w-5 h-5 text-indigo-600" />
                      Faculty advisor
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-800 mb-2">FA name</label>
                        <input
                          type="text"
                          required
                          value={formData.faName}
                          onChange={(e) => setFormData(prev => ({ ...prev, faName: e.target.value }))}
                          className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">FA mobile</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="tel"
                            required
                            value={formData.faMobile}
                            onChange={(e) => setFormData(prev => ({ ...prev, faMobile: e.target.value }))}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">FA email</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            value={formData.faEmail}
                            onChange={(e) => setFormData(prev => ({ ...prev, faEmail: e.target.value }))}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {editingDbId != null && (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/70 p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="text-sm font-bold text-indigo-900">Faculty advisor</div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-800 mb-2">FA name</label>
                        <input
                          type="text"
                          required
                          value={formData.faName}
                          onChange={(e) => setFormData(prev => ({ ...prev, faName: e.target.value }))}
                          className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">FA mobile</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="tel"
                            required
                            value={formData.faMobile}
                            onChange={(e) => setFormData(prev => ({ ...prev, faMobile: e.target.value }))}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">FA email</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            value={formData.faEmail}
                            onChange={(e) => setFormData(prev => ({ ...prev, faEmail: e.target.value }))}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {message.text && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`p-4 rounded-xl flex items-center gap-3 ${
                        message.type === 'success'
                          ? 'bg-green-50 text-green-700 border border-green-100'
                          : 'bg-red-50 text-red-700 border border-red-100'
                      }`}
                    >
                      {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      <span className="text-sm font-medium">{message.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center disabled:opacity-70"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingDbId != null ? 'Update' : 'Submit details'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(emptyForm());
                      setEditingDbId(null);
                    }}
                    className="px-8 py-4 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                  >
                    {editingDbId != null ? 'Cancel edit' : 'Reset'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>

          <div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#f4f5f7] p-6 rounded-[30px] shadow-sm border border-gray-200"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-500 uppercase tracking-widest">
                    Saved in database
                  </h3>
                </div>
                {listLoading && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
              </div>

              {submissions.length === 0 && !listLoading ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <History className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">Nothing saved yet</p>
                  <p className="text-sm text-gray-400 mt-1">Submit subjects on the left to see them here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sharedFaDisplay && (sharedFaDisplay.faName || sharedFaDisplay.faMobile || sharedFaDisplay.faEmail) && (
                    <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/90 p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-800 mb-2">
                        Your faculty advisor (shared)
                      </p>
                      <p className="text-sm font-semibold text-gray-900">{sharedFaDisplay.faName || '—'}</p>
                      <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {sharedFaDisplay.faMobile || '—'}
                      </p>
                      {sharedFaDisplay.faEmail ? (
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {sharedFaDisplay.faEmail}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {submissions.map((sub, idx) => (
                    <motion.div
                      key={sub.localId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx }}
                      className="overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">
                              {sub.subject.code} · {sub.subject.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(sub)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteModal(sub.localId)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="border-l-4 border-blue-500 pl-4 pr-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-2">
                          Exam
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">
                            {sub.subject.slot}
                          </span>
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            {sub.subject.date}
                          </span>
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            {sub.subject.slot}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-3">{sub.submittedAt}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Forever?</h3>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => showDeleteModal && handleDelete(showDeleteModal)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}