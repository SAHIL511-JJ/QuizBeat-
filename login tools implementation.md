# Login Tools Implementation Plan

## 1. Purpose

This document is a standalone implementation plan for adding MCP auth tools to QuizBeat.

It is written so that:

- another agent can review it without prior conversation context
- another agent can implement from it step by step
- the team can agree on the auth design before coding

This plan covers:

- why login tools are needed before `save_quiz`
- how account identity should work
- the recommended architecture
- the exact scope of `login`, `logout`, and `whoami`
- backend, frontend, and MCP changes needed
- security rules
- testing plan
- later integration with `save_quiz`

Date of plan: **2026-03-22**

---

## 2. Current Project Context

### 2.1 Current MCP State

The current MCP server already supports:

- `upload_document`
- `generate_quiz`

Current MCP files:

- `mcp/server.py`
- `mcp/backend_client.py`
- `mcp/session_store.py`

Current MCP behavior:

- uploads a document to the backend
- stores parsed content in MCP process memory
- generates quiz questions from uploaded content
- does **not** save quizzes
- does **not** know which QuizBeat user is active

### 2.2 Current Frontend Auth State

The frontend already supports Google login through Firebase Auth.

Relevant files:

- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/services/firebase.js`

Current frontend behavior:

- user clicks "Continue with Google"
- Firebase popup login happens in the browser
- app state is updated with the logged-in Firebase user
- frontend can save quizzes because it knows `user.uid`

### 2.3 Current Backend Auth State

The backend already has `firebase-admin` in `backend/requirements.txt`, but there is currently no implemented backend auth layer for MCP actions.

Current backend situation:

- no backend route to verify MCP auth sessions
- no backend route for MCP login or logout
- no backend route to tell MCP who the current user is
- no backend route to save quizzes on behalf of an authenticated MCP user

---

## 3. Problem Statement

`save_quiz` cannot be designed correctly until MCP knows which QuizBeat account it is acting as.

Important constraint:

- the IDE's Google account is **not automatically linked** to the QuizBeat Firebase account

That means MCP does **not** automatically know:

- the Firebase user UID
- the user's name
- the user's email
- whether the user is logged in to QuizBeat

So before `save_quiz`, MCP must support account identity.

That is why `login`, `logout`, and `whoami` must come first.

---

## 4. What We Are Trying To Achieve

In simple words:

- user logs into QuizBeat once
- MCP learns which QuizBeat account is active
- MCP keeps that session for later tool calls
- `whoami` shows which account is active
- `logout` clears the session
- later `save_quiz` uses that authenticated session

Desired user experience:

1. user logs into QuizBeat web app with Google
2. user connects MCP to that same QuizBeat account
3. user can call MCP tools many times without re-entering identity each time
4. if user wants another account, they can logout and login again

---

## 5. Non-Goals

This phase should **not** implement:

- `save_quiz`
- host tools
- browser automation
- full token refresh system for every possible edge case
- multi-device sync
- enterprise auth

This phase is only about:

- `login`
- `whoami`
- `logout`
- the backend/session design needed for later authenticated tools

---

## 6. Design Principles Already Agreed

These are considered fixed unless explicitly changed later.

### 6.1 No Manual UID In Env For Real Users

Hardcoding Firebase UID in `.env` is acceptable only as a temporary developer shortcut.

It is **not** the real product design.

Reason:

- normal users do not know their Firebase UID
- it is not scalable
- it is not account-friendly

### 6.2 No Automatic IDE Account Linking

The IDE login does not automatically become a QuizBeat login.

Reason:

- IDE auth and Firebase auth are separate systems
- there is no automatic shared identity between them

### 6.3 No Playwright

No browser automation should be used for auth.

Reason:

- too fragile
- wrong abstraction
- auth should be explicit and server-verified

### 6.4 Session-Based User Model

MCP should behave like a normal logged-in client.

Meaning:

- login once
- use tools many times
- logout when needed
- switch account by logging out and logging back in

---

## 7. Recommended Auth Model

## 7.1 Summary

The recommended design is:

- user logs into QuizBeat in the browser as usual
- frontend creates a short-lived one-time MCP login code
- MCP `login` tool exchanges that code with the backend
- backend returns a QuizBeat MCP session token plus user info
- MCP stores that token locally
- later authenticated tools send that token to the backend

This is the best balance of:

- user friendliness
- security
- correctness
- future extensibility

## 7.2 Why This Model

This model is better than manual UID config because:

- user identity stays tied to real QuizBeat login
- backend decides who the user is
- MCP never guesses identity
- account switching is simple

This model is better than passing raw Firebase ID tokens around forever because:

- backend can issue its own MCP-specific session
- session lifetime and revocation are easier to control
- MCP does not need to manage Google auth directly

---

## 8. High-Level Flow

### 8.1 Login Flow

1. user logs into QuizBeat web app with Google
2. frontend gets the current Firebase ID token from the logged-in user
3. frontend calls backend to create a short-lived one-time MCP login code
4. backend verifies the Firebase ID token with Firebase Admin
5. backend stores a pending login record linked to that Firebase user
6. frontend shows the one-time code to the user
7. user calls MCP `login` with that code
8. MCP sends the code to backend
9. backend validates the code and creates an MCP session
10. backend returns:
   - session token
   - user UID
   - display name
   - email
   - session expiry
11. MCP stores the session locally
12. MCP returns login success

### 8.2 WhoAmI Flow

1. user calls MCP `whoami`
2. MCP checks local session store
3. optionally MCP asks backend to confirm the session is still valid
4. MCP returns current account info

### 8.3 Logout Flow

1. user calls MCP `logout`
2. MCP sends logout request to backend with current session token
3. backend invalidates the session if session invalidation is implemented
4. MCP clears its local stored session
5. MCP returns success

---

## 9. Why A One-Time Login Code Is Recommended

This is the key product decision.

Instead of asking users to:

- paste Firebase UID
- paste Google tokens
- log in directly through the IDE with a custom OAuth flow

we let them:

- log into QuizBeat normally in the browser
- copy a short login code once
- connect MCP to that account

Advantages:

- easy to understand
- no Google OAuth implementation inside MCP
- no browser automation
- no manual UID handling
- works well for individual users
- easy to review and debug

---

## 10. Session Model

## 10.1 What MCP Should Store Locally

MCP should store:

- QuizBeat MCP session token
- user UID
- display name
- email
- issued-at timestamp
- expiry timestamp

MCP should **not** store:

- Google password
- raw Google refresh token
- full Firebase browser session data

## 10.2 Storage Location

For implementation planning, prefer a user-scoped local session file outside the repo.

Recommended idea:

- a user config folder or Codex config-adjacent folder

Examples:

- `%APPDATA%\\QuizBeatMCP\\session.json`
- or another user-only config location

Reason:

- not tied to one repo checkout
- not checked into git
- more natural for account sessions

For an early internal version, a local file under `mcp/` is acceptable, but this should be treated as temporary.

## 10.3 Session Lifetime

Recommended first version:

- session valid for multiple days
- re-login only when session expires or user switches account

This avoids:

- logging in before every save
- friction during normal use

---

## 11. Exact MCP Tools To Add

These are the tools this plan is for.

### 11.1 `login`

#### Purpose

Connect the local MCP session to a real QuizBeat account that is already logged into the web app.

#### Recommended Input

```json
{
  "login_code": "ABC123XYZ"
}
```

#### Behavior

- accept the one-time code
- send it to backend
- receive session token and user info
- store the session locally
- return a success summary

#### Success Output

Should include:

- status
- display name
- email
- uid
- session expiry

#### Failure Cases

- invalid code
- expired code
- already-used code
- backend unavailable

### 11.2 `whoami`

#### Purpose

Show which QuizBeat account is currently active for MCP.

#### Recommended Input

No input required.

#### Behavior

- read local session
- optionally verify with backend
- return active user info

#### Success Output

Should include:

- authenticated: true or false
- display name
- email
- uid
- session expiry

#### Failure Cases

- no active session
- session expired
- backend invalidates the session

### 11.3 `logout`

#### Purpose

Clear the current MCP account session.

#### Recommended Input

No input required.

#### Behavior

- if session exists, ask backend to invalidate it if supported
- delete local session file
- return success

#### Success Output

Should include:

- status
- message

#### Failure Cases

- no active session
- backend unavailable during revoke

Important note:

Even if backend revoke fails, local session should still be cleared if the product decides local logout is the priority.

---

## 12. Backend Work Required

The current backend has no MCP auth routes.

This phase should add a small backend auth layer specifically for MCP.

## 12.1 New Backend Responsibilities

Backend must be able to:

- verify Firebase ID tokens from the logged-in frontend
- create one-time MCP login codes
- exchange login codes for MCP sessions
- return user identity for an active MCP session
- invalidate MCP sessions on logout

## 12.2 Recommended New Backend Routes

### A. `POST /api/mcp/auth/create-login-code`

Called by the frontend.

Input:

- Firebase ID token in `Authorization: Bearer <token>` header only

Behavior:

- read the Firebase ID token from the `Authorization` header
- verify Firebase ID token with Firebase Admin
- create a short-lived one-time login code
- store a pending login record
- return the code and expiry

### B. `POST /api/mcp/auth/login`

Called by the MCP `login` tool.

Input:

- one-time login code

Behavior:

- validate the code
- ensure it is not expired or used
- create an MCP session token
- mark code as consumed
- return session token and user info

### C. `GET /api/mcp/auth/whoami`

Called by MCP `whoami`.

Input:

- MCP session token

Behavior:

- validate session
- return user identity

### D. `POST /api/mcp/auth/logout`

Called by MCP `logout`.

Input:

- MCP session token

Behavior:

- invalidate session
- return success

## 12.3 Backend Storage For Pending Codes And Sessions

The backend needs storage for:

- one-time login codes
- active MCP sessions

Possible storage options:

- Firestore
- Realtime Database
- in-memory store for local-only prototype

Recommended choice:

- Firestore for real implementation

Reason:

- persistent
- multi-process safe
- better than in-memory for auth state

For a local-only internal prototype, in-memory can work, but this is weaker for account correctness and restart behavior.

**Storage Schema Recommendations:**

For Firestore:

**Collection: `mcp_login_codes`**
- Document ID: generated Firestore document ID
- Fields:
  - `code_hash` (hash of the one-time login code, never store raw code)
  - `user_id` (Firebase UID)
  - `email`
  - `display_name`
  - `created_at` (timestamp)
  - `expires_at` (timestamp)
  - `used` (boolean)
  - `used_at` (timestamp, optional)

**Collection: `mcp_sessions`**
- Document ID: generated Firestore document ID
- Fields:
  - `session_token_hash` (hash of the MCP session token, never store raw token)
  - `user_id` (Firebase UID)
  - `email`
  - `display_name`
  - `created_at` (timestamp)
  - `expires_at` (timestamp)
  - `last_used` (timestamp)
  - `revoked` (boolean)

These schemas support:
- cleanup of expired codes/sessions
- session usage tracking
- audit trails
- keeping raw secrets out of database storage

## 12.4 Backend Firebase Admin Work

Need a backend service module for Firebase Admin initialization and token verification.

Expected backend additions:

- Firebase Admin initialization helper
- function to verify Firebase ID token
- function to build MCP session records
- function to validate MCP sessions

### 12.5 Firebase Admin Configuration Requirements

This is required before implementation starts.

The backend cannot verify Firebase tokens unless Firebase Admin is configured correctly.

The plan must assume explicit credential setup for both local and deployed environments.

Recommended local development options:

- `GOOGLE_APPLICATION_CREDENTIALS` pointing to a Firebase service account JSON file
- or explicit env vars such as:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

Recommended production option:

- environment-based Firebase Admin credentials
- do not commit service account JSON into the repo

Deployment note:

The current deploy config in `render.yaml` does not yet define Firebase Admin credentials, so this must be added before backend auth endpoints can work in deployed environments.

---

## 13. Frontend Work Required

The frontend must provide a way for a logged-in QuizBeat user to connect MCP.

## 13.1 New Frontend Responsibility

The frontend should let a logged-in user generate a one-time MCP login code.

## 13.2 Recommended UI

Add a small account/settings action such as:

- "Connect MCP"
- or "Generate MCP Login Code"

The flow:

1. user logs into QuizBeat normally
2. user opens account/settings area
3. user clicks "Generate MCP Login Code"
4. frontend calls backend with the current Firebase ID token
5. backend returns a one-time code
6. frontend displays that code with expiry information
7. user copies the code into the MCP `login` tool

## 13.3 Frontend Technical Requirement

Frontend needs a way to get the current Firebase ID token.

Likely approach:

- use the current Firebase user object
- call `getIdToken()` when generating the MCP login code
- send that token in the `Authorization: Bearer <token>` header

---

## 14. MCP Work Required

The MCP server needs auth-aware support on top of the existing document tools.

## 14.1 New MCP Files Likely Needed

Recommended additions:

- `mcp/auth_client.py`
- `mcp/auth_store.py`

Possible updates:

- `mcp/server.py`
- `mcp/README.md`
- `mcp/.env.example`

## 14.2 MCP File Responsibilities

### `mcp/auth_client.py`

Should handle backend requests for:

- login
- whoami
- logout

### `mcp/auth_store.py`

Should handle local session persistence:

- save session
- load session
- clear session
- check basic expiry

### `mcp/server.py`

Should register:

- `login`
- `whoami`
- `logout`

And later authenticated tools should reuse the stored session from `auth_store.py`.

---

## 15. Suggested File Changes

This is a likely file-level implementation plan.

### Backend

New files likely needed:

- `backend/app/routers/mcp_auth.py`
- `backend/app/services/firebase_admin_service.py`
- `backend/app/services/mcp_auth_service.py`

Files likely updated:

- `backend/app/main.py`
- possibly `backend/requirements.txt` only if extra deps are needed

### Frontend

New files possibly needed:

- `frontend/src/services/mcpAuthService.js`
- a small page, modal, or settings component for MCP login code

Files likely updated:

- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/components/UI/Navbar.jsx`
- or another account/settings surface

### MCP

New files likely needed:

- `mcp/auth_client.py`
- `mcp/auth_store.py`

Files likely updated:

- `mcp/server.py`
- `mcp/README.md`
- `mcp/.env.example`

---

## 16. Tool Behavior Rules

These rules should be followed during implementation.

### 16.1 `login`

- should fail if code is missing
- should fail clearly if code is expired or invalid
- should overwrite any previous local session only after successful login
- should return current account info after success

### 16.2 `whoami`

- should work even if no backend call is made, as a local session view
- should support an optional `verify` boolean parameter for backend validation
- should clearly say when no user is logged in

### 16.3 `logout`

- should be safe to call even if already logged out
- should clear local session reliably
- should not leave stale account info behind

### 16.4 Future Authenticated Tools

After these tools exist, any authenticated action such as `save_quiz` should:

- require an active session
- fail with a clear "not logged in" error if no session exists
- send the MCP session token to the backend
- require backend-side session validation before performing the action
- never accept manual UID as the main production path

---

## 17. Security Rules

These are important.

### 17.1 Do Not Trust IDE Identity

Never assume the IDE's logged-in account equals the QuizBeat account.

### 17.2 Do Not Store Raw Google Credentials

MCP should not store Google password or browser session cookies from Google login.

### 17.3 Prefer App Session Tokens

Store a QuizBeat MCP session token, not a long-lived Google credential.

### 17.4 One-Time Codes Must Be Short-Lived

Login codes should expire quickly.

Suggested first target:

- 5 to 10 minutes

### 17.5 Login Codes Must Be Single-Use

After one successful `login`, the code should be consumed and unusable.

### 17.5A Never Store Raw Secrets In Backend Storage

The backend should never store:

- raw one-time login codes
- raw MCP session tokens

Instead:

- generate the raw secret once
- return it to the client
- store only a cryptographic hash in Firestore
- compare by hashing the presented secret during verification

### 17.6 Session Storage Must Be Local And Private

Local session file should be:

- outside git
- user-local
- treated as sensitive

### 17.7 Rate Limiting

Backend should implement rate limiting on:

- `/api/mcp/auth/create-login-code` - prevent abuse from generating unlimited codes
- `/api/mcp/auth/login` - prevent brute-force attempts

Suggested limits:
- Create code: 5 requests per 15 minutes per user
- Login attempts: 10 requests per 15 minutes per IP

### 17.8 Code Generation Security

Login codes should be:
- cryptographically random (not predictable)
- minimum 12 characters
- alphanumeric mix (avoid confusing characters like 0/O, 1/l)
- use `secrets` module in Python, not `random`

### 17.9 Session Token Security

MCP session tokens should be:
- cryptographically random
- minimum 32 characters
- unguessable
- use UUID v4 or similar

### 17.10 HTTPS Requirement

All backend auth endpoints MUST use HTTPS in production.
Local development can use HTTP only if explicitly configured.

### 17.11 Input Validation

All auth endpoints must validate:
- code format (length, character set)
- token format
- request body structure
- reject malformed requests before database queries

### 17.12 Backend Route Protection Rules

All future authenticated backend routes, including future `save_quiz`, must:

- read the MCP session token from a header such as `Authorization: Bearer <session_token>`
- validate the session server-side on every request
- derive the acting user from the validated session
- never trust user identity sent directly from the MCP client

---

## 18. Implementation Order

This is the recommended order of work.

### Phase 1: Backend Auth Foundations

1. create Firebase Admin service helper
2. add route to create one-time MCP login code
3. add route to exchange code for session
4. add route to return current session user
5. add route to logout

### Phase 2: Frontend MCP Connect Flow

1. add a UI action for "Generate MCP Login Code"
2. get Firebase ID token from current browser user
3. call backend to create login code
4. display code and expiry

### Phase 3: MCP Auth Tools

1. add auth client helper
2. add local auth store
3. add `login`
4. add `whoami`
5. add `logout`

### Phase 4: Integration Testing

1. test login from a real web session
2. test `whoami`
3. test logout
4. test account switching
5. test error cases (invalid codes, expired sessions, etc.)

### Phase 5: Documentation

1. update `mcp/README.md` with login flow documentation
2. add troubleshooting guide for common issues
3. document session file location and manual cleanup if needed
4. add example usage of all three auth tools

### Phase 6: Then Build `save_quiz`

Only after the auth tools are stable and documented.

---

## 19. Manual Testing Plan

This plan should be executed after implementation.

### 19.1 Login Success Test

1. login to QuizBeat in the browser
2. generate MCP login code
3. call MCP `login` with the code
4. confirm returned user matches browser account

Expected:

- login succeeds
- session saved locally
- `whoami` shows the same user

### 19.2 Invalid Code Test

1. call MCP `login` with a fake code

Expected:

- clear error
- no local session saved

### 19.3 Expired Code Test

1. generate code
2. wait until expiry (or manipulate expiry time in test)
3. call `login`

Expected:

- clear expired error

### 19.4 Code Reuse Prevention Test

1. generate code
2. call `login` successfully
3. call `logout`
4. attempt to call `login` with same code again

Expected:

- clear "code already used" error

### 19.5 Logout Test

1. login successfully
2. call `logout`
3. call `whoami`

Expected:

- logout succeeds
- `whoami` shows no active account
- local session file deleted or cleared

### 19.6 Account Switch Test

1. login as account A
2. call `whoami`
3. logout
4. login in browser as account B
5. generate new code
6. call `login`
7. call `whoami`

Expected:

- MCP now shows account B
- no stale account A session remains

### 19.7 Session Persistence Test

1. login successfully
2. restart MCP server
3. call `whoami`

Expected:

- session persists across restarts
- user still logged in

### 19.8 Concurrent Login Test

1. login from device/location A
2. login from device/location B with different code
3. call `whoami` from both

Expected:

- both sessions active (or enforce single session if policy changes)

### 19.9 Network Failure Test

1. login successfully
2. disconnect network
3. call `whoami`
4. call `logout`

Expected:

- `whoami` works from local cache
- `logout` clears local session even if backend unreachable

### 19.10 Backend Unavailable During Login Test

1. stop backend server
2. attempt `login`

Expected:

- clear "backend unavailable" error
- no partial session state saved

### 19.11 Session Expiry Test

1. login successfully
2. manipulate session expiry (or wait for expiry in test environment)
3. call `whoami`

Expected:

- clear "session expired" message
- prompt to login again

### 19.12 Future Save Integration Test

After `save_quiz` exists:

1. login as user
2. upload and generate quiz
3. save quiz
4. open "My Quizzes" in app

Expected:

- quiz appears under the same account

---

## 20. Review Questions For Other Agents

Other agents reviewing this plan should answer these questions.

### Architecture Review

- Is the one-time login code model the right tradeoff for this app?
- Should backend sessions live in Firestore or another store?
- Should session validation always call backend or only sometimes?

### Security Review

- Is local session storage acceptable for the first version?
- Should session revoke be mandatory on logout?
- Is the proposed session lifetime reasonable?

### UX Review

- Where should "Generate MCP Login Code" live in the frontend?
- Is the login code copy flow easy enough for users?
- Should `login` require only a code, or code plus extra confirmation details?

### Implementation Review

- Are the proposed new files the right split?
- Is the implementation order safe and incremental?
- Are there any missing edge cases before starting code?

---

## 21. Open Questions

These should be resolved before coding if possible.

1. Where exactly should the frontend expose "Generate MCP Login Code"?
   - Recommendation: Add to account dropdown menu in Navbar or Settings page
2. Should sessions be stored in Firestore, Realtime Database, or another store?
   - Recommendation: Firestore for better querying and structure
3. What exact session duration should the first version use?
   - Recommendation: 7 days with optional refresh on use
4. Should `whoami` always call backend, or trust local session unless expired?
   - Recommendation: Trust local session by default, but add an optional `verify=true` parameter for backend check
5. Should `logout` succeed locally even if backend revoke fails?
   - Recommendation: Yes - always clear local session, log backend failure as warning
6. **NEW**: Should expired sessions be automatically cleaned up from backend storage?
   - Recommendation: Yes - implement a Cloud Function or scheduled task to delete expired codes/sessions
7. **NEW**: Should there be a limit on concurrent MCP sessions per user?
   - Recommendation: No limit in v1, but track for future monitoring
8. **NEW**: What happens if a user generates multiple login codes before using any?
   - Recommendation: Allow multiple valid codes simultaneously, mark as used when consumed

---

## 22. Recommended Decision Summary

If the team wants a clear recommendation, use this:

- build `login`, `whoami`, and `logout` before `save_quiz`
- do not use manual UID env as the real user flow
- do not use Playwright
- do not depend on IDE account identity
- use browser login to QuizBeat plus one-time MCP login code
- let backend verify identity and issue MCP session
- store MCP session locally
- use that session later for `save_quiz`

---

## 23. Error Handling Strategy

All auth tools should return consistent error structures.

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {} // optional additional context
  }
}
```

### Error Codes To Implement

**Login errors:**
- `INVALID_CODE` - code format invalid
- `CODE_NOT_FOUND` - code doesn't exist
- `CODE_EXPIRED` - code expired
- `CODE_ALREADY_USED` - code was already consumed
- `BACKEND_ERROR` - backend unavailable or error

**Whoami errors:**
- `NOT_LOGGED_IN` - no active session
- `SESSION_EXPIRED` - session expired
- `SESSION_INVALID` - session token invalid
- `BACKEND_ERROR` - backend verification failed

**Logout errors:**
- `NOT_LOGGED_IN` - no session to logout
- `BACKEND_ERROR` - backend revoke failed (but local cleared)

### User-Friendly Messages

Errors should guide users to the solution:

- "No active session. Please run 'login' with a code from the QuizBeat app."
- "Login code expired. Please generate a new code from the QuizBeat app settings."
- "This code has already been used. Please generate a new code."

---

## 24. Performance Considerations

### Backend Response Times

Target response times:
- Create login code: < 500ms
- Login: < 1s
- Whoami: < 300ms
- Logout: < 500ms

### Session Validation Strategy

To avoid unnecessary backend calls while still keeping authenticated actions safe:

1. `whoami` with default behavior: read local session, check expiry locally
2. `whoami(verify=true)`: call backend to validate session still active
3. Future authenticated tools: local expiry check can be used as a fast pre-check, but the backend must still validate the session before executing the protected action

### Cleanup Job Frequency

Recommended: Run cleanup of expired codes/sessions every 1 hour

---

## 25. Monitoring and Logging

### Backend Logging Requirements

Log the following events:
- Login code creation (user_id, timestamp)
- Login code usage attempts (code, success/failure, timestamp)
- Session creation (user_id, session_id, timestamp)
- Session validation requests (session_id, timestamp)
- Logout requests (session_id, timestamp)

Do NOT log:
- Raw login codes in clear text (use hashed versions or redact)
- Session tokens in clear text
- Full Firebase ID tokens

### MCP Logging Requirements

Log the following:
- Login attempts (success/failure)
- Session load/save operations
- Logout operations

Store logs locally for troubleshooting.

---

## 26. Future Enhancements (Out of Scope for V1)

These are explicitly NOT part of this implementation but documented for future reference:

1. **Refresh Token Support** - auto-renew sessions without re-login
2. **Multi-Device Session Management** - view and revoke sessions from web UI
3. **Session Analytics** - track MCP usage patterns
4. **OAuth Direct Flow** - allow MCP to initiate Google OAuth directly (complex)
5. **Team/Organization Support** - multi-user workspace auth
6. **API Key Alternative** - generate long-lived API keys for CI/CD
7. **Biometric Auth** - fingerprint/face unlock for session access
8. **2FA Integration** - require 2FA for MCP login code generation

---

## 27. Immediate Next Step

The next action after approval of this plan should be:

1. decide the one-time login code approach is accepted
2. decide where to place the frontend "Generate MCP Login Code" UI
3. decide final session duration (recommendation: 7 days)
4. decide rate limiting values
5. then implement backend auth endpoints first

That is the cleanest starting point.

---

## 28. Implementation Checklist

Use this during development to track progress:

### Backend Tasks
- [ ] Create Firebase Admin service helper
- [ ] Add Firestore schema for login codes
- [ ] Add Firestore schema for sessions
- [ ] Implement `POST /api/mcp/auth/create-login-code`
- [ ] Implement `POST /api/mcp/auth/login`
- [ ] Implement `GET /api/mcp/auth/whoami`
- [ ] Implement `POST /api/mcp/auth/logout`
- [ ] Add rate limiting middleware
- [ ] Add input validation
- [ ] Add error handling
- [ ] Add logging
- [ ] Implement cleanup job for expired codes/sessions

### Frontend Tasks
- [ ] Create MCP auth service module
- [ ] Add "Generate MCP Login Code" UI component
- [ ] Integrate with existing AuthContext
- [ ] Add code display with copy button
- [ ] Add expiry countdown
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test with real Firebase auth

### MCP Tasks
- [ ] Create `auth_client.py`
- [ ] Create `auth_store.py`
- [ ] Implement local session persistence
- [ ] Add `login` tool
- [ ] Add `whoami` tool
- [ ] Add `logout` tool
- [ ] Add error handling
- [ ] Update `README.md`
- [ ] Update `.env.example`
- [ ] Add usage examples

### Testing Tasks
- [ ] Test all success paths
- [ ] Test all error cases
- [ ] Test session persistence
- [ ] Test account switching
- [ ] Test network failures
- [ ] Test concurrent sessions
- [ ] Test security (code reuse, rate limiting)
- [ ] Test cleanup jobs
- [ ] Integration test with future save_quiz

### Documentation Tasks
- [ ] Document login flow
- [ ] Document error codes
- [ ] Document troubleshooting steps
- [ ] Add architecture diagrams
- [ ] Document security considerations
