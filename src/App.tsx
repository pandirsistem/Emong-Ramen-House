import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { CashierView } from './components/CashierView';
import { AdminView } from './components/AdminView';
import { LoginView } from './components/LoginView';
import { VoiceModal } from './components/VoiceModal';
import { SetupGuideModal } from './components/SetupGuideModal';
import { BottomNav } from './components/BottomNav';
import {
  AuditLogRecord,
  ClosingRecord,
  ExpenseCategory,
  ExpenseRecord,
  ShiftType
} from './types';
import { db, cleanFirestoreData } from './lib/firebase';
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

  // Zero-dummy production initial states - filled purely via Firestore Real-Time Listener
  const [closings, setClosings] = useState<ClosingRecord[]>(() => {
    const saved = localStorage.getItem('bukukas_closings');
    if (saved) {
      try {
        const parsed: ClosingRecord[] = JSON.parse(saved);
        return dedupeById(parsed);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const saved = localStorage.getItem('bukukas_expenses');
    if (saved) {
      try {
        const parsed: ExpenseRecord[] = JSON.parse(saved);
        return dedupeById(parsed);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(() => {
    const saved = localStorage.getItem('bukukas_audit_logs');
    if (saved) {
      try {
        const parsed: AuditLogRecord[] = JSON.parse(saved);
        return dedupeById(parsed);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [adminTab, setAdminTab] = useState<'dashboard' | 'approvals' | 'expenses' | 'reports' | 'cashiers' | 'audit' | 'settings'>('dashboard');
  const pendingClosingsCount = closings.filter((c) => c.status === 'pending').length;

  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Monitor network connectivity state
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Firestore Real-Time Sync (Live listener across PC & HP devices without manual refresh)
  useEffect(() => {
    if (!userProfile) return;

    // 1. Closings Live Sync (All authenticated active users see identical transactions)
    let unsubClosings = () => {};
    try {
      const closingsRef = collection(db, 'closings');
      unsubClosings = onSnapshot(
        closingsRef,
        (snap) => {
          const map = new Map<string, ClosingRecord>();
          snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
          const fullList = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
          );
          setClosings(fullList);
          try {
            localStorage.setItem('bukukas_closings', JSON.stringify(fullList));
          } catch {}
        },
        (err) => {
          console.warn('Firestore closings sync note:', err.message);
        }
      );
    } catch (e) {
      console.warn('Closings listener failed to attach:', e);
    }

    // 2. Expenses Live Sync (Synced across all authenticated users for identical balances)
    let unsubExpenses = () => {};
    try {
      const expensesRef = collection(db, 'expenses');
      unsubExpenses = onSnapshot(
        expensesRef,
        (snap) => {
          const map = new Map<string, ExpenseRecord>();
          snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
          const fullList = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
          );
          setExpenses(fullList);
          try {
            localStorage.setItem('bukukas_expenses', JSON.stringify(fullList));
          } catch {}
        },
        (err) => {
          console.warn('Firestore expenses sync note:', err.message);
        }
      );
    } catch (e) {
      console.warn('Expenses listener failed to attach:', e);
    }

    // 3. Audit Logs Live Sync
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
            setAuditLogs(list);
            try {
              localStorage.setItem('bukukas_audit_logs', JSON.stringify(list));
            } catch {}
          },
          (err) => {
            console.warn('Firestore audit sync note:', err.message);
          }
        );
      } catch (e) {
        console.warn('Audit listener failed to attach:', e);
      }
    }

    return () => {
      unsubClosings();
      unsubExpenses();
      unsubAudit();
    };
  }, [isAdmin, userProfile?.id]);

  // Fast Async Skeleton Loader for Snappy Initial Feel
  if (loading && !userProfile) {
    return (
      <div className="min-h-screen bg-[#1e0a0f] text-slate-100 antialiased p-3 sm:p-6 space-y-4 animate-pulse">
        {/* Shimmering Top Bar Skeleton */}
        <div className="h-14 bg-rose-950/40 rounded-2xl border border-rose-900/30 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20" />
            <div className="space-y-1.5">
              <div className="w-32 h-3.5 bg-rose-800/40 rounded-md" />
              <div className="w-20 h-2.5 bg-rose-900/40 rounded-md" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-16 h-8 bg-emerald-800/30 rounded-xl" />
            <div className="w-8 h-8 bg-rose-800/30 rounded-xl" />
          </div>
        </div>

        {/* 4 Shimmering Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-rose-950/30 rounded-xl border border-rose-900/20 p-3 flex flex-col justify-between">
              <div className="w-16 h-2.5 bg-rose-800/30 rounded-md" />
              <div className="w-24 h-5 bg-amber-500/20 rounded-md" />
            </div>
          ))}
        </div>

        {/* Main Content Area Skeleton */}
        <div className="h-64 bg-rose-950/20 rounded-2xl border border-rose-900/20 p-4 space-y-3">
          <div className="w-40 h-4 bg-rose-800/30 rounded-md" />
          <div className="h-10 bg-rose-900/20 rounded-xl" />
          <div className="h-10 bg-rose-900/20 rounded-xl" />
          <div className="h-10 bg-rose-900/20 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!userProfile) return <LoginView />;

  // Handlers with Auto-Approval & Real-Time Cloud Persistence
  const handleAddClosing = async (
    data: Omit<ClosingRecord, 'id' | 'createdAt' | 'status'>
  ): Promise<ClosingRecord> => {
    const id = `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Auto-approval logic:
    // Selisih = (Uang Tunai + Uang Non-Tunai) - Total Tagihan/Target POS
    const discrepancy = (data.cashAmount + data.nonCashAmount) - data.expectedPosAmount;
    const isAutoApproved = discrepancy === 0;
    const status: 'approved' | 'pending' = isAutoApproved ? 'approved' : 'pending';

    const newClosing: ClosingRecord = {
      ...data,
      id,
      status,
      discrepancyAmount: discrepancy,
      createdAt: new Date().toISOString(),
      ...(isAutoApproved ? {
        reviewedBy: 'system-auto',
        reviewedByName: 'Sistem (Auto-Approved)',
        reviewedAt: new Date().toISOString(),
        reviewNotes: 'Otomatis disetujui sistem (Selisih Pas Rp 0)'
      } : {})
    };

    // Immediate optimistic state update
    setClosings((prev) => {
      const updated = dedupeById([newClosing, ...prev]);
      try {
        localStorage.setItem('bukukas_closings', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Real-Time Cloud Save to Firestore (persists on refresh and syncs to all devices)
    try {
      await setDoc(doc(db, 'closings', id), cleanFirestoreData(newClosing));
    } catch (err: any) {
      console.error('Firestore save closing error:', err);
      // Fallback: save to local cache
      try {
        const saved = localStorage.getItem('bukukas_closings');
        const list: ClosingRecord[] = saved ? JSON.parse(saved) : [];
        localStorage.setItem('bukukas_closings', JSON.stringify(dedupeById([newClosing, ...list])));
      } catch {}
    }

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

    // Immediate optimistic state update
    setExpenses((prev) => {
      const updated = dedupeById([newExpense, ...prev]);
      try {
        localStorage.setItem('bukukas_expenses', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Real-Time Cloud Save to Firestore (persists on refresh and syncs to all devices)
    try {
      await setDoc(doc(db, 'expenses', id), cleanFirestoreData(newExpense));
    } catch (err: any) {
      console.error('Firestore save expense error:', err);
      // Fallback: save to local cache
      try {
        const saved = localStorage.getItem('bukukas_expenses');
        const list: ExpenseRecord[] = saved ? JSON.parse(saved) : [];
        localStorage.setItem('bukukas_expenses', JSON.stringify(dedupeById([newExpense, ...list])));
      } catch {}
    }

    return newExpense;
  };

  const handleReviewClosing = async (
    id: string,
    status: 'approved' | 'rejected',
    reviewNotes: string
  ) => {
    const updateData: any = {
      status,
      reviewNotes: reviewNotes || '',
      reviewedBy: userProfile?.id || 'admin',
      reviewedByName: userProfile?.displayName || 'Admin Utama',
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic local update
    setClosings((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updateData } : c));
      try {
        localStorage.setItem('bukukas_closings', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Real-Time Cloud Update
    try {
      await updateDoc(doc(db, 'closings', id), cleanFirestoreData(updateData));
    } catch (err) {
      console.error('Firestore update closing error:', err);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    // Optimistic local update
    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem('bukukas_expenses', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Real-Time Cloud Delete
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (err) {
      console.error('Firestore delete expense error:', err);
    }
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
      recordedByName: userProfile?.displayName || 'Admin Voice AI',
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-900 antialiased selection:bg-rose-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        activeTab={adminTab}
        setActiveTab={setAdminTab}
        pendingClosingsCount={pendingClosingsCount}
        closings={closings}
        expenses={expenses}
        isOnline={isOnline}
      />

      {/* Main View Area based on Strict RBAC */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden pb-24 md:pb-6">
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

      {/* Fixed Mobile Bottom Navigation */}
      <BottomNav
        activeTab={adminTab}
        setActiveTab={setAdminTab}
        pendingClosingsCount={pendingClosingsCount}
        onOpenVoice={() => setIsVoiceOpen(true)}
      />

      {/* Footer */}
      <footer className="border-t border-rose-900/30 bg-[#1e0a0f]/90 py-3 text-center text-xs text-amber-200/80">
        <p className="font-medium">
          EMONG RAMEN HOUSE • Real-Time Cloud Sync • Multi-Device POS
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
