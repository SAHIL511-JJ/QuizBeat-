# Edit Quiz Implementation Plan

## 1) Purpose

This document is a detailed, standalone implementation plan for adding quiz editing support across:

- MCP tool layer
- backend MCP APIs
- frontend user interface

The goal is to let users edit:

- quiz title
- question text
- options
- correct option index

for both newly generated quizzes and already saved quizzes, and then save those changes.

Date of plan: **2026-03-23**

---

## 2) Current Baseline (Already Implemented)

### 2.1 MCP

Current MCP tools (in `mcp/server.py`):

- `login`
- `whoami`
- `logout`
- `upload_document`
- `generate_quiz`
- `save_quiz`

Current behavior:

- `generate_quiz` caches generated quiz data in `mcp/quiz_store.py` via `add_quiz()` and returns `quiz_id`.
- `save_quiz` saves a generated cached quiz via backend route `POST /api/mcp/quizzes/save`.

> [!IMPORTANT]
> `quiz_store.add_quiz()` currently does **NOT** store `title`, `origin`, or `saved_quiz_id`. It only stores: `quiz_id`, `document_id`, `source_filename`, `difficulty`, `num_questions`, `selected_chapters`, `questions`, `created_at`.
>
> `generate_quiz` in `server.py` does **NOT** compute or store a default title. The `_default_quiz_title()` helper is only called during `save_quiz`.

### 2.2 Backend

Current MCP save path:

- router: `backend/app/routers/mcp_quizzes.py`
- persistence service: `backend/app/services/quiz_persistence_service.py`

Current save validation enforces:

- non-empty title
- at least one question
- each question has exactly 4 options (all non-empty strings)
- `correct` is integer `0..3`
- difficulty in `easy|medium|hard`

> [!IMPORTANT]
> `_validate_question()` normalizes each question to exactly `{question, options, correct}` — only these 3 fields survive validation. Any extra fields on question objects are **stripped**.
>
> `QuizPersistenceError` is the only error class (status_code=400, error_code=`INVALID_QUIZ_PAYLOAD`). There are **no** existing not-found or forbidden error subclasses — these must be created for edit operations.

Existing error classes in `mcp_auth_service.py` (for reference pattern):
- `McpAuthError` (base, status_code=400)
- `InvalidSessionError` (status_code=401)
- `SessionExpiredError` (status_code=401)

Current `validate_session()` return shape:
```python
{
    "uid": data.get("user_id"),  # NOTE: maps Firestore field "user_id" → return key "uid"
    "email": ...,
    "display_name": ...,
    "issued_at": ...,
    "expires_at": ...,
}
```

Current Firestore write shape (from `save_quiz_for_user`):

- `title`
- `questions`  (list of `{question, options, correct}`)
- `difficulty`
- `numQuestions`
- `source`
- `textbook`
- `chapters`
- `creatorId`
- `creatorName`
- `createdAt` = Firestore `SERVER_TIMESTAMP`
- `updatedAt` = Firestore `SERVER_TIMESTAMP`

### 2.3 Frontend

Current frontend behavior:

- generated quizzes are created in `GenerateQuiz.jsx`
- save-to-profile uses `saveQuiz` in `frontend/src/services/quizService.js`
- saved quiz listing is in `frontend/src/pages/MyQuizzes.jsx`
- delete exists (`deleteQuiz`)
- an inline editor UI already exists in `frontend/src/pages/HostGame.jsx` (question text editing, option editing, correct answer toggle, add/remove questions) — this is embedded within the host-game flow, not extracted as a reusable component

> [!IMPORTANT]
> `quizService.js` currently imports: `collection`, `doc`, `addDoc`, `getDoc`, `getDocs`, `deleteDoc`, `query`, `where`, `serverTimestamp` from `firebase/firestore`. It does **NOT** import `updateDoc` — this must be added for edit functionality.

Important compatibility points:

- `saveQuiz` uses `addDoc` (creates new document). Edit flow must use `updateDoc` (modifies existing).
- existing list sort depends on `createdAt?.toMillis?.()` and display uses `createdAt?.toDate?.()` — update flows must preserve Firestore Timestamp compatibility (use `serverTimestamp()` for `updatedAt`).

Current frontend component directories: `Auth/`, `ChatBot/`, `UI/`. There is **no** `Quiz/` directory — it must be created for the new `QuizEditor.jsx` component.

---

## 3) Problem Statement

We can generate and save quizzes, but there is no complete edit flow that works end-to-end for:

- generated (unsaved) quizzes
- saved quizzes

We need:

1. an MCP `edit_quiz` capability that can edit generated or saved quizzes.
2. frontend edit functionality so users can edit and save quizzes from the web app.
3. robust validation and ownership rules so edits are safe and consistent.

---

## 4) Scope

### 4.1 In Scope

- add MCP edit tool (`edit_quiz`)
- allow editing generated cached quiz metadata + questions
- allow editing saved quizzes via backend MCP update route
- add frontend UI for editing generated quiz before first save
- add frontend UI for editing saved quiz and persisting changes
- preserve Firestore schema and timestamp behavior

### 4.2 Out of Scope (This Phase)

- collaborative editing
- edit history / revisioning / rollback UI
- autosave drafts
- batch edit across multiple quizzes
- migration of all frontend writes to backend-only pattern

---

## 5) User Stories

1. As a user, after generating a quiz, I want to rename it and correct questions/options before saving.
2. As a user, I want to edit a previously saved quiz from My Quizzes and save updates.
3. As an MCP user, I want to edit generated quiz content via `quiz_id`.
4. As an MCP user, I want to edit a saved quiz by saved quiz ID and persist changes safely.
5. As a system owner, I need strict validation and ownership checks for all persisted edits.

---

## 6) Core Design Decisions

### 6.1 One Canonical Quiz Shape

Use one canonical edit shape in MCP and frontend:

- `title`
- `questions`
- `difficulty`
- `source`
- `textbook`
- `chapters`

This avoids conversion bugs between generated and saved flows.

### 6.2 MCP Supports Two Targets

`edit_quiz` should support:

- **cached generated target** via `quiz_id`
- **saved target** via `saved_quiz_id` (Firestore document id)

Behavior:

- generated edits update MCP memory only
- saved edits update backend-persisted quiz (plus update MCP cache copy if present)
- if only `quiz_id` is provided and the cached quiz has a linked `saved_quiz_id`, treat it as a generated-only edit unless `persist_saved_quiz` is explicitly `true`

### 6.3 Persisted Edit Authority Stays in Backend

For saved quizzes edited via MCP:

- backend validates session token each request
- backend derives acting user from session
- backend enforces ownership (`creatorId` match)
- backend applies strict payload validation

### 6.4 Frontend Keeps Existing Firestore Pattern

Frontend currently performs save/delete directly against Firestore.  
For this phase, frontend edit follows same pattern with `updateDoc`, minimizing refactor risk.

The `saveQuiz` function uses `addDoc` (creates new). The new `updateQuiz` function must use `updateDoc` (updates existing).

### 6.5 Strict Validation Before Persist

No silent fixes for invalid input.  
Every persist operation validates:

- non-empty title
- valid difficulty
- question list non-empty
- each question has exactly 4 non-empty options
- correct index in range `0..3`

---

## 7) Functional Requirements

### 7.1 Edit Coverage

Must support all of:

- update quiz title
- update difficulty
- update source/textbook/chapters
- update question text
- update one or more options
- update correct index
- add questions
- remove questions (must leave >= 1 question)

### 7.2 Generated Quiz Edit Rules

- edits are stored in MCP quiz cache
- generated quiz can be saved after edits using existing `save_quiz`
- default title should be editable and persisted during save

### 7.3 Saved Quiz Edit Rules

- edits persist immediately when requested
- `updatedAt` must be set to Firestore `SERVER_TIMESTAMP`
- `createdAt` must remain unchanged
- `numQuestions` must always be recalculated from current questions

### 7.4 Access Control

- only quiz owner can read/update saved quiz via MCP route
- frontend edit route should be protected and should only show user-owned quizzes

---

## 8) MCP Tool Contract (`edit_quiz`)

### 8.1 Proposed Input

```json
{
  "quiz_id": "quiz_ab12cd34",
  "saved_quiz_id": null,
  "title": "Java Concurrency Quiz - Revised",
  "difficulty": "hard",
  "source": "ai",
  "textbook": "java_programming.txt",
  "chapters": ["Threading", "Locks"],
  "question_updates": [
    {
      "index": 0,
      "question": "Which lock is re-entrant in Java?",
      "options": ["Semaphore", "ReentrantLock", "CountDownLatch", "Phaser"],
      "correct": 1
    },
    {
      "index": 3,
      "option_updates": [
        { "option_index": 2, "value": "volatile only ensures visibility" }
      ],
      "correct": 0
    }
  ],
  "add_questions": [
    {
      "question": "What does synchronized guarantee?",
      "options": ["Atomicity", "Visibility and mutual exclusion", "Ordering only", "None"],
      "correct": 1
    }
  ],
  "remove_question_indexes": [8],
  "persist_saved_quiz": true
}
```

Notes:

- At least one target is required: `quiz_id` or `saved_quiz_id`.
- If both are provided, `quiz_id` resolves the cached object; saved persistence uses linked `saved_quiz_id`.
- `persist_saved_quiz` should default to `true` for saved target operations.
- If only `quiz_id` is given and the cached quiz has a linked `saved_quiz_id`, edits only update the cache unless `persist_saved_quiz` is explicitly `true`.

### 8.2 Proposed Success Response

```json
{
  "status": "success",
  "quiz_id": "quiz_ab12cd34",
  "saved_quiz_id": "firestore_doc_id_or_null",
  "persisted": true,
  "title": "Java Concurrency Quiz - Revised",
  "difficulty": "hard",
  "num_questions": 10,
  "updated_fields": ["title", "difficulty", "question_updates", "add_questions", "remove_question_indexes"]
}
```

### 8.3 Proposed Error Codes

- `NOT_LOGGED_IN`
- `SESSION_EXPIRED`
- `QUIZ_NOT_FOUND`
- `SAVED_QUIZ_NOT_FOUND`
- `FORBIDDEN`
- `INVALID_EDIT_REQUEST`
- `INVALID_QUIZ_PAYLOAD`
- `BACKEND_ERROR`

---

## 9) MCP Quiz Store Design Changes

File: `mcp/quiz_store.py`

### 9.1 Store Model Extension

> [!IMPORTANT]
> Currently `add_quiz()` accepts only: `document_id`, `source_filename`, `difficulty`, `num_questions`, `selected_chapters`, `questions`. It does NOT accept `title`, `origin`, or `saved_quiz_id`.

Extend `add_quiz()` signature to also accept:

- `title` (string, default = `""`)

Extend cached quiz data dict to include:

- `title`
- `origin` (`"generated"` or `"saved"`)
- `saved_quiz_id` (optional, default = `None`)
- `source` (default = `"ai"`)
- `textbook` (alias of existing `source_filename`)
- `updated_at` (ISO string for MCP internal traceability)

### 9.2 New Helper Functions

Add these functions:

- `update_quiz_metadata(quiz_id, updates)` — update title, difficulty, source, textbook, chapters, selected_chapters
- `apply_question_updates(quiz_id, question_updates)` — modify existing questions by index
- `add_questions(quiz_id, questions)` — append new questions to the list
- `remove_questions(quiz_id, indexes)` — remove questions at given indexes (validate >= 1 remains)
- `link_saved_quiz_id(quiz_id, saved_quiz_id)` — set `saved_quiz_id` and `origin = "saved"` on cached quiz
- `upsert_saved_quiz_cache(saved_quiz_payload)` — load a backend-saved quiz into MCP cache, returning a `quiz_id`

All helpers should:
- validate that `quiz_id` exists in `_quizzes` (raise `KeyError` or return `None`)
- validate indexes are in range
- update `updated_at` timestamp
- update `num_questions` when question list changes

---

## 10) Backend API and Service Changes

### 10.1 Router Changes

File: `backend/app/routers/mcp_quizzes.py`

Add endpoints:

- `GET /api/mcp/quizzes/{quiz_id}` — fetch a saved quiz for the authenticated user
- `PATCH /api/mcp/quizzes/{quiz_id}` — update a saved quiz for the authenticated user

Both must:

- use existing `_extract_bearer_token` dependency (already implemented in the file)
- call `validate_session(session_token, update_last_used=True)` from `mcp_auth_service`
- pass the resulting `user` dict to the service layer

Add Pydantic models:

```python
class UpdateQuizRequest(BaseModel):
    title: str | None = None
    questions: list[SaveQuizQuestion] | None = None
    difficulty: str | None = None
    source: str | None = None
    textbook: str | None = None
    chapters: list[str] | None = None
```

Error handling should follow the exact same pattern as existing `save_mcp_quiz`:
- catch `FirebaseAdminConfigError` (503)
- catch `McpAuthError` (exc.status_code)
- catch `QuizPersistenceError` (exc.status_code)  ← note: must support variable status_code now
- catch `RuntimeError` (500)

### 10.2 Service Changes

File: `backend/app/services/quiz_persistence_service.py`

**Add new error subclasses** (required — they do not exist yet):

```python
class QuizNotFoundError(QuizPersistenceError):
    status_code = 404
    error_code = "QUIZ_NOT_FOUND"

class QuizForbiddenError(QuizPersistenceError):
    status_code = 403
    error_code = "QUIZ_FORBIDDEN"
```

**Add functions:**

- `get_quiz_for_user(user, quiz_id)`:
  ```python
  db = get_firestore_client()
  doc_ref = db.collection(QUIZZES_COLLECTION).document(quiz_id)
  doc = doc_ref.get()
  if not doc.exists:
      raise QuizNotFoundError(f"Quiz '{quiz_id}' not found.")
  data = doc.to_dict()
  if data.get("creatorId") != user["uid"]:
      raise QuizForbiddenError("You can only view your own quizzes.")
  return {"id": doc.id, **data}
  ```

- `update_quiz_for_user(user, quiz_id, payload)`:
  1. fetch document from `quizzes` collection using `db.collection(QUIZZES_COLLECTION).document(quiz_id).get()`
  2. return `QuizNotFoundError` if missing
  3. verify `creatorId == user["uid"]` — raise `QuizForbiddenError` if mismatch
  4. merge updates over existing quiz data
  5. validate resulting full quiz structure using existing `_validate_payload`
  6. build update dict with only mutable fields + `updatedAt`
  7. use `doc_ref.update(update_dict)` to persist

> [!IMPORTANT]
> Use `user["uid"]` for ownership check — this matches `validate_session()` return shape.
> Use `doc_ref.update()` (not `doc_ref.set()`) to preserve immutable fields.

### 10.3 Validation Reuse

Refactor to avoid duplicate create/edit validators:

- Keep the existing `_validate_payload` and `_validate_question` functions.
- For updates, merge the incoming partial payload with existing document data, then run the full `_validate_payload` on the merged result.
- This avoids needing mode flags and keeps validation simple.

### 10.4 Firestore Update Rules

On patch:

- update only mutable fields (`title`, `questions`, `difficulty`, `source`, `textbook`, `chapters`, `numQuestions`)
- always set `updatedAt = SERVER_TIMESTAMP` (use `admin_firestore.SERVER_TIMESTAMP`)
- never overwrite `createdAt`, `creatorId`, `creatorName`

---

## 11) MCP Backend Client Changes

File: `mcp/backend_client.py`

Add HTTP helpers:

- `get_saved_quiz(session_token, saved_quiz_id)`:
  ```python
  async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
      response = await client.get(
          f"{BACKEND_URL}/api/mcp/quizzes/{saved_quiz_id}",
          headers={"Authorization": f"Bearer {session_token}"},
      )
  return _parse_json_response(response, "quiz fetch")
  ```

- `update_saved_quiz(session_token, saved_quiz_id, payload)`:
  ```python
  async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
      response = await client.patch(
          f"{BACKEND_URL}/api/mcp/quizzes/{saved_quiz_id}",
          json=payload,
          headers={"Authorization": f"Bearer {session_token}"},
      )
  return _parse_json_response(response, "quiz update")
  ```

Both use existing `_parse_json_response` helper (already in the file) so errors remain uniform with `save_quiz`. Both should include the same `httpx.ConnectError` handling pattern as existing functions.

---

## 12) MCP Server Changes

File: `mcp/server.py`

### 12.1 `generate_quiz` Output/Cache — REQUIRED CHANGE

> [!IMPORTANT]
> Currently `generate_quiz` does NOT compute or store a title. The `_default_quiz_title()` helper exists but is only called in `save_quiz`.

Modify `generate_quiz` to:
1. Compute a default title using `_default_quiz_title(doc["filename"], difficulty)` after generation
2. Pass `title=default_title` to `quiz_store.add_quiz()` (requires the signature change from Section 9.1)
3. Include `title` in the response JSON
4. Also ensure `source`, `textbook` (= `source_filename`), and `selected_chapters` are stored as named in the canonical shape

### 12.2 New `edit_quiz` Tool

Register with `@mcp.tool()` decorator, following the pattern of existing tools.

Responsibilities:

1. validate target (`quiz_id` or `saved_quiz_id`) — at least one must be provided
2. validate session (via `auth_store.load_session()` + `auth_store.is_session_expired()`) when saved quiz persistence is involved
3. load target quiz:
   - if `quiz_id`: load from `quiz_store.get_quiz(quiz_id)`
   - if `saved_quiz_id` (and no `quiz_id` or cached copy): fetch from backend via `backend_client.get_saved_quiz()`, then cache with `quiz_store.upsert_saved_quiz_cache()`
4. apply metadata edits via `quiz_store.update_quiz_metadata()`
5. apply question edits via `quiz_store.apply_question_updates()`, `quiz_store.add_questions()`, `quiz_store.remove_questions()`
6. run final shape validation (non-empty title, valid questions, etc.)
7. persist saved quizzes through `backend_client.update_saved_quiz()` when applicable
8. link saved quiz id via `quiz_store.link_saved_quiz_id()` if newly saved
9. return updated summary using `_success()` helper

Error handling should follow the exact pattern of `save_quiz`:
- check `auth_store.load_session()` is not None → `NOT_LOGGED_IN`
- check `auth_store.is_session_expired()` → `SESSION_EXPIRED`
- check quiz exists → `QUIZ_NOT_FOUND`
- catch `ConnectionError`, `RuntimeError`, `Exception` from backend calls

### 12.3 `save_quiz` Compatibility

After edit implementation:
- `save_quiz` should pick up the `title` from the cached quiz (which may have been edited) instead of always falling through to `_default_quiz_title`
- Current code: `normalized_title = (title or "").strip() or _default_quiz_title(...)` — the cached quiz title should be used as fallback before `_default_quiz_title`

Proposed change to `save_quiz`:
```python
normalized_title = (title or "").strip() or quiz.get("title", "").strip() or _default_quiz_title(...)
```

---

## 13) Frontend Architecture Plan

### 13.1 Service Layer

File: `frontend/src/services/quizService.js`

> [!IMPORTANT]
> Must add `updateDoc` to the existing import from `firebase/firestore`:
> ```javascript
> import {
>     collection, doc, addDoc, getDoc, getDocs, deleteDoc, updateDoc,
>     query, where, serverTimestamp
> } from 'firebase/firestore';
> ```

Add function:

```javascript
export async function updateQuiz(quizId, updates) {
    const docRef = doc(db, QUIZZES_COLLECTION, quizId);
    await updateDoc(docRef, {
        ...updates,
        numQuestions: updates.questions ? updates.questions.length : undefined,
        updatedAt: serverTimestamp(),
    });
}
```

Notes:
- Use `updateDoc` (not `setDoc`) to preserve fields not being edited
- Recalculate `numQuestions` only when `questions` array is provided
- Always set `updatedAt` to `serverTimestamp()`
- Never include `createdAt`, `creatorId`, `creatorName` in the update payload

### 13.2 Reusable Quiz Editor UI

> [!IMPORTANT]
> The `frontend/src/components/Quiz/` directory does NOT exist. Create it.

New component: `frontend/src/components/Quiz/QuizEditor.jsx`

Features:

- title input
- editable question cards (text area for question, text inputs for options)
- correct answer toggle (click option number to set as correct)
- add question button
- remove question button (disabled when only 1 question remains)
- local validation error display

Reference implementation: **`HostGame.jsx` lines 99-147** (question editing logic) and **lines 362-422** (editor JSX). Extract and generalize this pattern.

Props contract:
```jsx
<QuizEditor
  title={title}                    // string
  onTitleChange={setTitle}         // (newTitle) => void
  questions={questions}            // array of {question, options, correct}
  onQuestionsChange={setQuestions} // (newQuestions) => void
  error={error}                    // string | null
  onError={setError}               // (errorMsg) => void
/>
```

Reuse in:
- `GenerateQuiz.jsx` — for editing generated quiz before save
- `EditQuiz.jsx` — for editing saved quiz
- optionally `HostGame.jsx` later (to reduce its inline editor code)

### 13.3 Generated Quiz Editing in `GenerateQuiz.jsx`

Current generated flow should gain:

- explicit "Edit Quiz" button in the `quiz-actions-row` (alongside "Take Quiz Now" and "Save to Profile")
- when clicked, show `QuizEditor` component with generated data preloaded (title, questions)
- "Save to Profile" persists the edited data (uses existing `saveQuiz` function)
- state: add `isEditing` boolean state, `editableTitle`/`editableQuestions` state

### 13.4 Saved Quiz Editing from `MyQuizzes.jsx`

Add edit action button to quiz cards (alongside Host, Share, Delete):
- import `Edit3` (or `Pencil`) icon from `lucide-react`
- navigate to `/my-quizzes/:quizId/edit`

New page: `frontend/src/pages/EditQuiz.jsx`

Behavior:

1. extract `quizId` from URL params using `useParams()`
2. load quiz by id using existing `getQuizById(quizId)` from `quizService.js`
3. verify the loaded quiz's `creatorId` matches `user.uid`
4. render `QuizEditor` component with loaded data
5. save changes with new `updateQuiz(quizId, updatedFields)` function
6. navigate back to `/my-quizzes` with success feedback (toast/alert)

### 13.5 Routing

File: `frontend/src/App.jsx`

Add protected route after the existing `/my-quizzes` route:

```jsx
import EditQuiz from './pages/EditQuiz';

// Inside <Routes>:
<Route path="/my-quizzes/:quizId/edit" element={
  <ProtectedRoute>
    <EditQuiz />
  </ProtectedRoute>
} />
```

---

## 14) Detailed File-Level Change List

### MCP

| File | Action | Changes |
|------|--------|---------|
| `mcp/quiz_store.py` | MODIFY | Extend `add_quiz()` to accept `title`; add `origin`, `saved_quiz_id`, `source`, `textbook`, `updated_at` fields; add 6 new helper functions |
| `mcp/backend_client.py` | MODIFY | Add `get_saved_quiz()` and `update_saved_quiz()` using GET/PATCH with `_parse_json_response` reuse |
| `mcp/server.py` | MODIFY | Add `@mcp.tool() edit_quiz`; modify `generate_quiz` to compute/store default title; modify `save_quiz` to use cached title as fallback |
| `mcp/README.md` | MODIFY | Add `edit_quiz` tool docs and examples |

### Backend

| File | Action | Changes |
|------|--------|---------|
| `backend/app/services/quiz_persistence_service.py` | MODIFY | Add `QuizNotFoundError`, `QuizForbiddenError` subclasses; add `get_quiz_for_user()`, `update_quiz_for_user()` |
| `backend/app/routers/mcp_quizzes.py` | MODIFY | Add `UpdateQuizRequest` model; add `GET /api/mcp/quizzes/{quiz_id}`, `PATCH /api/mcp/quizzes/{quiz_id}` endpoints |

### Frontend

| File | Action | Changes |
|------|--------|---------|
| `frontend/src/services/quizService.js` | MODIFY | Add `updateDoc` import; add `updateQuiz()` function |
| `frontend/src/components/Quiz/QuizEditor.jsx` | **NEW** | Reusable quiz editor component (title, questions, options, correct toggle, add/remove) |
| `frontend/src/pages/GenerateQuiz.jsx` | MODIFY | Add "Edit Quiz" button; integrate `QuizEditor`; add editing state |
| `frontend/src/pages/MyQuizzes.jsx` | MODIFY | Add edit button with `Edit3` icon; navigate to `/my-quizzes/:quizId/edit` |
| `frontend/src/pages/EditQuiz.jsx` | **NEW** | Page to load, edit, and save an existing quiz |
| `frontend/src/App.jsx` | MODIFY | Import `EditQuiz`; add protected route `/my-quizzes/:quizId/edit` |
| `frontend/src/index.css` | MODIFY | Add minimal editor styles if not already covered by existing `.quiz-editor` styles from HostGame |

---

## 15) Execution Order (Recommended)

1. **Backend persistence service**: add `QuizNotFoundError`, `QuizForbiddenError`, `get_quiz_for_user`, `update_quiz_for_user` with shared validation via existing `_validate_payload`.
2. **Backend router**: add `UpdateQuizRequest` model, `GET` and `PATCH` endpoints with same error handling pattern as `save_mcp_quiz`.
3. **MCP backend client**: add `get_saved_quiz`, `update_saved_quiz` helpers using existing `_parse_json_response`.
4. **MCP quiz store**: extend `add_quiz` signature, add new fields, add 6 helper functions.
5. **MCP server**: modify `generate_quiz` to compute/store title, implement `edit_quiz` tool, modify `save_quiz` title fallback.
6. **Frontend service**: add `updateDoc` import, add `updateQuiz` function.
7. **Frontend `QuizEditor` component**: create `components/Quiz/` directory, build reusable editor (reference `HostGame.jsx` inline logic).
8. **Frontend generated edit flow**: wire `QuizEditor` into `GenerateQuiz.jsx`.
9. **Frontend saved edit flow**: create `EditQuiz.jsx`, add edit button to `MyQuizzes.jsx`, add route to `App.jsx`.
10. **Docs, styles, and end-to-end validation**.

---

## 16) Validation and Testing Plan

### 16.1 MCP / Backend Manual Tests

1. login via MCP.
2. upload + generate quiz.
3. call `edit_quiz` to change title/question/option/correct.
4. call `save_quiz`; verify Firestore document stores edited data.
5. call `edit_quiz` on saved quiz (`saved_quiz_id`) and persist.
6. verify `updatedAt` changed and `createdAt` unchanged.

Error cases:

- invalid question index
- removing all questions
- options not length 4
- correct index outside 0..3
- not logged in
- expired session
- editing another user's quiz (should get `QUIZ_FORBIDDEN` / 403)

### 16.2 Frontend Manual Tests

1. Generate quiz → Edit → Save to profile → verify My Quizzes reflects edits.
2. My Quizzes → Edit saved quiz → Save changes → reload page → verify persistence.
3. Host/share/take quiz flows still work with edited quiz data.
4. Sorting by created date remains stable.

### 16.3 Build/Lint Checks

Run existing commands:

- `cd frontend && npm run lint`
- `cd frontend && npm run build`

If backend/mcp test suites are absent, at minimum run syntax verification for changed Python modules:

```bash
python -m py_compile mcp/quiz_store.py
python -m py_compile mcp/backend_client.py
python -m py_compile mcp/server.py
python -c "from app.services.quiz_persistence_service import *"
python -c "from app.routers.mcp_quizzes import *"
```

---

## 17) Security and Data Integrity Rules

1. Never trust `creatorId`/`creatorName` from MCP input for persisted edits.
2. Persisted saved quiz edits must always be authorized from validated MCP session.
3. Do not allow mutable edits to ownership fields.
4. Surface explicit validation errors; no silent fallback behavior.
5. Keep question schema strict (`{question, options, correct}` only) to prevent corrupted quiz payloads.

---

## 18) Risks and Mitigations

### Risk: Validation logic drift (save vs edit)

Mitigation:

- centralize validation in shared `_validate_payload` / `_validate_question` helpers (already exist) — use for both save and update paths by merging partial update into existing doc before validating.

### Risk: UI duplication of editor logic

Mitigation:

- extract reusable `QuizEditor` component instead of duplicating card logic from `HostGame.jsx`.

### Risk: inconsistent timestamp behavior

Mitigation:

- always use Firestore `serverTimestamp()`/`SERVER_TIMESTAMP` for `updatedAt`.
- never include `createdAt` in update payloads.

### Risk: stale in-memory MCP cache after saved edit

Mitigation:

- update local cache with backend update result after successful persistence.

### Risk: `_validate_question` strips fields

Mitigation:

- understand that `_validate_question` normalizes to `{question, options, correct}` only. Any additional fields on question objects will be lost after validation. This is the intended behavior — keep questions minimal.

---

## 19) Documentation Updates Needed

File: `mcp/README.md`

Add:

- `edit_quiz` tool docs
- examples for generated and saved quiz edits
- constraints and validation behavior
- note on cache lifespan and saved persistence behavior

Optional:

- update root `README.md` short feature list to mention quiz editing.

---

## 20) Agent Review Checklist

Other agents implementing this plan should verify:

- [ ] All file paths match actual codebase structure
- [ ] `quiz_store.add_quiz()` signature is extended before `server.py` changes
- [ ] `QuizNotFoundError` and `QuizForbiddenError` are created before router uses them
- [ ] `updateDoc` is imported in `quizService.js` before `updateQuiz` uses it
- [ ] `components/Quiz/` directory is created before `QuizEditor.jsx`
- [ ] `EditQuiz.jsx` is imported in `App.jsx` before the route references it
- [ ] question schema remains `{question, options, correct}` — no extra fields
- [ ] timestamps and Firestore field compatibility are preserved
- [ ] implementation follows the execution order in Section 15

---

## 21) Immediate Next Step

Start implementation with backend persistence service (step 1: error subclasses + read/update functions), then backend router (step 2), following the order in Section 15.
