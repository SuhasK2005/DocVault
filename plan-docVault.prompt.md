## Plan: DocVault Mobile Application

A secure, E2EE mobile application using Expo (React Native) and Supabase to store documents, notes, and passwords.

**Steps**

1. **Phase 1: Project Setup & Authentication**
   - Initialize the `DocVault` Expo project with NativeWind (Tailwind) support.
   - Configure Supabase client for React Native.
   - Implement Google OAuth using `expo-auth-session` and link via `expo-linking`.
   - Setup Zustand store for session state.
2. **Phase 2: Gateway Lock & Cryptographic Setup**
   - Implement App Unlock via device Biometrics (FaceID/Fingerprint) / Passcode as the primary gateway.
   - If a new user signs in, prompt them to set up a 6-digit Master PIN (hashed for DB validation, deriving a 256-bit AES key locally using `crypto-js` and `expo-crypto` PRNG).
   - If an existing user returns, Biometrics instantly unlocks them into the Dashboard. They only provide the Master PIN when actually reading/writing encrypted files.
3. **Phase 3: Folder & File Management**
   - Implement Dashboard UI displaying User Folders and Recent Files.
   - Define Supabase PostgreSQL schemas for `folders` and `documents` (including `is_encrypted` flags).
   - Integrate `expo-document-picker` to select and prepare files for upload.
   - Implement on-the-fly prompt for the Master PIN when the user decides to encrypt a file or open an already encrypted file (deriving the key just-in-time).
   - Upload encrypted ciphertext to Supabase Storage.
4. **Phase 4: Secure Notes & Password Vault**
   - Create UI for Note and Password creation.
   - Encrypt notes/passwords on-device and insert encrypted text into Supabase database.
5. **Phase 5: App Lifecycle & Polish**
   - Handle app background state using `AppState` to require biometric/master password unlock upon resume.
   - Review E2EE workflows by logging in on a second device to ensure files only open with the correct Master Password.

**Relevant files**

- `App.tsx` — Main entry and Navigation container.
- `src/stores/useAuthStore.ts` — Zustand store for auth state and master key caching.
- `src/services/supabase.ts` — Supabase client initialization.
- `src/services/encryption.ts` — AES-256 wrapping utility with `crypto-js`.
- `src/screens/LoginScreen.tsx` — Google Auth integration.
- `src/screens/UnlockScreen.tsx` — Biometric / Master password prompt.

**Verification**

1. Ensure opening the app or resuming from background triggers the Unlock screen.
2. Verify network tab that file payloads and notes uploaded to Supabase are encrypted ciphertexts.
3. Test Google login success with Expo Go/Development build.

**Decisions**

- **Styling**: NativeWind
- **E2EE Model**: User-provided Master Password (highest security, no server-side key escrow).
- **Backend**: Supabase PostgreSQL and Storage.
