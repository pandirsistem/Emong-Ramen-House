// @ts-nocheck
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import fallbackConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function getValidFirestoreDatabaseId(rawId?: string): string {
  const fallback = fallbackConfig.firestoreDatabaseId || 'ai-studio-bukukasprokeuang-bb99bdfd-9379-4cf2-9f84-a896dcf6c08e';
  if (!rawId || typeof rawId !== 'string') {
    return fallback;
  }
  const trimmed = rawId.trim();
  // Firestore database IDs cannot contain '://' or '/' or domain suffixes like .firebaseio.com (which are for RTDB)
  if (trimmed.includes('://') || trimmed.includes('/') || trimmed.includes('.firebaseio.com')) {
    console.warn(`[Firebase Config] Detected invalid URL in databaseId ("${trimmed}"). Falling back to valid Firestore database ID "${fallback}".`);
    return fallback;
  }
  return trimmed;
}

const rawDbEnv = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_DATABASE_ID : undefined;
const resolvedFirestoreDbId = getValidFirestoreDatabaseId(rawDbEnv || fallbackConfig.firestoreDatabaseId);

// Support both Vercel / external Vite environment variables AND fallback applet config
export const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || fallbackConfig.apiKey || 'AIzaSyD_52dxVTtX7BauRwabPI102mtw_MkPSWA',
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || fallbackConfig.authDomain || 'macro-respect-rjf39.firebaseapp.com',
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || fallbackConfig.projectId || 'macro-respect-rjf39',
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || fallbackConfig.storageBucket || 'macro-respect-rjf39.firebasestorage.app',
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || fallbackConfig.messagingSenderId || '478819153245',
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || fallbackConfig.appId || '1:478819153245:web:8bc0c61477fa45eaf364b4',
  firestoreDatabaseId: resolvedFirestoreDbId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const targetDbId =
  resolvedFirestoreDbId && resolvedFirestoreDbId !== '(default)'
    ? resolvedFirestoreDbId
    : undefined;

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    },
    targetDbId
  );
} catch (e) {
  firestoreInstance = getFirestore(app, targetDbId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item)) as any;
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        result[key] = cleanFirestoreData(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result as T;
}

export async function testConnection(): Promise<boolean> {
  try {
    return !!db;
  } catch (error) {
    return false;
  }
}

export async function createCashierInFirebaseAuth(email: string, pass: string, name: string): Promise<string> {
  const secondaryAppName = `SecApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  try {
    const secAuth = getAuth(secondaryApp);
    const userCred = await createUserWithEmailAndPassword(secAuth, email, pass);
    await updateProfile(userCred.user, { displayName: name });
    const uid = userCred.user.uid;
    await signOut(secAuth);
    return uid;
  } finally {
    try {
      await deleteApp(secondaryApp);
    } catch {}
  }
}
