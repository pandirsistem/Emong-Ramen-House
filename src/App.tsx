import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { CashierView } from './components/CashierView';
import { AdminView } from './components/AdminView';
import { LoginView } from './components/LoginView';
import { VoiceModal } from './components/VoiceModal';
import { SetupGuideModal } from './components/SetupGuideModal';
import {
  AuditLogRecord,
  ClosingRecord,
  ExpenseCategory,
  ExpenseRecord,
  ShiftType
} from './types';
import { INITIAL_AUDIT_LOGS, INITIAL_CLOSINGS, INITIAL_EXPENSES } from './lib/mockData';
import { db } from './lib/firebase';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';

// Helper to strictly deduplicate arrays by ID
const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  items.forEach((item) => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};

function MainContent() {
  const { role, isAdmin, isCashier, userProfile, loading } = useAuth();

  const [closings, setClosings] = useState<ClosingRecord[]>(() => {
    const saved = localStorage.getItem('bukukas_closings');
    if (saved) {
      try {
        const parsed: ClosingRecord[] = JSON.parse(saved);
        if (parsed.some((c) => c.id && c.id.startsWith('cls_'))) {
          localStorage.removeItem('bukukas_closings');
          return [];
        }
        return dedupeById(parsed);
      } catch (e) {
        return [];
      }
    }
    return INITIAL_CLOSINGS;
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const saved = localStorage.getItem('bukukas_expenses');
    if (saved) {
      try {
        const parsed: ExpenseRecord[] = JSON.parse(saved);
        if (parsed.some((e) => e.id && e.id.startsWith('exp_'))) {
          localStorage.removeItem('bukukas_expenses');
          return [];
        }
        return dedupeById(parsed);
      } catch (e) {
        return [];
      }
    }
    return INITIAL_EXPENSES;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(() => {
    const saved = localStorage.getItem('bukukas_audit_logs');
    if (saved) {
      try {
        const parsed: AuditLogRecord[] = JSON.parse(saved);
        if (parsed.some((l) => l.id && l.id.startsWith('log_'))) {
          localStorage.removeItem('bukukas_audit_logs');
          return [];
        }
        return dedupeById(parsed);
      } catch (e) {
        return [];
      }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [adminTab, setAdminTab] = useState<'dashboard' | 'approvals' | 'expenses' | 'reports' | 'cashiers' | 'audit' | 'settings'>('dashboard');
  const pendingClosingsCount = closings.filter((c) => c.status === 'pending').length;

  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Firestore Real-Time Sync (Diperbaiki agar selalu update state dari Firebase)
  useEffect(() => {
    // 1. Closings Sync
    let unsubClosings = () => {};
    try {
      const closingsRef = collection(db, 'closings');
      const q = isCashier && userProfile?.id
        ? query(closingsRef, where('cashierId', '==', userProfile.id))
        : closingsRef;

      unsubClosings = onSnapshot(
        q,
        (snap) => {
          const map = new Map<string, ClosingRecord>();
          snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
          const list = Array.from(map.values());
          // Update state walaupun list ada isinya dari Firebase
          if (list.length > 0) {
            setClosings(list);
            localStorage.setItem('bukukas_closings', JSON.stringify(list));
          }
        },
        (err) => {
          console.warn('Firestore closings note:', err.message);
        }
      );
    } catch (e) {
      console.warn('Closings listener failed.');
    }

    // 2. Expenses Sync (Admin only)
    let unsubExpenses = () => {};
    if (isAdmin) {
      try {
        const expensesRef = collection(db, 'expenses');
        unsubExpenses = onSnapshot(
          expensesRef,
          (snap) => {
            const map = new Map<string, ExpenseRecord>();
            snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
            const list = Array.from(map.values());
            if (list.length > 0) {
              setExpenses(list);
              localStorage.setItem('bukukas_expenses', JSON.stringify(list));
            }
          },
          (err) => {
            console.warn('Firestore expenses note:', err.message);
          }
        );
      } catch (e) {
        console.warn('Expenses listener failed.');
      }
    }

    // 3. Audit Logs Sync (Admin only)
    let unsubAudit = () => {};
    if (isAdmin) {
      try {
        const auditRef = collection(db, 'audit_logs');
        unsubAudit = onSnapshot(
          auditRef,
          (snap) => {
            const map = new Map<string, AuditLogRecord>();
            snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
            const list = Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            if (list.length > 0) {
              setAuditLogs(list);
              localStorage.setItem('bukukas_audit_logs', JSON.stringify(list));
            }
          },
          (err) => {
            console.warn('Firestore audit note:', err.message);
          }
        );
      } catch (e) {
        console.warn('Audit listener failed.');
      }
    }

    return () => {
      unsubClosings();
      unsubExpenses();
      unsubAudit();
    };
  }, [isAdmin, isCashier, userProfile?.id]);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!userProfile) return <LoginView />;

  // Handlers
  const handleAddClosing = async (
    data: Omit<ClosingRecord, 'id' | 'createdAt' | 'status'>
  ): Promise<ClosingRecord> => {
    const id = `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newClosing: ClosingRecord = {
      ...data,
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'closings', id), newClosing);
    } catch (err) {
      console.warn('Firestore save closing fallback to local cache:', err);
    }

    setClosings((prev) => {
      const updated = dedupeById([newClosing, ...prev]);
      localStorage.setItem('bukukas_closings', JSON.stringify(updated));
      return updated;
    });

    return newClosing;
  };

  const handleAddExpense = async (
    data: Omit<ExpenseRecord, 'id' | 'createdAt'>
  ): Promise<ExpenseRecord> => {
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newExpense: ExpenseRecord = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'expenses', id), newExpense);
    } catch (err) {
      console.warn('Firestore save expense fallback to local cache:', err);
    }

    setExpenses((prev) => {
      const updated = dedupeById([newExpense, ...prev]);
      localStorage.setItem('bukukas_expenses', JSON.stringify(updated));
      return updated;
    });

    return newExpense;
  };

  const handleReviewClosing = async (
    id: string,
    status: 'approved' | 'rejected',
    reviewNotes: string
  ) => {
    const updateData = {
      status,
      reviewNotes,
      reviewedBy: userProfile?.id || 'admin',
      reviewedByName: userProfile?.displayName || 'Admin Utama',
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'closings', id), updateData);
    } catch (err) {
      console.warn('Firestore update closing fallback to local cache:', err);
    }

    setClosings((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updateData } : c));
      localStorage.setItem('bukukas_closings', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (err) {
      console.warn('Firestore delete expense fallback to local cache:', err);
    }

    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      localStorage.setItem('bukukas_expenses', JSON.stringify(updated));
      return updated;
    });
  };

  // Voice AI trigger callbacks
  const handleVoiceConfirmClosing = (parsed: {
    cashAmount: number;
    nonCashAmount: number;
    expectedPosAmount: number;
    shift: ShiftType;
    notes: string;
  }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const discrepancy = (parsed.cashAmount + parsed.nonCashAmount) - parsed.expectedPosAmount;

    handleAddClosing({
      date: todayStr,
      cashierId: userProfile?.id || 'cashier',
      cashierName: userProfile?.displayName || 'Kasir Voice AI',
      shift: parsed.shift,
      cashAmount: parsed.cashAmount,
      nonCashAmount: parsed.nonCashAmount,
      expectedPosAmount: parsed.expectedPosAmount,
      discrepancyAmount: discrepancy,
      discrepancyReason: discrepancy !== 0 ? 'Input otomatis Voice AI' : '',
      notes: parsed.notes,
    });
  };

  const handleVoiceConfirmExpense = (parsed: {
    category: ExpenseCategory;
    amount: number;
    title: string;
    notes: string;
  }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    handleAddExpense({
      date: todayStr,
      category: parsed.category,
      amount: parsed.amount,
      title: parsed.title,
      notes: parsed.notes,
      recordedBy: userProfile?.id || 'admin',
      recordedByName: userProfile?.displayName || 'Admin Utama',
    });
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex flex-col">
      {/* Top Navigation */}
      <Header
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        activeTab={adminTab}
        setActiveTab={setAdminTab}
        pendingClosingsCount={pendingClosingsCount}
        closings={closings}
        expenses={expenses}
      />

      {/* Main View Area based on Strict RBAC */}
      <main className="flex-1">
        {isCashier ? (
          <CashierView
            onOpenVoice={() => setIsVoiceOpen(true)}
            closings={closings}
            onAddClosing={handleAddClosing}
          />
        ) : (
          <AdminView
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenGuide={() => setIsGuideOpen(true)}
            closings={closings}
            expenses={expenses}
            auditLogs={auditLogs}
            onAddExpense={handleAddExpense}
            onReviewClosing={handleReviewClosing}
            onDeleteExpense={handleDeleteExpense}
            activeTab={adminTab}
            setActiveTab={setAdminTab}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/80 py-4 text-center text-xs text-slate-500">
        <p>
          BukuKas Pro &amp; Keuangan AI • Role-Based Access Control • Firebase Firestore &amp; Google Apps Script
        </p>
      </footer>

      {/* Voice AI Modal */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        role={role}
        onConfirmClosing={handleVoiceConfirmClosing}
        onConfirmExpense={handleVoiceConfirmExpense}
      />

      {/* Setup Guide Modal */}
      <SetupGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
