import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBp0whARB0wj8lI7pfnz7JOosKvfwOPyLg',
  authDomain: 'checkbook-713a4.firebaseapp.com',
  projectId: 'checkbook-713a4',
  storageBucket: 'checkbook-713a4.firebasestorage.app',
  messagingSenderId: '680914695820',
  appId: '1:680914695820:web:929387e0ca1278fbdaeda9',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// Local development against `firebase emulators:start` (npm run dev:emu).
if (import.meta.env.VITE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
