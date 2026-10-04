'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

// 1. Move all the logic into a content component
function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const adminId = searchParams.get('id');

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Updated to use the environment variable for deployment
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
      const res = await fetch(`${baseUrl}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, newPassword: password }),
      });

      if (!res.ok) throw new Error();

      setMessage('✅ Password updated successfully');

      setTimeout(() => {
        router.push('/admin/login');
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
          <h1 className="text-2xl font-bold text-center mb-6">Reset Password</h1>

          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Enter new password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold flex justify-center items-center"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Update Password'}
            </button>
          </form>

          {message && (
            <p className="mt-4 text-center text-sm font-medium">{message}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// 2. Export the main page wrapped in Suspense to fix the Vercel Build Error
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}