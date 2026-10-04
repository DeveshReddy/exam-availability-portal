'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getAllStudents, searchByDept, searchByRegNo,
  checkAvailability, getExcelExportUrl, getPdfExportUrl,
  Student, AvailabilityResponse, addStudent
} from '@/lib/api';
import {
  ShieldCheck, LogOut, Users, FileText, Upload, Download, Search,
  CheckCircle2, XCircle, AlertCircle, Loader2, Calendar, Clock,
  FileSpreadsheet, FileType, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminDashboard() {
  const { admin, logout } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({ totalStudents: 0, totalSubmissions: 0, morningExams: 0, afternoonExams: 0 });

  const [checkDate, setCheckDate] = useState('');
  const [checkSlot, setCheckSlot] = useState('Morning');
  const [checkRegisterNumbers, setCheckRegisterNumbers] = useState('');
  const [checkResults, setCheckResults] = useState<AvailabilityResponse[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<Student | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const [searchText, setSearchText] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (isMounted && !admin) router.push('/admin/login');
  }, [isMounted, admin, router]);

  const fetchStudents = async () => {
    try {
      setRefreshing(true);
      const data = await getAllStudents();
      setStudents(data);
      computeStats(data);
    } catch (e) {
      console.error('Failed to load students', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const computeStats = (data: Student[]) => {
    let morning = 0, afternoon = 0, subs = 0;
    data.forEach(s => {
      (s.submissions || []).forEach(sub => {
        subs++;
        if (sub.examSlot === 'Morning') morning++;
        else afternoon++;
      });
    });
    setStats({ totalStudents: data.length, totalSubmissions: subs, morningExams: morning, afternoonExams: afternoon });
  };

  useEffect(() => { if (admin) fetchStudents(); }, [admin]);

  const handleCheckAvailability = async () => {
    if (!checkDate || !checkSlot || !checkRegisterNumbers.trim()) {
      alert('Please fill in all fields for the availability checker.');
      return;
    }
    setIsChecking(true);
    try {
      const regNos = checkRegisterNumbers.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
      const results = await checkAvailability({ date: checkDate, slot: checkSlot, regNos });
      setCheckResults(results);
    } catch (e: any) {
      alert('Error checking availability: ' + e.message);
    } finally {
      setIsChecking(false);
    }
  };

  const handleLookup = async () => {
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const result = await searchByRegNo(lookupQuery.trim());
      setLookupResult(result);
    } catch {
      try {
        const deptResults = await searchByDept(lookupQuery.trim());
        setLookupResult(deptResults[0] || null);
        if (!deptResults[0]) setLookupError('No student found.');
      } catch {
        setLookupError('No student found.');
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const generateCredentialsPdf = (
    credentials: { regNo: string; name: string; password: string }[]
  ) => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 70, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Login Credentials', pageWidth / 2, 35, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2, 55, { align: 'center' });

    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(40, 85, pageWidth - 80, 35, 5, 5, 'FD');
    doc.setTextColor(120, 80, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(
      'IMPORTANT: Share these credentials privately. Students should change password after first login.',
      pageWidth / 2, 107, { align: 'center' }
    );

    autoTable(doc, {
      startY: 135,
      head: [['#', 'Student Name', 'Register Number', 'Password']],
      body: credentials.map((c, i) => [i + 1, c.name, c.regNo, c.password]),
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 8,
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },
        1: { cellWidth: 160 },
        2: { cellWidth: 160 },
        3: { cellWidth: 130, fontStyle: 'bold', textColor: [79, 70, 229] },
      },
      alternateRowStyles: {
        fillColor: [238, 237, 254],
      },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} of ${pageCount} — Exam Portal Admin`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'center' }
      );
    }

    doc.save(`student_credentials_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleImportStudents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportMessage({ type: '', text: '' });
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const credentials: { regNo: string; name: string; password: string }[] = [];

       const BATCH_SIZE = 20;
const DELAY_MS = 300;

for (let i = 0; i < data.length; i += BATCH_SIZE) {
  const batch = data.slice(i, i + BATCH_SIZE);

  const promises = batch.map(async (row) => {
    const regNo = String(row['Register Number'] || row['registerNumber'] || '').trim();
    if (!regNo) return null;

    try {
      const response = await addStudent({
        regNo,
        name: row['Student Name'] || row['name'] || 'Unknown',
        email: row['Email ID'] || row['email'] || '',
        department: row['Department'] || row['department'] || '',
        password: '',
      });

      return {
        regNo: response.regNo,
        name: row['Student Name'] || row['name'] || 'Unknown',
        password: response.generatedPassword || '',
      };
    } catch (err) {
      console.error('Failed:', regNo);
      return null;
    }
  });

  const results = await Promise.all(promises);

  results.forEach(res => {
    if (res) credentials.push(res);
  });

  await new Promise(res => setTimeout(res, DELAY_MS));
}

        setImportMessage({ type: 'success', text: `Successfully imported ${credentials.length} students. Credentials PDF downloaded!` });
        fetchStudents();

        if (credentials.length > 0) {
          generateCredentialsPdf(credentials);
        }
      };
      reader.readAsBinaryString(file);
    } catch {
      setImportMessage({ type: 'error', text: 'Failed to import. Check the file format.' });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadSampleTemplate = () => {
    const data = [
      { 'Student Name': 'John Doe', 'Register Number': 'RA2211003010001', 'Email ID': 'john@example.com', 'Department': 'CSE' },
      { 'Student Name': 'Jane Smith', 'Register Number': 'RA2211003010002', 'Email ID': 'jane@example.com', 'Department': 'ECE' },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student_master_template.xlsx');
  };

  const exportFromBackend = (type: 'excel' | 'pdf') => {
    const url = type === 'excel' ? getExcelExportUrl() : getPdfExportUrl();
    window.open(url, '_blank');
  };

  const exportLocalPdf = () => {
    const dataToExport = checkResults.length > 0 ? checkResults : [];
    if (dataToExport.length === 0) { exportFromBackend('pdf'); return; }
    const doc = new jsPDF('l', 'pt');
    const headers = [['Reg No', 'Name', 'Dept', 'Status', 'Subject (Code)', 'FA Details']];
    const rows = dataToExport.map(r => [
      r.regNo, r.name, r.department, r.status,
      r.subjectCode ? `${r.subjectCode} - ${r.examSubject}` : r.examSubject,
      `${r.faName || '—'} (${r.faMobile || '—'})`
    ]);
    autoTable(doc, {
      head: headers, body: rows, startY: 40, theme: 'grid',
      styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] }
    });
    doc.save(`availability_report.pdf`);
  };

  const exportLocalExcel = () => {
    const dataToExport = checkResults.length > 0 ? checkResults : [];
    if (dataToExport.length === 0) { exportFromBackend('excel'); return; }
    const formattedData = dataToExport.map(r => ({
      'Register Number': r.regNo,
      'Student Name': r.name,
      'Department': r.department,
      'Availability Status': r.status,
      'Subject Code': r.subjectCode || '—',
      'Subject Name': r.examSubject || '—',
      'Faculty Advisor': r.faName || '—',
      'FA Mobile': r.faMobile || '—'
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Availability');
    XLSX.writeFile(wb, `availability_report.xlsx`);
  };

  const departments = Array.from(new Set(students.map(s => s.department).filter(Boolean)));
  const displayStudents = students.filter(s => {
    const matchSearch = !searchText || s.name?.toLowerCase().includes(searchText.toLowerCase()) || s.regNo?.toLowerCase().includes(searchText.toLowerCase());
    const matchDept = !filterDept || s.department === filterDept;
    return matchSearch && matchDept;
  });

  if (!isMounted || !admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-gray-500 font-medium">Verifying Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden md:block">Welcome, {admin?.name || admin?.email || 'Admin'}</span>
            <button onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium">
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'blue' },
            { label: 'Total Submissions', value: stats.totalSubmissions, icon: FileText, color: 'indigo' },
            { label: 'Morning Exams', value: stats.morningExams, icon: Clock, color: 'orange' },
            { label: 'Afternoon Exams', value: stats.afternoonExams, icon: Calendar, color: 'green' },
          ].map((stat, idx) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className={`w-10 h-10 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</h3>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Availability Checker</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Exam Date</label>
                  <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Slot</label>
                  <div className="flex gap-2">
                    {['Morning', 'Afternoon'].map(slot => (
                      <label key={slot} className="flex-1 cursor-pointer">
                        <input type="radio" name="checkSlot" value={slot} checked={checkSlot === slot}
                          onChange={(e) => setCheckSlot(e.target.value)} className="sr-only peer" />
                        <div className="w-full py-2.5 text-center rounded-xl border border-gray-200 bg-gray-50 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-all font-semibold text-sm">
                          {slot}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Register Numbers</label>
                  <textarea value={checkRegisterNumbers} onChange={(e) => setCheckRegisterNumbers(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-28 resize-none text-sm"
                    placeholder="Comma or newline separated reg nos" />
                </div>
                <button onClick={handleCheckAvailability} disabled={isChecking}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center justify-center disabled:opacity-70">
                  {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check Availability'}
                </button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Student Lookup</h3>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input type="text" value={lookupQuery} onChange={(e) => setLookupQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    placeholder="Reg No or Department"
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                  <button onClick={handleLookup} disabled={lookupLoading}
                    className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all">
                    {lookupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  </button>
                </div>
                <AnimatePresence>
                  {lookupError && <p className="text-xs text-red-500">{lookupError}</p>}
                  {lookupResult && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="p-4 bg-purple-50 border border-purple-100 rounded-2xl space-y-2">
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{lookupResult.name}</h4>
                          <p className="text-xs text-gray-500">{lookupResult.regNo}</p>
                        </div>
                        <button onClick={() => setLookupResult(null)} className="text-gray-400 hover:text-gray-600">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p><span className="font-semibold">Dept:</span> {lookupResult.department}</p>
                        <p><span className="font-semibold">Email:</span> {lookupResult.email || '—'}</p>
                        {lookupResult.faName && <p><span className="font-semibold">FA:</span> {lookupResult.faName}</p>}
                      </div>
                      {(lookupResult.submissions || []).length > 0 && (
                        <div className="pt-2 border-t border-purple-200">
                          <p className="text-[10px] font-bold text-purple-700 uppercase mb-1">
                            Exam Submissions ({lookupResult.submissions!.length})
                          </p>
                          {lookupResult.submissions!.map((sub, i) => (
                            <div key={i} className="mb-2 last:mb-0">
                              <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter leading-none">{sub.subjectCode}</div>
                              <div className="text-[10px] text-gray-600 flex gap-2">
                                <Calendar className="w-3 h-3 text-purple-400 mt-0.5" />
                                <span>{sub.examDate} • {sub.examSlot} • {sub.subjectName}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Import Students</h3>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  Upload Excel/CSV to bulk-register students. A credentials PDF will be downloaded automatically.
                </p>
                <button onClick={() => fileInputRef.current?.click()} disabled={importLoading}
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center gap-2 hover:border-green-400 hover:bg-green-50 transition-all group">
                  {importLoading ? <Loader2 className="w-6 h-6 animate-spin text-green-600" /> : (
                    <>
                      <FileSpreadsheet className="w-8 h-8 text-gray-400 group-hover:text-green-600 transition-colors" />
                      <span className="text-sm font-semibold text-gray-600">Click to upload file</span>
                    </>
                  )}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImportStudents} accept=".xlsx,.xls,.csv" className="hidden" />
                <button onClick={downloadSampleTemplate}
                  className="text-sm text-blue-600 font-semibold hover:underline flex items-center justify-center gap-2 w-full">
                  <Download className="w-4 h-4" /> Download Sample Template
                </button>
                <AnimatePresence>
                  {importMessage.text && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={`p-3 rounded-xl flex items-center gap-2 text-sm ${importMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {importMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {importMessage.text}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence>
              {checkResults.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">Availability Results</h3>
                    <div className="flex items-center gap-3">
                      <button onClick={exportLocalExcel} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all" title="Export Excel">
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                      <button onClick={exportLocalPdf} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all" title="Export PDF">
                        <FileType className="w-4 h-4" />
                      </button>
                      <button onClick={() => setCheckResults([])} className="text-xs text-indigo-600 font-semibold hover:underline">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50">
                          {['Student', 'Status', 'Subject', 'FA Details'].map(h => (
                            <th key={h} className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {checkResults.map((r, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-gray-900 text-sm">{r.name}</div>
                              <div className="text-xs text-gray-400">{r.regNo} • {r.department}</div>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${r.status === 'HAS EXAM' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {r.status === 'HAS EXAM' ? <XCircle className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                {r.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm">
                              <div className="flex flex-col">
                                <span className="font-bold text-indigo-600 text-[10px] uppercase tracking-wider">
                                  {r.subjectCode || 'NO CODE'}
                                </span>
                                <span className="text-gray-700 font-medium">{r.examSubject || '—'}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm text-gray-700">{r.faName}</div>
                              <div className="text-xs text-gray-400">{r.faMobile}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex flex-wrap gap-3 items-center">
                <div className="flex-grow relative min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search name or reg no…" value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                </div>
                <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium">
                  <option value="">All Depts</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {/* <div className="flex gap-2">
                  <button onClick={() => exportFromBackend('excel')} className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all" title="Export Excel">
                    <FileSpreadsheet className="w-4 h-4" />
                  </button>
                  <button onClick={() => exportFromBackend('pdf')} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all" title="Export PDF">
                    <FileType className="w-4 h-4" />
                  </button>
                  <button onClick={fetchStudents} disabled={refreshing} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all" title="Refresh">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div> */}
              </div>

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                    <p className="text-sm">Loading students from backend…</p>
                  </div>
                ) : displayStudents.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No students found.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Student', 'Department', 'FA Details', 'Submissions'].map(h => (
                          <th key={h} className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {displayStudents.map((s, idx) => (
                        <tr key={s.regNo || idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-gray-900 text-sm">{s.name}</div>
                            <div className="text-xs text-gray-400">{s.regNo}</div>
                            {s.email && <div className="text-xs text-gray-400">{s.email}</div>}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">{s.department || '—'}</td>
                          <td className="px-5 py-4">
                            <div className="text-sm text-gray-700">{s.faName || '—'}</div>
                            <div className="text-xs text-gray-400">{s.faMobile || ''}</div>
                          </td>
                          <td className="px-5 py-4">
                            {(s.submissions || []).length === 0 ? (
                              <span className="text-xs text-gray-400 italic">None</span>
                            ) : (
                              <div className="space-y-1">
                                {(s.submissions || []).map((sub, i) => (
                                  <div key={i} className="mb-2 last:mb-0">
                                    <div className="text-xs bg-indigo-50 text-indigo-700 rounded-lg px-2 py-1 flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        <span className="font-bold">{sub.subjectCode || 'No Code'}</span>
                                      </div>
                                      <div className="pl-4 opacity-80 truncate max-w-[200px]">
                                        {sub.examDate} · {sub.examSlot} · {sub.subjectName}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}