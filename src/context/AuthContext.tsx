import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, googleProvider, createCashierInFirebaseAuth, testConnection } from '../lib/firebase';
import { AppSettings, AuditLogRecord, ShiftType, UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  isCashier: boolean;
  loading: boolean;
  firebaseOnline: boolean;
  settings: AppSettings;
  authSecurityError: string | null;
  clearAuthSecurityError: () => void;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  loginWithEmailOrUsername: (identifier: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: (reason?: string) => Promise<void>;
  addCashierAccount: (name: string, identifier: string, pass: string, shift: ShiftType) => Promise<void>;
  deleteCashierAccount: (cashierId: string, cashierName: string) => Promise<void>;
  toggleCashierStatus: (cashierId: string, isActive: boolean) => Promise<void>;
  logAuditAction: (action: string, details: string) => Promise<void>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/your-spreadsheet-id/edit',
  webhookUrl: '',
  whatsappAdminPhone: '085694528073',
  telegramChatId: '',
  telegramBotToken: '',
  businessName: 'EMONG RAMEN HOUSE',
  tagline: 'EMONG RAMEN HOUSE - System Kasir & Manajemen',
  address: 'Indonesia',
  initialCapital: 0,
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [firebaseOnline, setFirebaseOnline] = useState<boolean>(true);
  const [authSecurityError, setAuthSecurityError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('emong_ramen_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const clearAuthSecurityError = () => setAuthSecurityError(null);

  // Force Logout Helper: terminates Firebase Auth session, purges local cache, and resets state
  const forceLogout = async (reason?: string) => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn('Sign out warning during force logout:', err);
    }
    // Clean all session & transaction caches
    localStorage.removeItem('bukukas_closings');
    localStorage.removeItem('bukukas_expenses');
    sessionStorage.clear();

    setCurrentUser(null);
    setUserProfile(null);
    if (reason) {
      setAuthSecurityError(reason);
    }
  };

  // Track Firebase connection and initial auth state
  useEffect(() => {
    testConnection().then((connected) => {
      setFirebaseOnline(connected);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const email = (user.email || '').toLowerCase();
          const isMasterAdmin =
            email === 'firman@emongramen.com' ||
            email === 'pandircmss@gmail.com' ||
            email.startsWith('admin');

          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);

          // SECURITY CHECK: If user document was deleted from Firestore and not master admin -> REVOKE SESSION
          if (!userSnap.exists()) {
            if (!isMasterAdmin) {
              console.warn(`User ${user.uid} (${email}) has no profile document in Firestore. Revoking session.`);
              await signOut(auth);
              setCurrentUser(null);
              setUserProfile(null);
              setAuthSecurityError('Akun Anda tidak lagi terdaftar atau telah dihapus oleh Administrator.');
              setLoading(false);
              return;
            }
          }

          const userDbData = userSnap.exists() ? userSnap.data() : null;

          // SECURITY CHECK: If account is soft-deleted or marked inactive/disabled -> REVOKE SESSION
          if (!isMasterAdmin && userDbData && (userDbData.isActive === false || userDbData.status === 'disabled' || userDbData.isDeleted === true)) {
            console.warn(`User ${user.uid} (${email}) status is disabled. Revoking session.`);
            await signOut(auth);
            setCurrentUser(null);
            setUserProfile(null);
            setAuthSecurityError('Akun kasir Anda telah dinonaktifkan oleh Administrator. Akses ditolak.');
            setLoading(false);
            return;
          }

          let role: UserRole = 'cashier';
          if (isMasterAdmin) {
            role = 'admin';
            try {
              await setDoc(doc(db, 'admins', user.uid), {
                email: user.email,
                grantedAt: new Date().toISOString()
              }, { merge: true });
            } catch (e) {
              console.warn('Could not write admin marker:', e);
            }
          } else if (userSnap.exists()) {
            role = userSnap.data()?.role || 'cashier';
          }

          const resolvedDisplayName =
            userDbData?.displayName ||
            user.displayName ||
            (role === 'admin'
              ? 'Firman (Admin Utama)'
              : 'Emong Kasir');

          const profile: UserProfile = {
            id: user.uid,
            email: user.email || 'user@emongramen.com',
            displayName: resolvedDisplayName,
            role,
            shift: userDbData?.shift || 'Pagi',
            isActive: userDbData?.isActive !== false,
            status: userDbData?.status || 'active',
            passwordHint: userDbData?.passwordHint,
            createdAt: userDbData?.createdAt || new Date().toISOString()
          };

          // Only bootstrap doc for master admin, NEVER auto-recreate missing cashier accounts
          if (!userSnap.exists() && isMasterAdmin) {
            await setDoc(userDocRef, profile, { merge: true });
          }

          setCurrentUser(user);
          setUserProfile(profile);
          setLoading(false);
        } catch (err) {
          console.warn('Failed to verify user profile from Firestore:', err);
          const email = (user.email || '').toLowerCase();
          const isMasterAdmin = email === 'firman@emongramen.com' || email === 'pandircmss@gmail.com';
          if (isMasterAdmin) {
            setCurrentUser(user);
            setUserProfile({
              id: user.uid,
              email: user.email || 'firman@emongramen.com',
              displayName: user.displayName || 'Firman (Admin Utama)',
              role: 'admin',
              isActive: true,
              status: 'active',
              createdAt: new Date().toISOString()
            });
          } else {
            await signOut(auth);
            setCurrentUser(null);
            setUserProfile(null);
            setAuthSecurityError('Terjadi kesalahan saat memverifikasi status akun Anda.');
          }
          setLoading(false);
        }
      } else {
        // No Firebase user signed in
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    // Listen to settings from Firestore if available
    try {
      const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
        if (snap.exists()) {
          const cloudSettings = snap.data() as AppSettings;
          setSettings(cloudSettings);
          localStorage.setItem('emong_ramen_settings', JSON.stringify(cloudSettings));
        }
      }, () => {});
      return () => {
        unsubscribeAuth();
        unsubSettings();
      };
    } catch {
      return () => unsubscribeAuth();
    }
  }, []);

  // REAL-TIME CLIENT-SIDE AUTH GUARD / MIDDLEWARE (Live Session Revocation)
  useEffect(() => {
    if (!currentUser) return;

    const email = (currentUser.email || '').toLowerCase();
    const isMasterAdmin =
      email === 'firman@emongramen.com' ||
      email === 'pandircmss@gmail.com' ||
      email.startsWith('admin');

    // Attach real-time Firestore listener to current user's document
    const unsubUser = onSnapshot(
      doc(db, 'users', currentUser.uid),
      async (snap) => {
        // 1. If document was deleted from Firestore by Admin
        if (!snap.exists()) {
          if (!isMasterAdmin) {
            console.warn(`[AUTH GUARD] User doc ${currentUser.uid} deleted from Firestore! Triggering immediate force logout.`);
            await forceLogout('Akun Anda telah dihapus oleh Administrator. Sesi Anda dihentikan secara otomatis.');
          }
          return;
        }

        const data = snap.data();
        // 2. If marked inactive or status disabled by Admin
        if (data && (data.isActive === false || data.status === 'disabled' || data.isDeleted === true)) {
          console.warn(`[AUTH GUARD] User doc ${currentUser.uid} marked inactive/disabled! Triggering immediate force logout.`);
          await forceLogout('Akun kasir Anda telah dinonaktifkan oleh Administrator. Sesi Anda dihentikan secara otomatis.');
          return;
        }

        // 3. Keep user profile in sync
        setUserProfile((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            displayName: data.displayName || prev.displayName,
            shift: data.shift || prev.shift,
            role: data.role || prev.role,
            isActive: data.isActive !== false,
            status: data.status || 'active',
            passwordHint: data.passwordHint || prev.passwordHint
          };
        });
      },
      (err) => {
        console.warn('[AUTH GUARD] User document realtime listener note:', err.message);
      }
    );

    // Periodic check & revalidation when window / tab regains focus
    const handleRevalidateFocus = async () => {
      if (document.visibilityState === 'visible' && currentUser && !isMasterAdmin) {
        try {
          const freshSnap = await getDocFromServer(doc(db, 'users', currentUser.uid));
          if (!freshSnap.exists() || freshSnap.data()?.isActive === false || freshSnap.data()?.status === 'disabled') {
            await forceLogout('Akun Anda telah dinonaktifkan atau dihapus oleh Administrator.');
          }
        } catch {
          // If Firestore permission denied due to rules blocking disabled account, force logout
          await forceLogout('Sesi akun tidak valid atau telah dicabut.');
        }
      }
    };

    document.addEventListener('visibilitychange', handleRevalidateFocus);
    window.addEventListener('focus', handleRevalidateFocus);

    return () => {
      unsubUser();
      document.removeEventListener('visibilitychange', handleRevalidateFocus);
      window.removeEventListener('focus', handleRevalidateFocus);
    };
  }, [currentUser]);

  const role: UserRole = userProfile?.role || 'cashier';
  const isAdmin = role === 'admin';
  const isCashier = role === 'cashier';

  const logAuditAction = async (action: string, details: string) => {
    const logItem: AuditLogRecord = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      userEmail: userProfile?.email || 'anonim@emongramen.com',
      userName: userProfile?.displayName || 'Pengguna',
      role,
      details,
      timestamp: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'audit_logs', logItem.id), logItem);
    } catch {
      const localLogs: AuditLogRecord[] = JSON.parse(localStorage.getItem('emong_audit_logs') || '[]');
      const filtered = localLogs.filter((l) => l.id !== logItem.id);
      filtered.unshift(logItem);
      localStorage.setItem('emong_audit_logs', JSON.stringify(filtered.slice(0, 100)));
    }
  };

  const loginWithEmailOrUsername = async (identifier: string, pass: string) => {
    setLoading(true);
    setAuthSecurityError(null);
    const raw = identifier.trim().toLowerCase();
    const candidateEmails: string[] = [];

    if (!raw.includes('@')) {
      candidateEmails.push(`${raw}@emongramen.com`);
      candidateEmails.push(`${raw}@ramenhouse.com`);
    } else if (!raw.includes('.')) {
      candidateEmails.push(`${raw}.com`);
      candidateEmails.push(`${raw.split('@')[0]}@emongramen.com`);
    } else {
      candidateEmails.push(raw);
      const userPart = raw.split('@')[0];
      if (raw.endsWith('@ramenhouse.com')) {
        candidateEmails.push(`${userPart}@emongramen.com`);
      } else if (raw.endsWith('@emongramen.com')) {
        candidateEmails.push(`${userPart}@ramenhouse.com`);
      }
    }

    let lastError: any = null;
    let loggedIn = false;

    for (const email of candidateEmails) {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pass);

        // Check if master admin
        const emailLower = (res.user.email || '').toLowerCase();
        const isMasterAdmin =
          emailLower === 'firman@emongramen.com' ||
          emailLower === 'pandircmss@gmail.com' ||
          emailLower.startsWith('admin');

        // SECURITY VALIDATION: Query Firestore to check if account is valid and active
        const userSnap = await getDoc(doc(db, 'users', res.user.uid));

        // 1. If user document does not exist (deleted by admin) and not master admin -> REJECT
        if (!isMasterAdmin && !userSnap.exists()) {
          await signOut(auth);
          throw new Error('Akun kasir ini telah dihapus oleh Administrator. Akses login ditolak.');
        }

        const userDbData = userSnap.data();

        // 2. If user is marked inactive or disabled -> REJECT
        if (!isMasterAdmin && userDbData && (userDbData.isActive === false || userDbData.status === 'disabled' || userDbData.isDeleted === true)) {
          await signOut(auth);
          throw new Error('Akun kasir ini telah dinonaktifkan oleh Administrator. Hubungi Admin untuk aktivasi.');
        }

        const userRole = userDbData?.role;
        if (!isMasterAdmin && userRole !== 'admin' && userRole !== 'cashier' && userRole !== 'kasir') {
          await signOut(auth);
          throw new Error('Akun Anda tidak memiliki hak akses ke sistem kasir.');
        }

        loggedIn = true;
        await logAuditAction('LOGIN_USER', `Login Pengguna: ${res.user.email}`);
        break;
      } catch (err: any) {
        lastError = err;
        if (
          err.message &&
          (err.message.includes('telah dihapus') ||
            err.message.includes('telah dinonaktifkan') ||
            err.message.includes('tidak memiliki hak akses'))
        ) {
          setLoading(false);
          throw err;
        }
      }
    }

    // Auto-bootstrap ONLY for default master admin firman if account does not exist in Firebase Auth yet
    if (!loggedIn && (raw === 'firman' || raw === 'firman@emongramen.com') && pass === 'firman123') {
      try {
        const adminEmail = 'firman@emongramen.com';
        const res = await createUserWithEmailAndPassword(auth, adminEmail, pass);
        await updateProfile(res.user, { displayName: 'Firman (Admin Utama)' });
        await setDoc(doc(db, 'admins', res.user.uid), {
          email: adminEmail,
          role: 'admin',
          grantedAt: new Date().toISOString()
        }, { merge: true });
        await setDoc(doc(db, 'users', res.user.uid), {
          id: res.user.uid,
          email: adminEmail,
          displayName: 'Firman (Admin Utama)',
          role: 'admin',
          isActive: true,
          status: 'active',
          createdAt: new Date().toISOString()
        }, { merge: true });
        loggedIn = true;
      } catch (adminCreateErr) {
        console.warn('Auto-bootstrap admin error:', adminCreateErr);
      }
    }

    if (!loggedIn) {
      console.warn('Login attempt failed for identifier:', identifier);
      let userFriendlyMessage = 'Username / Email atau Password salah. Silakan periksa kembali.';
      if (
        lastError?.code === 'auth/invalid-credential' ||
        lastError?.code === 'auth/wrong-password' ||
        lastError?.code === 'auth/user-not-found'
      ) {
        userFriendlyMessage = 'Username / Email atau Password salah. Periksa kembali nama pengguna dan kata sandi Anda.';
      } else if (lastError?.code === 'auth/too-many-requests') {
        userFriendlyMessage = 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat.';
      } else if (lastError?.code === 'auth/network-request-failed') {
        userFriendlyMessage = 'Koneksi jaringan terputus. Pastikan terhubung ke internet.';
      } else if (lastError?.message) {
        userFriendlyMessage = lastError.message;
      }

      setLoading(false);
      throw new Error(userFriendlyMessage);
    }

    setLoading(false);
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    setAuthSecurityError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await logAuditAction('LOGIN_GOOGLE', `Login via Google: ${res.user.email}`);
    } catch (err) {
      console.warn('Google Sign-in warning:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addCashierAccount = async (
    name: string,
    identifier: string,
    pass: string,
    shift: ShiftType
  ) => {
    if (!isAdmin) {
      throw new Error('Hanya Admin yang berhak mendaftarkan akun kasir.');
    }
    let email = identifier.trim().toLowerCase();
    if (!email.includes('@')) {
      email = `${email}@emongramen.com`;
    } else if (!email.includes('.')) {
      email = `${email}.com`;
    }

    // Register via secondary app in Firebase Auth to keep Admin session active
    const uid = await createCashierInFirebaseAuth(email, pass, name);

    // Save profile to Firestore with passwordHint and status active
    const newCashierProfile: UserProfile = {
      id: uid,
      email,
      displayName: name,
      role: 'cashier',
      shift,
      passwordHint: pass,
      isActive: true,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', uid), newCashierProfile);

    await logAuditAction(
      'TAMBAH_KASIR',
      `Admin mendaftarkan akun kasir baru: ${name} (${email}) - Shift: ${shift}`
    );
  };

  // Soft-delete / Deactivate / Remove cashier account
  const deleteCashierAccount = async (cashierId: string, cashierName: string) => {
    if (!isAdmin) {
      throw new Error('Hanya Admin yang berhak menghapus akun kasir.');
    }

    // 1. Immediately flag document as disabled / deleted so real-time listener terminates cashier session
    try {
      await updateDoc(doc(db, 'users', cashierId), {
        isActive: false,
        status: 'disabled',
        deletedAt: new Date().toISOString()
      });
    } catch {
      await setDoc(doc(db, 'users', cashierId), {
        isActive: false,
        status: 'disabled',
        deletedAt: new Date().toISOString()
      }, { merge: true });
    }

    // 2. Mark in revoked_users collection for Admin SDK revocation scripts
    try {
      await setDoc(doc(db, 'revoked_users', cashierId), {
        userId: cashierId,
        userName: cashierName,
        revokedAt: new Date().toISOString(),
        reason: 'Admin deleted cashier account'
      }, { merge: true });
    } catch (e) {
      console.warn('Revoked users write note:', e);
    }

    // 3. Remove document from users collection (hard delete from collection)
    await deleteDoc(doc(db, 'users', cashierId));

    await logAuditAction(
      'HAPUS_KASIR',
      `Admin menghapus akun kasir: ${cashierName} (ID: ${cashierId})`
    );
  };

  // Toggle Cashier Active / Disabled Status (Best practice Soft-Delete)
  const toggleCashierStatus = async (cashierId: string, isActive: boolean) => {
    if (!isAdmin) {
      throw new Error('Hanya Admin yang berhak mengubah status akun kasir.');
    }

    await setDoc(doc(db, 'users', cashierId), {
      isActive,
      status: isActive ? 'active' : 'disabled',
      disabledAt: isActive ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (!isActive) {
      try {
        await setDoc(doc(db, 'revoked_users', cashierId), {
          userId: cashierId,
          revokedAt: new Date().toISOString(),
          reason: 'Admin deactivated cashier account'
        }, { merge: true });
      } catch (e) {
        console.warn('Revoked users marker write note:', e);
      }
    }

    await logAuditAction(
      isActive ? 'AKTIFKAN_KASIR' : 'NONAKTIFKAN_KASIR',
      `Admin ${isActive ? 'mengaktifkan kembali' : 'menonaktifkan'} akun kasir ID: ${cashierId}`
    );
  };

  const logout = async () => {
    try {
      if (currentUser) {
        await signOut(auth);
      }
      localStorage.removeItem('bukukas_closings');
      localStorage.removeItem('bukukas_expenses');
      sessionStorage.clear();
      setCurrentUser(null);
      setUserProfile(null);
      setAuthSecurityError(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings, updatedAt: new Date().toISOString() };
    setSettings(updated);
    localStorage.setItem('emong_ramen_settings', JSON.stringify(updated));

    try {
      await setDoc(doc(db, 'settings', 'config'), updated, { merge: true });
      await logAuditAction('UPDATE_SETTINGS', 'Memperbarui konfigurasi sistem & toko');
    } catch (err) {
      console.warn('Could not save settings to cloud, saved locally:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        role,
        isAdmin,
        isCashier,
        loading,
        firebaseOnline,
        settings,
        authSecurityError,
        clearAuthSecurityError,
        updateSettings,
        loginWithEmailOrUsername,
        loginWithGoogle,
        logout,
        forceLogout,
        addCashierAccount,
        deleteCashierAccount,
        toggleCashierStatus,
        logAuditAction
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
