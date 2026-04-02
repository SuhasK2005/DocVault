## 🔐 About DocVault

DocVault is a mobile-first, zero-knowledge digital vault designed to securely store, manage, and retrieve sensitive personal documents, notes, and credentials.

In today’s world, where data breaches and identity theft are rapidly increasing, users need a reliable and easy-to-use solution that protects their data — even without constant internet access.

DocVault solves this by using:
- AES-256 client-side encryption  
- Offline-first architecture  
- Multi-layer authentication system  

All encryption happens locally on the user’s device.  
The server never has access to your plaintext data or encryption keys.

---

## 🎯 Strategic Value

DocVault is built for:
- Privacy-conscious individuals  
- Working professionals  
- Small business owners  

It acts as a **secure, portable, and always-accessible personal vault**, without relying fully on cloud connectivity.

---

## 🛡️ Security Architecture

DocVault uses a multi-layer security model:

| Layer | Mechanism | Purpose |
|------|----------|--------|
| 1 — Identity | Google OAuth 2.0 | Verified user identity |
| 2 — Device | Face ID / Touch ID / PIN | Device-level access control |
| 3 — Application | 6-digit Master PIN | Vault access |
| 4 — Encryption | AES-256-GCM + PBKDF2 | Data protection |
| 5 — Transport | TLS 1.3 | Secure data transfer |
| 6 — Storage | Supabase + Row-Level Security | Isolated user data |

---

## 🔑 Key Security Principle

- Zero-knowledge architecture  
- Encryption keys are generated from the user’s Master PIN  
- No sensitive data is exposed to the backend  
- Full control stays with the user  

---

## ⚡ Why DocVault?

- Works even with limited or no internet  
- Strong encryption with modern standards  
- Simple and user-friendly design  
- Multi-layer protection for maximum security  
