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

  // Firestore Real-Time Sync (Live listener across PC & HP devices without manual refresh)
  useEffect(() => {
    if (!userProfile) return;

    // 1. Closings Live Sync
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
          const list = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
          );
          setClosings(list);
          try {
            localStorage.setItem('bukukas_closings', JSON.stringify(list));
          } catch {}
        },
        (err) => {
          console.warn('Firestore closings sync note:', err.message);
        }
      );
    } catch (e) {
      console.warn('Closings listener failed to attach.');
    }

    // 2. Expenses Live Sync (Admin only)
    let unsubExpenses = () => {};
    if (isAdmin) {
      try {
        const expensesRef = collection(db, 'expenses');
        unsubExpenses = onSnapshot(
          expensesRef,
          (snap) => {
            const map = new Map<string, ExpenseRecord>();
            snap.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
            const list = Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
            );
            setExpenses(list);
            try {
              localStorage.setItem('bukukas_expenses', JSON.stringify(list));
            } catch {}
          },
          (err) => {
            console.warn('Firestore expenses sync note:', err.message);
          }
        );
      } catch (e) {
        console.warn('Expenses listener failed to attach.');
      }
    }

    // 3. Audit Logs Live Sync (Admin only)
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
        console.warn('Audit listener failed to attach.');
      }
    }

    return () => {
      unsubClosings();
      unsubExpenses();
      unsubAudit();
    };
  }, [isAdmin, isCashier, userProfile?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1e0a0f] text-white">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-bold text-sm tracking-wide text-amber-200">Memuat Sistem Keuangan...</p>
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

    // Real-Time Cloud Save
    try {
      await setDoc(doc(db, 'closings', id), newClosing);
    } catch (err) {
      console.warn('Firestore save closing fallback note:', err);
    }

    setClosings((prev) => {
      const updated = dedupeById([newClosing, ...prev]);
      try {
        localStorage.setItem('bukukas_closings', JSON.stringify(updated));
      } catch {}
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

    // Real-Time Cloud Save
    try {
      await setDoc(doc(db, 'expenses', id), newExpense);
    } catch (err) {
      console.warn('Firestore save expense fallback note:', err);
    }

    setExpenses((prev) => {
      const updated = dedupeById([newExpense, ...prev]);
      try {
        localStorage.setItem('bukukas_expenses', JSON.stringify(updated));
      } catch {}
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

    // Real-Time Cloud Update
    try {
      await updateDoc(doc(db, 'closings', id), updateData);
    } catch (err) {
      console.warn('Firestore update closing fallback note:', err);
    }

    setClosings((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updateData } : c));
      try {
        localStorage.setItem('bukukas_closings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleDeleteExpense = async (id: string) => {
    // Real-Time Cloud Delete
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (err) {
      console.warn('Firestore delete expense fallback note:', err);
    }

    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem('bukukas_expenses', JSON.stringify(updated));
      } catch {}
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
      />

      {/* Main View Area based on Strict RBAC */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
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
