'use client';

import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
  student: any | null;
  admin: any | null;
  loginAsStudent: (registerNumber: string, studentData: any) => void;
  loginAsAdmin: (adminId: string, adminData: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [student, setStudent] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('student_session');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });
  const [admin, setAdmin] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('admin_session');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  const loginAsStudent = (registerNumber: string, studentData: any) => {
    const data = { ...studentData, registerNumber: registerNumber || studentData.regNo };
    setStudent(data);
    localStorage.setItem('student_session', JSON.stringify(data));
  };

  const loginAsAdmin = (adminId: string, adminData: any) => {
    const data = { ...adminData, id: adminId };
    setAdmin(data);
    localStorage.setItem('admin_session', JSON.stringify(data));
  };

  const logout = () => {
    setStudent(null);
    setAdmin(null);
    localStorage.removeItem('student_session');
    localStorage.removeItem('admin_session');
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ student, admin, loginAsStudent, loginAsAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
