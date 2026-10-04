'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

// 1. Move all the logic into a content component
function StudentResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get the register number from the URL (?id=RA...)
  const regNo = searchParams.get('id');

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Uses the environment variable for deployment
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
      
      // Assumes your backend has a /student/reset-password endpoint
      const res = await fetch(`${baseUrl}/student/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regNo, newPassword: password }),
      });

      if (!res.ok) throw new Error();

      setMessage('✅ Password updated successfully');

      setTimeout(() => {
        router.push('/student/login');
      }, 1500);

    } catch {
      setMessage('❌ Failed to update password');
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
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">Student Password Reset</h1>
          
          <p className="text-center text-sm text-gray-500 mb-6">
            Please set a new password for <span className="font-semibold text-gray-800">{regNo}</span>
          </p>

          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter new password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold flex justify-center items-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Update Password'}
            </button>
          </form>

          {message && (
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-6 text-center text-sm font-medium p-3 rounded-lg ${
                message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message}
            </motion.p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// 2. Export the main page wrapped in Suspense for Vercel Build
export default function StudentResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <StudentResetPasswordContent />
    </Suspense>
  );
}