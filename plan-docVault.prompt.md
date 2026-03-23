## Plan: DocVault Mobile Application

A secure, E2EE mobile application using Expo (React Native) and Supabase to store documents, notes, and passwords.

**Steps**
1. **Phase 1: Project Setup & Authentication**
   - Initialize the `DocVault` Expo project with NativeWind (Tailwind) support.
   - Configure Supabase client for React Native.
   - Implement Google OAuth using `expo-auth-session`.
   - Setup Zustand store for session state.
   - Add Expo Local Authentication (Biometric lock).
2. **Phase 2: Master Password & Core Navigation**
   - Implement Master Password setup screen (hash for DB validation, derive key for E2EE via `crypto-js`).
   - Setup React Navigation with protected routes (Splash, Login, Unlock, Dashboard, Files, Notes).
3. **Phase 3: Folder & File Management**
   - Implement Dashboard UI (Folders & Recent Files).
   - Create Supabase functions/endpoints for Folder CRUD.
   - Integrate `expo-document-picker` to select files.
   - Encrypt file chunks using derived master key locally before pushing to Supabase Storage.
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
