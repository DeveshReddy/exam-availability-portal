'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { login } from '@/lib/api';
import { GraduationCap, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function StudentLoginPage() {
  const [registerNumber, setRegisterNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { loginAsStudent } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Backend /api/auth/login accepts { id, password }
      const data = await login({ id: registerNumber, password });

      console.log("Login Response:", data);

      // ❌ If admin tries student login
      if (data.adminId || data.role === 'ADMIN') {
        setError('This is an admin account. Please use Admin Login.');
        return;
      }

      // 🔥 IMPORTANT: HANDLE MUST RESET
      if (data.status === "MUST_RESET") {
         router.push(`/student/reset-password?id=${data.regNo || registerNumber}`);
         return;
      }

      // ✅ NORMAL STUDENT LOGIN
      if (data.regNo) {
        loginAsStudent(data.regNo, {
          name: data.name,
          email: data.email,
          department: data.department,
          faName: data.faName,
          faMobile: data.faMobile,
          submissions: data.submissions || [],
        });
        router.push('/student/dashboard');
      } else {
        setError('Login failed. Could not verify student data.');
      }
      
    } catch (err: any) {
      setError(
        err.message === 'Invalid Credentials' 
          ? 'Invalid register number or password.' 
          : 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Student Login</h1>
            <p className="text-gray-500 mt-2">Enter your register number to access your dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Register Number</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="e.g. RA2211003010001"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center text-sm"
              >
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Not a student?{' '}
              <a href="/admin/login" className="text-blue-600 font-semibold hover:underline">
                Admin Login
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}