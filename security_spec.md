# Security Specification: Chirakumar Sangha Bangladesh Firestore Rules

## 1. Data Invariants
1. **PII Isolation**: Member phone numbers and email addresses live exclusively in `/members/{memberId}/private/contact`, never in public `/members/{memberId}` documents, and are readable/updatable/deletable only by verified admins.
2. **Master Gate**: Committee member documents under `/committees/{committeeId}/members/{cmId}` cannot exist without an existing parent `/committees/{committeeId}` document, and mutations require admin privileges.
3. **Atomicity Guarantee**: Creating `/members/{memberId}/private/contact` requires `existsAfter(/databases/$(database)/documents/members/$(memberId))` so orphaned PII sub-documents cannot be written without a parent member.
4. **Admin Bootstrapping & RBAC**: Admin access requires a verified Google account (`email_verified == true`) either present in `/admins/{uid}` or matching the bootstrapped runtime admin email. Unverified tokens or client-supplied role claims are rejected.
5. **Donation Integrity**: Public donation submissions must start with `status == 'pending'`; only admins may read, verify (`status == 'verified'`), or delete donations.
6. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on create and update.
7. **Strict Keys & Size Limits**: Every document write validates `keys().hasAll(...)` and `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, `isValidId()` on document IDs, and `.size()` bounds on all strings.

## 2. "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Shadow Field Injection on Member**: Creating `/members/999` with an extra `isAdmin: true` field -> blocked by `keys().hasOnly(...)`.
2. **PII Leakage in Public Member**: Creating `/members/999` with `phone` or `email` directly on the public document -> blocked by `keys().hasOnly(...)`.
3. **Unauthenticated PII Read**: Calling `getDoc` on `/members/1/private/contact` without admin auth -> blocked by `isAdmin()`.
4. **Orphaned PII Write**: Writing `/members/99999/private/contact` without creating `/members/99999` in the same batch -> blocked by `existsAfter(...)`.
5. **Auto-Verified Donation Fraud**: Submitting `/donations/d1` with `status: 'verified'` as an unauthenticated visitor -> blocked by `incoming().status == 'pending'`.
6. **Donation List Scraping**: Calling `getDocs('/donations')` or `getDocs('/messages')` as a non-admin -> blocked by `isAdmin()`.
7. **Email Spoofing Attack**: Authenticating with admin email where `email_verified == false` -> blocked by `request.auth.token.email_verified == true`.
8. **Self-Assigned Admin Escalation**: Writing `/admins/{uid}` as a non-admin user -> blocked by `isAdmin()`.
9. **ID Poisoning**: Creating `/members/bad$id!!` or a 500-char document ID -> blocked by `isValidId(memberId)`.
10. **Timestamp Spoofing**: Creating a notice/event/member with a backdated `createdAt` instead of `serverTimestamp()` -> blocked by `incoming().createdAt == request.time`.
11. **Value Poisoning on Update**: Admin or attacker setting `photoUrl` > 250,000 chars or `age: 200` -> blocked by `isValidMember(...)` in update rule.
12. **Orphaned Committee Member**: Creating `/committees/missing/members/cm1` when parent committee does not exist -> blocked by `exists(...)` Master Gate.
