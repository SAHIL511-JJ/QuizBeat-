# Save Quiz Implementation Plan

## 1. Purpose

This document is a standalone implementation plan for adding `save_quiz` support to the QuizBeat MCP server.

It is written so that:

- another agent can review it without prior conversation context
- another agent can implement from it step by step
- the team can agree on the save flow before coding

This plan assumes:

- MCP `login`, `whoami`, and `logout` already exist
- MCP `upload_document` and `generate_quiz` already exist
- the next feature is saving a generated quiz to the currently logged-in QuizBeat account

Date of plan: **2026-03-23**

---

## 2. Current Project Context

### 2.1 What Already Works

Current MCP tools:

- `login`
- `whoami`
- `logout`
- `upload_document`
- `generate_quiz`

Current frontend behavior:

- users log into QuizBeat with Google
- frontend can save quizzes directly to Firestore using the browser Firebase SDK
- "My Quizzes" reads from Firestore collection `quizzes`

Relevant current files:

- `mcp/server.py`
- `mcp/auth_store.py`
- `frontend/src/services/quizService.js`
- `frontend/src/pages/GenerateQuiz.jsx`
- `frontend/src/pages/MyQuizzes.jsx`
- `backend/app/services/mcp_auth_service.py`

### 2.2 How Frontend Save Works Today

The frontend currently saves quizzes directly to Firestore in:

- `frontend/src/services/quizService.js`

Current saved document shape:

- `title`
- `questions`
- `difficulty`
- `numQuestions`
- `source`
- `textbook`
- `chapters`
- `creatorId`
- `creatorName`
- `createdAt` — stored via Firestore `serverTimestamp()`, **not** a plain ISO string
- `updatedAt` — same, stored via Firestore `serverTimestamp()`

> ⚠️ **CRITICAL**: the current frontend sorts quizzes in `frontend/src/services/quizService.js` using `a.createdAt?.toMillis?.()`, which is a Firestore Timestamp method. `frontend/src/pages/MyQuizzes.jsx` also expects timestamp-like values for display via `createdAt?.toDate?.()`. If `createdAt`/`updatedAt` are saved as plain ISO strings (e.g. `datetime.now().isoformat()`), sorting will silently degrade and display behavior will be inconsistent. Backend must use Firestore's `SERVER_TIMESTAMP` sentinel when writing, not Python datetime strings.

This matters because the MCP save flow must write the same shape, so the existing frontend "My Quizzes" page continues to work without changes.

### 2.3 Current Gap

Right now MCP can generate quiz questions, but it cannot save them to the logged-in QuizBeat account.

So the missing link is:

- authenticated save through backend using the MCP session

---

## 3. What We Are Trying To Achieve

In simple words:

- user logs into QuizBeat through MCP
- user generates a quiz through MCP
- user runs `save_quiz`
- backend validates the MCP session
- backend saves the quiz to Firestore under the correct QuizBeat user
- quiz appears in "My Quizzes" in the app

Important rule:

- MCP should **not** decide the user identity
- backend should derive the user from the validated MCP session

---

## 4. Core Design Decisions

These are the important design decisions for this feature.

### 4.1 `save_quiz` Must Be A Separate Action

We are **not** making a combined action like:

- generate and save together

Correct flow:

1. generate quiz
2. inspect quiz if needed
3. save quiz separately

This matches the agreed MCP design style.

### 4.2 Backend Must Own Identity

The `save_quiz` tool should not trust:

- `creatorId` from MCP input
- `creatorName` from MCP input

Instead:

- MCP sends the quiz data
- backend validates MCP session token
- backend gets the real user from session
- backend fills `creatorId` and `creatorName`

This is the most important rule in this plan.

### 4.3 Save To The Existing Firestore Collection

The backend should save to the existing Firestore collection:

- `quizzes`

Reason:

- current frontend already reads from that collection
- "My Quizzes" will continue to work automatically
- no migration is needed for the first version

### 4.4 Generated Quizzes Should Be Cached In MCP Memory

Right now `generate_quiz` returns question data, but it does not create a stable MCP quiz handle.

For clean separate actions, MCP should store generated quizzes in memory and return:

- `quiz_id`

Then `save_quiz` should use:

- `quiz_id`

instead of requiring the IDE to resend the full question list manually.

This keeps the user flow simple and consistent.

### 4.5 No Frontend Refactor Is Required For V1

The frontend can keep its existing browser-side save code for now.

For this phase, we only need to add MCP save through backend.

Later, if desired, the frontend can also be migrated to backend-based save for consistency.

---

## 5. Proposed User Flow

### 5.1 Main Flow

1. user logs into QuizBeat via MCP
2. user uploads a document
3. user generates a quiz
4. MCP returns:
   - generated questions
   - new `quiz_id`
5. user calls `save_quiz(quiz_id=...)`
6. MCP loads the generated quiz from local quiz cache
7. MCP sends quiz payload to backend save route with MCP session token
8. backend validates session
9. backend writes quiz to Firestore
10. backend returns saved document ID and metadata
11. user opens "My Quizzes" in the app and sees the new quiz

### 5.2 Example User Commands

- "Generate 10 medium questions from this document"
- "Save that quiz"
- "Save quiz `quiz_ab12cd34` as Java Concurrency Hard Quiz"

---

## 6. Scope

### 6.1 In Scope

- add MCP quiz cache with `quiz_id`
- update `generate_quiz` to store generated results in memory
- add backend save route for MCP
- add Firestore save service on backend
- add MCP `save_quiz` tool
- ensure saved quizzes appear in existing frontend "My Quizzes"

### 6.2 Out Of Scope

- list quizzes via MCP
- delete quizzes via MCP
- edit saved quizzes via MCP
- save uploaded textbooks permanently
- refactor frontend save flow to backend
- duplicate detection / de-duplication
- sharing/hosting from saved MCP quizzes

---

## 7. High-Level Architecture

### 7.1 Components

#### MCP Server

Responsibilities:

- keep generated quiz cache in memory
- expose `save_quiz`
- load current MCP login session from `auth_store`
- call backend save endpoint

#### Backend

Responsibilities:

- validate MCP session token
- derive the current QuizBeat user from the session
- validate incoming quiz payload
- save quiz document into Firestore

#### Firestore

Responsibilities:

- store quiz document in collection `quizzes`

#### Frontend

Responsibilities:

- no required save-path changes for this phase
- existing "My Quizzes" should display saved MCP quizzes automatically

### 7.2 Data Flow

`IDE -> MCP save_quiz tool -> backend MCP save route -> Firestore quizzes collection -> existing frontend My Quizzes view`

---

## 8. MCP Changes Required

### 8.1 Add Quiz Cache

MCP needs a new in-memory quiz store.

Recommended new file:

- `mcp/quiz_store.py`

Responsibilities:

- store generated quiz payloads by `quiz_id`
- get quiz by `quiz_id`
- list stored quizzes if needed later
- optional clear function

### 8.2 Update `generate_quiz`

Current `generate_quiz` should be updated so that after generating questions, it also:

- creates a `quiz_id`
- stores the generated quiz in `quiz_store`
- returns the `quiz_id` in the tool response

Recommended cached quiz shape:

```json
{
  "quiz_id": "quiz_ab12cd34",
  "document_id": "doc_1234abcd",
  "source_filename": "java_programming.txt",
  "difficulty": "hard",
  "num_questions": 15,
  "selected_chapters": ["Chapter 1", "Chapter 2"],
  "questions": [
    {
      "question": "What is ...?",
      "options": ["A", "B", "C", "D"],
      "correct": 2
    }
  ],
  "created_at": "2026-03-23T12:00:00Z"
}
```

### 8.3 Add `save_quiz` Tool

Recommended MCP tool:

- `save_quiz`

Recommended input:

```json
{
  "quiz_id": "quiz_ab12cd34",
  "title": "Java Hard Quiz",
  "source": "ai"
}
```

Recommended optional fields:

- `title`
- `source`

If `title` is omitted:

- MCP should derive a reasonable default title before calling backend
- recommended default: `<source_filename> - <difficulty> quiz`

Data MCP should get from cache:

- `questions`
- `difficulty`
- `chapters` (= `selected_chapters` from `generate_quiz` result)
- `numQuestions` (= `num_questions` from the cached quiz)
- `textbook` (= `source_filename` from the cached quiz — **note**: the MCP quiz cache stores `source_filename`, which maps to the `textbook` field in the Firestore schema)

MCP should get auth from:

- `auth_store`

### 8.4 Save Tool Validation

`save_quiz` should validate:

- active authenticated MCP session exists
- session not expired locally
- `quiz_id` exists in quiz cache
- quiz has at least 1 question
- questions are in expected format

If no active session:

- return clear "not logged in" error

If no quiz found:

- return clear "quiz_id not found" error

---

## 9. Backend Changes Required

### 9.1 Add MCP Quiz Save Route

Recommended new route:

- `POST /api/mcp/quizzes/save`

Reason:

- route is clearly MCP-specific
- route uses MCP session auth
- no ambiguity with frontend browser save flow

### 9.2 Backend Route Responsibilities

The route must:

1. read MCP session token from `Authorization: Bearer <session_token>`
2. validate session using existing MCP auth service
3. derive the real user from the validated session
4. validate incoming quiz payload
5. build Firestore quiz document
6. save to collection `quizzes`
7. return saved quiz ID and summary

### 9.3 Suggested Backend Files

Recommended new files:

- `backend/app/routers/mcp_quizzes.py`
- `backend/app/services/quiz_persistence_service.py`

Files likely updated:

- `backend/app/main.py` — add `from app.routers import mcp_quizzes` and `app.include_router(mcp_quizzes.router, prefix="/api", tags=["MCP Quizzes"])`
- `backend/app/routers/__init__.py` — optional only if the project starts using explicit router exports there later; the current file is effectively empty, so this is not required for the current import style

### 9.4 Suggested Payload Schema

Request body to backend:

```json
{
  "title": "Java Hard Quiz",
  "questions": [
    {
      "question": "What is ...?",
      "options": ["A", "B", "C", "D"],
      "correct": 2
    }
  ],
  "difficulty": "hard",
  "source": "ai",
  "textbook": "java_programming.txt",
  "chapters": [
    "Chapter 1",
    "Chapter 2"
  ]
}
```

Important:

- `creatorId` must **not** be accepted from MCP as trusted input
- `creatorName` must **not** be accepted from MCP as trusted input

These must be filled from the validated MCP session.

### 9.5 Firestore Document Shape

Backend should write this shape to Firestore:

```json
{
  "title": "Java Hard Quiz",
  "questions": [...],
  "difficulty": "hard",
  "numQuestions": 15,
  "source": "ai",
  "textbook": "java_programming.txt",
  "chapters": ["Chapter 1", "Chapter 2"],
  "creatorId": "firebase_uid",
  "creatorName": "User Name",
  "createdAt": "<Firestore SERVER_TIMESTAMP>",
  "updatedAt": "<Firestore SERVER_TIMESTAMP>"
}
```

> ⚠️ **`createdAt` and `updatedAt` must use `firestore.SERVER_TIMESTAMP`** (from `google.cloud.firestore`), not Python datetime or ISO strings. `MyQuizzes.jsx` calls `.toMillis()` on these values, which only works on native Firestore Timestamp objects.

This matches the shape already expected in:

- `frontend/src/services/quizService.js` (uses `serverTimestamp()` from Firebase JS SDK)
- `frontend/src/pages/MyQuizzes.jsx` (uses timestamp-like values for display)

### 9.6 Backend Validation Rules

Backend should validate:

- title exists and is not blank
- questions array is not empty
- each question has:
  - `question` — string
  - `options` — list of **exactly 4** strings (the Groq service always returns exactly 4, backend must enforce this too)
  - `correct` — integer 0–3 (inclusive)
- difficulty is one of:
  - `easy`
  - `medium`
  - `hard`
- `source` defaults to `"ai"` if missing or blank

### 9.7 Backend Auth Rule

The save route must validate the MCP session on every request.

This is non-negotiable.

The acting user must always come from:

- validated MCP session

Not from:

- body field
- query param
- local MCP assumption

---

## 10. Frontend Impact

### 10.1 What Should Keep Working Automatically

If backend writes the same Firestore shape to `quizzes`, then these existing frontend features should work without any save-path changes:

- "My Quizzes"
- sharing saved quizzes by ID
- hosting saved quizzes from the frontend

### 10.2 Frontend Changes Required For This Phase

None required for the actual save path.

Frontend already:

- reads by `creatorId`
- displays `numQuestions`
- uses the `quizzes` collection

So MCP-saved quizzes should simply appear there.

### 10.3 Future Improvement

Later, frontend save can be migrated to backend too for consistency, but that is not required now.

---

## 11. Recommended File-Level Plan

### Backend

New files:

- `backend/app/routers/mcp_quizzes.py`
- `backend/app/services/quiz_persistence_service.py`

Updated files:

- `backend/app/main.py` — register new `mcp_quizzes` router under `/api`
- `backend/app/routers/__init__.py` — add `mcp_quizzes` to imports

### MCP

New files:

- `mcp/quiz_store.py`

Updated files:

- `mcp/server.py` — update `generate_quiz` to cache result + return `quiz_id`; add `save_quiz` tool
- `mcp/backend_client.py` — add `save_quiz` HTTP helper
- `mcp/README.md`

### Frontend

No required file changes for this save feature itself.

---

## 12. Exact MCP Tool Contract

### 12.1 Updated `generate_quiz`

Should still return:

- questions
- difficulty
- selected chapters

Should now also return:

- `quiz_id`

Example:

```json
{
  "status": "success",
  "quiz_id": "quiz_ab12cd34",
  "document_id": "doc_1234abcd",
  "source_filename": "java_programming.txt",
  "difficulty": "hard",
  "num_questions": 15,
  "selected_chapters": ["Chapter 1"],
  "questions": [...]
}
```

### 12.2 New `save_quiz`

Recommended signature:

```json
{
  "quiz_id": "quiz_ab12cd34",
  "title": "Java Hard Quiz",
  "source": "ai"
}
```

Recommended success response:

```json
{
  "status": "success",
  "saved": true,
  "quiz_id": "quiz_ab12cd34",
  "saved_quiz_id": "firestore_doc_id",
  "title": "Java Hard Quiz",
  "num_questions": 15,
  "difficulty": "hard",
  "creator_id": "firebase_uid",
  "creator_name": "User Name"
}
```

Recommended error cases:

- `NOT_LOGGED_IN`
- `SESSION_EXPIRED`
- `QUIZ_NOT_FOUND`
- `INVALID_QUIZ_PAYLOAD`
- `BACKEND_ERROR`

---

## 13. Why Quiz Cache Is Important

Without quiz cache:

- MCP would have to resend full question arrays manually from IDE memory
- tool chaining becomes awkward
- users cannot say "save that quiz" cleanly

With quiz cache:

- `generate_quiz` returns a real handle
- `save_quiz` stays separate
- flow stays simple

This is the cleanest MCP design for this feature.

---

## 14. Security Rules

### 14.1 Do Not Trust User Identity From MCP Input

Never accept:

- `creatorId`
- `creatorName`

as trusted save inputs.

### 14.2 Validate Session Server-Side

Every save request must be validated by backend using the MCP session token.

### 14.3 Save Only To The Authenticated User

The saved Firestore document must always use:

- `creatorId = validated_session.uid`
- `creatorName = validated_session.display_name`

### 14.4 No Raw Firestore Writes From MCP

MCP should not write directly to Firestore.

Reason:

- backend should stay the authority for auth and validation

---

## 15. Non-Blocking Design Choices

These choices are acceptable for V1.

### 15.1 Quiz Cache Can Be In-Memory

For first version:

- generated quiz cache can live only in MCP memory

Known limitation:

- if MCP restarts, unsaved generated quizzes are lost

That is acceptable for now because save usually happens soon after generation.

### 15.2 Duplicate Saves Can Be Allowed

For first version:

- saving the same generated quiz twice can be allowed

If needed later, duplicate prevention can be added.

---

## 16. Implementation Order

Recommended order:

### Phase 1: MCP Quiz Cache

1. add `mcp/quiz_store.py`
2. update `generate_quiz` to create/store `quiz_id`
3. return `quiz_id` in MCP response

### Phase 2: Backend Save Route

1. add quiz persistence service
2. add MCP save route
3. validate session using existing MCP auth service
4. save to Firestore collection `quizzes`

### Phase 3: MCP Save Tool

1. add backend save helper to `mcp/backend_client.py`
2. add `save_quiz` tool in `mcp/server.py`
3. load session from `auth_store`
4. load quiz from `quiz_store`
5. call backend save route

### Phase 4: Documentation

1. update `mcp/README.md`
2. document that save requires login
3. document that `generate_quiz` now returns `quiz_id`

### Phase 5: Validation

1. login through MCP
2. generate quiz
3. save quiz
4. verify in Firestore
5. verify in frontend "My Quizzes"

---

## 17. Manual Testing Plan

### 17.1 Save Success Flow

1. log into QuizBeat through MCP
2. upload a document
3. generate a quiz
4. note returned `quiz_id`
5. call `save_quiz`
6. open "My Quizzes"

Expected:

- save succeeds
- Firestore document created
- quiz appears in "My Quizzes"

### 17.2 Not Logged In Test

1. ensure MCP is logged out
2. generate quiz
3. call `save_quiz`

Expected:

- clear "not logged in" error
- nothing saved

### 17.3 Invalid Quiz ID Test

1. log in
2. call `save_quiz` with fake `quiz_id`

Expected:

- clear "quiz not found" error

### 17.4 Session Expired Test

1. log in
2. expire or remove session
3. call `save_quiz`

Expected:

- clear session/auth error
- nothing saved

### 17.5 Firestore Visibility Test

1. save quiz through MCP
2. load app frontend
3. open "My Quizzes"

Expected:

- quiz appears under the logged-in account

### 17.6 Schema Compatibility Test

1. save quiz through MCP
2. host the quiz from existing frontend UI

Expected:

- existing frontend host flow can read the saved quiz

---

## 18. Open Questions

These are the main questions other agents should review.

1. Should `save_quiz` accept only `quiz_id`, or also allow raw quiz payload as fallback?
   - Recommendation: use `quiz_id` only for the first implementation

2. Should the backend route be MCP-specific or generic?
   - Recommendation: MCP-specific route first: `POST /api/mcp/quizzes/save`

3. Should duplicate saves be blocked?
   - Recommendation: no duplicate prevention in V1

4. Should generated quiz cache persist across MCP restart?
   - Recommendation: no, in-memory only for V1

---

## 19. Review Checklist For Other Agents

Other agents reviewing this plan should confirm:

- backend owns user identity
- save uses validated MCP session
- backend writes same Firestore shape as existing frontend
- `generate_quiz` returns `quiz_id`
- `save_quiz` uses cached generated quiz
- no frontend refactor is required for first save version

---

## 20. Recommended Decision Summary

Use this if the team wants the short version:

- add a quiz cache to MCP
- update `generate_quiz` to return `quiz_id`
- add backend route `POST /api/mcp/quizzes/save`
- validate MCP session in backend
- derive `creatorId` and `creatorName` from session
- save to existing Firestore collection `quizzes`
- keep frontend unchanged for now

---

## 21. Immediate Next Step

After approval of this plan, the next implementation step should be:

1. add `mcp/quiz_store.py`
2. update `generate_quiz` to cache quizzes and return `quiz_id`
3. then build the backend save route
4. then build the MCP `save_quiz` tool

That is the cleanest order.
