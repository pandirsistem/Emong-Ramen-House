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
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
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
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  loginWithEmailOrUsername: (identifier: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  addCashierAccount: (name: string, identifier: string, pass: string, shift: ShiftType) => Promise<void>;
  deleteCashierAccount: (cashierId: string, cashierName: string) => Promise<void>;
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
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('emong_ramen_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Track Firebase connection and auth state
  useEffect(() => {
    testConnection().then((connected) => {
      setFirebaseOnline(connected);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);

          let role: UserRole = 'cashier';
          const email = (user.email || '').toLowerCase();
          // Admin designated email matching firman or master email
          const isMasterAdmin = email === 'firman@emongramen.com' || email === 'pandircmss@gmail.com' || email.startsWith('admin');
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

          const userDbData = userSnap.exists() ? userSnap.data() : null;
          const resolvedDisplayName =
            userDbData?.displayName ||
            user.displayName ||
            (role === 'admin'
              ? 'Firman (Admin Utama)'
              : user.email
                ? (user.email.split('@')[0] === 'kasir' || user.email.split('@')[0] === 'risma' ? user.email.split('@')[0] : 'Emong Kasir')
                : 'Emong Kasir');

          const profile: UserProfile = {
            id: user.uid,
            email: user.email || 'user@emongramen.com',
            displayName: resolvedDisplayName,
            role,
            shift: userDbData?.shift || 'Pagi',
            isActive: true,
            createdAt: userDbData?.createdAt || new Date().toISOString()
          };

          if (!userSnap.exists()) {
            await setDoc(userDocRef, profile, { merge: true });
          }

          setUserProfile(profile);
          setLoading(false);
        } catch (err) {
          console.warn('Failed to load user profile from Firestore:', err);
          const email = (user.email || '').toLowerCase();
          const isMasterAdmin = email === 'firman@emongramen.com' || email === 'pandircmss@gmail.com';
          setUserProfile({
            id: user.uid,
            email: user.email || 'firman@emongramen.com',
            displayName: user.displayName || (isMasterAdmin ? 'Firman (Admin Utama)' : 'Emong Kasir'),
            role: isMasterAdmin ? 'admin' : 'cashier',
            createdAt: new Date().toISOString()
          });
          setLoading(false);
        }
      } else {
        // No Firebase user signed in - STRICT LOGIN GUARD
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
    const raw = identifier.trim().toLowerCase();
    const candidateEmails: string[] = [];

    if (!raw.includes('@')) {
      candidateEmails.push(`${raw}@emongramen.com`);
      candidateEmails.push(`${raw}@ramenhouse.com`);
    } else if (!raw.includes('.')) {
      // e.g. risma@ramenhouse -> risma@ramenhouse.com
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
        loggedIn = true;

        // Check if master admin
        const emailLower = (res.user.email || '').toLowerCase();
        const isMasterAdmin =
          emailLower === 'firman@emongramen.com' ||
          emailLower === 'pandircmss@gmail.com' ||
          emailLower.startsWith('admin');

        // Validate role from Firestore
        const userSnap = await getDoc(doc(db, 'users', res.user.uid));
        const userRole = userSnap.data()?.role;

        if (!isMasterAdmin && userRole !== 'admin' && userRole !== 'cashier' && userRole !== 'kasir') {
          await signOut(auth);
          throw new Error('Akun Anda tidak memiliki hak akses ke sistem kasir.');
        }

        await logAuditAction('LOGIN_USER', `Login Pengguna: ${res.user.email}`);
        break;
      } catch (err: any) {
        lastError = err;
        if (err.message && err.message.includes('tidak memiliki hak akses')) {
          throw err;
        }
      }
    }

    // Auto-bootstrap default admin firman if account does not exist in Firebase Auth yet
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
          createdAt: new Date().toISOString()
        }, { merge: true });
        loggedIn = true;
      } catch (adminCreateErr) {
        console.warn('Auto-bootstrap admin error:', adminCreateErr);
      }
    }

    // Auto-bootstrap requested cashier Risma if not created in Firebase Auth yet
    if (
      !loggedIn &&
      (raw === 'risma' || raw === 'risma@ramenhouse' || raw === 'risma@ramenhouse.com' || raw === 'risma@emongramen.com') &&
      pass === 'risma123'
    ) {
      try {
        const cashierEmail = raw.includes('@') ? (raw.includes('.') ? raw : `${raw}.com`) : 'risma@emongramen.com';
        const res = await createUserWithEmailAndPassword(auth, cashierEmail, pass);
        await updateProfile(res.user, { displayName: 'Risma' });
        await setDoc(doc(db, 'users', res.user.uid), {
          id: res.user.uid,
          email: cashierEmail,
          displayName: 'Risma',
          role: 'cashier',
          shift: 'Pagi',
          passwordHint: 'risma123',
          isActive: true,
          createdAt: new Date().toISOString()
        }, { merge: true });
        loggedIn = true;
      } catch (rismaCreateErr) {
        console.warn('Auto-bootstrap cashier Risma error:', rismaCreateErr);
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

    // Save profile to Firestore with passwordHint so Admin can view it
    const newCashierProfile: UserProfile = {
      id: uid,
      email,
      displayName: name,
      role: 'cashier',
      shift,
      passwordHint: pass,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', uid), newCashierProfile);

    await logAuditAction(
      'TAMBAH_KASIR',
      `Admin mendaftarkan akun kasir baru: ${name} (${email}) - Shift: ${shift}`
    );
  };

  const deleteCashierAccount = async (cashierId: string, cashierName: string) => {
    if (!isAdmin) {
      throw new Error('Hanya Admin yang berhak menghapus akun kasir.');
    }

    await deleteDoc(doc(db, 'users', cashierId));
    await logAuditAction(
      'HAPUS_KASIR',
      `Admin menghapus akun kasir: ${cashierName} (ID: ${cashierId})`
    );
  };

  const logout = async () => {
    try {
      if (currentUser) {
        await signOut(auth);
      }
      setCurrentUser(null);
      setUserProfile(null);
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
        updateSettings,
        loginWithEmailOrUsername,
        loginWithGoogle,
        logout,
        addCashierAccount,
        deleteCashierAccount,
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
