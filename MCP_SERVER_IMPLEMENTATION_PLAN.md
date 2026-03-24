# QuizBeat MCP Server Plan

## 1. Document Purpose

This document is a standalone handoff for any engineer or agent who needs to build the QuizBeat MCP server without prior conversation context.

It covers:

- what the project is
- what decisions have already been made
- what the MCP server should and should not do
- the exact scope of the first prototype
- the recommended folder structure and tech stack
- how the first version should work in AntiGravity IDE
- the roadmap for later features like save quiz and host quiz

This plan reflects decisions discussed up to **2026-03-18**.

---

## 2. Project Summary

QuizBeat is a quiz platform with:

- a **Python FastAPI backend** in `backend/`
- a **React + Vite frontend** in `frontend/`
- **Firebase** for auth, Firestore, and Realtime Database

Main user features already present in the app:

- upload PDF, DOCX, or TXT documents
- parse document text and detect chapters
- generate quizzes from text using Groq
- save quizzes to Firestore from the frontend
- host multiplayer quiz games using Firebase Realtime Database

Relevant existing files:

- `backend/app/main.py`
- `backend/app/routers/documents.py`
- `backend/app/routers/quiz.py`
- `backend/app/services/groq_service.py`
- `frontend/src/pages/UploadTextbook.jsx`
- `frontend/src/pages/GenerateQuiz.jsx`
- `frontend/src/services/quizService.js`
- `frontend/src/contexts/GameContext.jsx`

---

## 3. Goal Of The MCP Server

The MCP server should let an IDE or CLI automate project actions through clear MCP tools instead of browser clicking.

The long-term idea is:

- ask the IDE to upload a document
- generate a quiz
- save the quiz
- inspect the generated questions
- later host a quiz and operate the host flow

The MCP server should act as a **project action layer** between the IDE and the app/backend.

High-level flow:

`IDE or CLI -> MCP server -> QuizBeat backend and Firebase -> result back to IDE`

---

## 4. Decisions Already Made

These decisions are already agreed and should be treated as fixed unless explicitly changed later.

### 4.1 No Playwright

Playwright will **not** be used.

Reason:

- browser automation is less reliable
- direct backend and Firebase actions are cleaner
- direct state changes are more accurate than UI clicking

### 4.2 Separate Actions Only

The MCP server should expose **separate tools/actions**, not one large combined action.

Examples of correct design:

- `upload_pdf`
- `generate_quiz`
- later `save_quiz`
- later `host_quiz`

Examples of incorrect design:

- `create_and_save_quiz_from_pdf`
- `do_everything`

Reason:

- the user may want only one step
- tools stay easier to reason about
- testing is simpler
- failures are easier to isolate

### 4.3 First Prototype Should Be Small

The first implementation should only do:

1. upload a PDF
2. use the uploaded result to generate a quiz
3. return the generated quiz questions to the IDE

This is the first milestone.

### 4.4 Do Not Fix Frontend localStorage First

For the first prototype, the MCP flow should **not depend on browser localStorage**.

We are not doing a full browser-to-server refactor before the prototype.

Instead:

- frontend can keep its current localStorage behavior for now
- MCP will use backend APIs directly
- MCP will keep temporary uploaded document data in MCP process memory during the active session

### 4.5 Firebase Admin Comes Later

Direct Firebase Admin access is the preferred approach for later features like:

- save quiz
- list quizzes
- host quiz
- move to next question
- end game

But Firebase Admin is **not required** for the first prototype.

### 4.6 Use AntiGravity IDE As The First Host

The first MCP integration target is **AntiGravity IDE** using the local MCP server configuration screen and raw MCP config.

### 4.7 Local First, Publish Later

The MCP server should be built and tested locally first.

Later it can be:

- shared as a repo
- packaged
- published for others to use
- optionally registered publicly

---

## 5. Current Codebase Reality

This section explains what already exists and where the current limitations are.

### 5.1 Existing Backend APIs

The backend already exposes the two APIs needed for the first prototype.

#### Upload API

File: `backend/app/routers/documents.py`

Endpoint:

- `POST /api/upload`

Current behavior:

- accepts uploaded file
- supports PDF, DOCX, TXT
- extracts text
- detects chapters
- returns filename, total chars, chapters, and a shortened text preview

Important note:

- the backend computes the full extracted text internally
- the current response includes `full_text`, but only as a shortened preview
- for MCP quiz generation, we need access to the full extracted chapter content from the API response

#### Quiz Generation API

File: `backend/app/routers/quiz.py`

Endpoint:

- `POST /api/quiz/generate`

Current behavior:

- accepts `content`, `difficulty`, and `num_questions`
- calls Groq-backed service
- returns generated questions

This is already suitable for MCP use.

### 5.2 Existing Frontend Behavior

The frontend currently stores some useful state only in the browser.

#### Uploaded Textbooks

File: `frontend/src/pages/UploadTextbook.jsx`

Current behavior:

- calls `/api/upload`
- stores processed textbook info in browser `localStorage`

#### Generated Quiz Flow

File: `frontend/src/pages/GenerateQuiz.jsx`

Current behavior:

- reads textbooks from `localStorage`
- builds content from chosen chapters
- calls `/api/quiz/generate`
- shows quiz results

#### Saved Quiz Flow

File: `frontend/src/services/quizService.js`

Current behavior:

- saves quizzes to Firestore from the frontend

#### Host Flow

File: `frontend/src/contexts/GameContext.jsx`

Current behavior:

- creates and manages games in Firebase Realtime Database

### 5.3 Why MCP Cannot Reuse Frontend Logic Directly

MCP runs outside the browser.

So it cannot rely on:

- browser `localStorage`
- React component state
- button clicks
- frontend-only Firebase SDK flows

For MCP, actions must happen through:

- backend HTTP APIs
- Firebase Admin
- or other direct server-side integrations

---

## 6. First Version Scope

This section defines the exact scope of the first implementation.

### 6.1 In Scope For V1 Prototype

- local MCP server written in Python
- MCP connection through `stdio`
- AntiGravity IDE integration
- tool to upload a PDF to the backend
- tool to generate a quiz from an uploaded PDF result
- temporary in-memory document state inside the MCP server
- clean text/JSON tool responses back to the IDE
- basic validation and error handling

### 6.2 Out Of Scope For V1 Prototype

- saving quizzes to Firestore
- listing saved quizzes
- hosting quizzes
- Firebase Admin integration
- browser automation
- full document persistence
- replacing frontend localStorage
- multi-user access control
- remote hosted MCP transport
- publishing to a registry

### 6.3 Why The Scope Is This Small

The goal of V1 is to prove the MCP pattern works for this project with the least amount of new surface area.

If V1 succeeds, it proves:

- AntiGravity can call project-specific tools
- the MCP server can talk to the backend correctly
- upload and quiz generation can be done without browser involvement
- the returned results are useful enough for the developer workflow

---

## 7. Recommended Tech Stack

The MCP server should use the following stack.

### 7.1 Language

- Python

Reason:

- matches the backend language
- easier to reuse backend data shapes and logic
- good fit for local tool servers

### 7.2 MCP SDK

- official MCP Python SDK using `FastMCP`

Recommended reference:

- https://py.sdk.modelcontextprotocol.io/

Key point:

- the SDK supports MCP servers with tools and standard transports
- for local development, `stdio` is the correct transport

### 7.3 HTTP Client

- `httpx`

Reason:

- easy async HTTP calls to the existing FastAPI backend

### 7.4 Config

- environment variables
- optional `.env` file for local development

At minimum:

- `BACKEND_URL=http://localhost:8000`

### 7.5 Transport

- `stdio`

Reason:

- official local transport for MCP
- good fit for IDE-launched local servers

Reference:

- local MCP servers commonly run over stdio in official MCP docs

### 7.6 Suggested Initial Dependencies

Suggested package list for the MCP folder:

- `mcp`
- `httpx`
- `python-dotenv`
- `pydantic`

Optional:

- `uv` for easier local running

---

## 8. High-Level Architecture For V1

### 8.1 Components

There will be three main parts involved.

#### Part A: AntiGravity IDE

Acts as the MCP host.

Responsibilities:

- starts the local MCP server
- exposes MCP tools to the user/agent
- sends tool calls
- receives results

#### Part B: QuizBeat MCP Server

New component to add.

Responsibilities:

- define MCP tools
- validate tool input
- call backend APIs
- keep temporary uploaded document state in memory
- format results for the IDE

#### Part C: QuizBeat Backend

Already exists.

Responsibilities:

- parse uploaded PDF
- generate quiz questions

### 8.2 Data Flow

#### Upload Flow

1. user asks the IDE to upload a PDF
2. AntiGravity calls `upload_pdf`
3. MCP reads the file path and sends multipart upload to `/api/upload`
4. backend extracts text and chapters
5. backend returns parsed result
6. MCP stores the uploaded document result in session memory
7. MCP returns a document summary and a `document_id`

#### Generate Flow

1. user asks the IDE to generate a quiz
2. AntiGravity calls `generate_quiz`
3. MCP loads the uploaded document from session memory using `document_id`
4. MCP chooses full text or selected chapter text
5. MCP sends content to `/api/quiz/generate`
6. backend generates questions
7. MCP returns quiz results to the IDE

---

## 9. Why Session Memory Is Enough For V1

We need some place to hold uploaded document data between the `upload_pdf` and `generate_quiz` tools.

For V1, the simplest option is in-memory storage inside the MCP process.

Example:

- `upload_pdf` stores a parsed result under `document_id`
- `generate_quiz` uses that `document_id`

This is acceptable for the prototype because:

- it is simple
- no database changes are needed
- no Firebase is needed
- the data only needs to survive while the MCP server process is alive

Known limitation:

- if the MCP process restarts, uploaded document memory is lost

This is acceptable for V1.

---

## 10. Required Backend Adjustment For V1

There is one likely backend gap to address.

### 10.1 Problem

The current upload response in `backend/app/routers/documents.py` returns:

- filename
- total chars
- chapters
- `full_text`

But `full_text` is currently shortened to a preview:

- only the first 1000 characters plus `...` for long content

For quiz generation, the MCP server needs the **real chapter content**, not only a preview.

### 10.2 Required Change

The upload API response should return enough full parsed content for MCP to later generate a quiz.

Recommended approach:

- keep `chapters` with full `title` and full `content`
- either remove the shortened `full_text` field from MCP use
- or add a separate explicit `text` field with full extracted text

Preferred backend response shape:

```json
{
  "filename": "sample.pdf",
  "total_chars": 12345,
  "text": "full extracted text",
  "chapters": [
    {
      "title": "Chapter 1",
      "content": "full chapter text"
    }
  ]
}
```

Important:

- this response can still be used by the frontend later
- the frontend can decide whether to display full text or only a preview
- but the backend response must preserve full content for MCP

---

## 11. Exact V1 MCP Tools

The first prototype should expose exactly two tools.

### 11.1 Tool: `upload_pdf`

#### Purpose

Upload a local PDF file to the existing backend and store the parsed result in MCP session memory.

#### Input

```json
{
  "file_path": "C:\\path\\to\\file.pdf"
}
```

#### Validation

- file path must exist
- file must be a file, not a directory
- extension must be `.pdf`
- backend URL must be configured

#### Internal Steps

1. validate file path
2. open file in binary mode
3. send multipart request to `POST /api/upload`
4. verify response shape
5. generate a unique `document_id`
6. store parsed result in memory
7. return a summary to the IDE

#### Session Memory Stored

Example structure:

```json
{
  "document_id": "doc_20260318_001",
  "filename": "biology.pdf",
  "text": "full extracted text",
  "chapters": [
    {
      "title": "Chapter 1",
      "content": "..."
    }
  ],
  "total_chars": 23000,
  "uploaded_at": "2026-03-18T12:00:00Z"
}
```

#### Output

```json
{
  "document_id": "doc_20260318_001",
  "filename": "biology.pdf",
  "total_chars": 23000,
  "chapter_count": 6,
  "chapter_titles": [
    "Chapter 1",
    "Chapter 2"
  ]
}
```

#### Errors To Handle

- file not found
- invalid extension
- backend not reachable
- backend returns non-200 response
- backend response missing required fields

### 11.2 Tool: `generate_quiz`

#### Purpose

Generate a quiz using a previously uploaded document stored in session memory.

#### Input

```json
{
  "document_id": "doc_20260318_001",
  "difficulty": "medium",
  "num_questions": 10,
  "chapter_titles": [
    "Chapter 1",
    "Chapter 2"
  ]
}
```

#### Notes On Input

- `document_id` is required
- `difficulty` defaults to `medium`
- `num_questions` defaults to `10`
- `chapter_titles` is optional
- if `chapter_titles` is empty or omitted, use the full document text

#### Validation

- `document_id` must exist in memory
- `difficulty` must be one of `easy`, `medium`, `hard`
- `num_questions` must be within allowed backend range
- if chapter titles are provided, all must exist in the uploaded document

#### Internal Steps

1. fetch document from session memory
2. select chapter content or full text
3. build request payload for `/api/quiz/generate`
4. send request to backend
5. verify response shape
6. return generated questions and metadata to the IDE

#### Output

```json
{
  "document_id": "doc_20260318_001",
  "difficulty": "medium",
  "num_questions": 10,
  "source_filename": "biology.pdf",
  "selected_chapters": [
    "Chapter 1",
    "Chapter 2"
  ],
  "questions": [
    {
      "question": "What is ...?",
      "options": ["A", "B", "C", "D"],
      "correct": 2
    }
  ]
}
```

#### Errors To Handle

- document not found in session memory
- invalid difficulty
- invalid chapter names
- backend generation failure
- backend returns malformed question shape

---

## 12. V1 Response Design

The MCP tool outputs should be easy for both humans and agents to use.

### 12.1 Prefer Structured JSON Responses

Each tool should return structured JSON-friendly data, not a long paragraph.

Why:

- easier for IDE agents to reason about
- easier to chain follow-up actions later
- easier to test

### 12.2 Keep Return Data Useful But Small

For `upload_pdf`, return summary information, not the full extracted text.

For `generate_quiz`, return the actual questions because that is the main purpose of the tool.

---

## 13. Suggested Folder Layout

Recommended new folder:

- `mcp/`

Suggested files:

```text
mcp/
  README.md
  requirements.txt
  server.py
  backend_client.py
  session_store.py
  models.py
```

### 13.1 File Responsibilities

#### `mcp/server.py`

- create `FastMCP` server
- register MCP tools
- start stdio transport

#### `mcp/backend_client.py`

- helper functions for backend HTTP calls
- upload request
- quiz generation request

#### `mcp/session_store.py`

- in-memory document store
- helper functions like add/get/remove document

#### `mcp/models.py`

- shared typed models or validation helpers

#### `mcp/README.md`

- local setup
- how to run
- AntiGravity config example

#### `mcp/requirements.txt`

- MCP server-specific dependencies

---

## 14. Suggested Implementation Order

Build the first version in this exact order.

### Step 1: Create MCP Folder

Add:

- `mcp/server.py`
- `mcp/backend_client.py`
- `mcp/session_store.py`
- `mcp/requirements.txt`
- `mcp/README.md`

### Step 2: Add A Minimal Session Store

Create a simple in-memory dictionary keyed by `document_id`.

It should support:

- add document
- get document
- clear document if needed

### Step 3: Add Backend Upload Helper

Implement a helper in `backend_client.py` to:

- accept `file_path`
- send multipart upload to `/api/upload`
- return parsed JSON

### Step 4: Update Backend Upload Response If Needed

If `/api/upload` still returns only preview text, update it so full parsed content is available to MCP.

This is the one backend change that may be required before the MCP server works correctly.

### Step 5: Add `upload_pdf` Tool

Register the first MCP tool.

This tool should:

- validate file path
- call the upload helper
- store the parsed result in session memory
- return `document_id` and summary data

### Step 6: Add Backend Quiz Helper

Implement a helper in `backend_client.py` to:

- send `content`, `difficulty`, `num_questions` to `/api/quiz/generate`
- return parsed JSON

### Step 7: Add `generate_quiz` Tool

Register the second MCP tool.

This tool should:

- get uploaded document from memory
- build selected text content
- call quiz generation helper
- return structured quiz results

### Step 8: Add Local README

Document:

- requirements
- how to run backend
- how to run MCP server
- how to configure AntiGravity
- sample prompts or tool usage

### Step 9: Test In AntiGravity

Use AntiGravity MCP config to start the local server over stdio and test both tools.

---

## 15. AntiGravity IDE Integration Plan

### 15.1 Connection Style

The MCP server should be launched locally by AntiGravity over stdio.

### 15.2 Expected Raw Config Shape

The exact format may vary slightly by host, but the expected idea is:

```json
{
  "mcpServers": {
    "quizbeat": {
      "command": "python",
      "args": ["C:\\kahoot\\mcp\\server.py"],
      "env": {
        "BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

If a virtual environment is used, the `command` may point to the environment's Python executable instead.

### 15.3 Local Startup Expectation

For tool calls to work:

1. the FastAPI backend must already be running
2. AntiGravity starts the MCP server
3. user asks AntiGravity to call MCP tools

### 15.4 First Manual Test Cases

Test case 1:

- call `upload_pdf` with a valid PDF path
- expect `document_id`, chapter count, and chapter titles

Test case 2:

- call `generate_quiz` with that `document_id`
- expect quiz questions in response

Test case 3:

- call `generate_quiz` with selected chapter titles
- expect only those chapters to be used

Test case 4:

- call `upload_pdf` with a missing file
- expect clear validation error

---

## 16. Logging And Error Handling Expectations

### 16.1 Logging

The MCP server should log:

- tool start
- backend request start
- backend response status
- document stored in session
- generation success or failure

Logs should help local debugging but should not dump unnecessary sensitive content.

### 16.2 Error Messages

Errors should be clear and practical.

Examples:

- `PDF file not found: C:\...`
- `Only .pdf files are supported by upload_pdf`
- `Backend upload failed with status 500`
- `Document ID not found in current MCP session`
- `Chapter title not found: Chapter 9`

---

## 17. Security And Safety For V1

Even though this is a local prototype, the design should still be careful.

### 17.1 Restrict File Input

For the first tool:

- accept only explicit user-provided file paths
- validate `.pdf` extension

### 17.2 Keep Scope Minimal

Do not expose a generic shell execution tool in this MCP server.

This MCP server is for **project actions**, not arbitrary local command execution.

### 17.3 Use stdio For Local Use

For local IDE use, stdio is the preferred transport.

Reason:

- simpler
- more private
- no open HTTP port for the MCP server itself

---

## 18. Known Limitations Of V1

These are expected and acceptable for the first prototype.

- uploaded document state is lost if the MCP process restarts
- only PDF upload is exposed as an MCP tool
- quizzes are not saved yet
- frontend still uses localStorage for its own flows
- MCP and frontend do not yet share a persistent document store
- no Firebase usage yet

---

## 19. Phase 2 Plan: Save Quiz

This is the next planned feature after V1 succeeds.

### 19.1 Goal

Allow the IDE to save a generated quiz after inspection.

### 19.2 Preferred Design

Add a separate MCP tool:

- `save_quiz`

Use **Firebase Admin**, not frontend Firebase SDK.

### 19.3 Expected Tool Input

```json
{
  "title": "Biology Quiz",
  "questions": [...],
  "difficulty": "medium",
  "textbook": "biology.pdf",
  "chapters": ["Chapter 1"],
  "creator_id": "firebase_uid",
  "creator_name": "User Name"
}
```

### 19.4 Why Firebase Admin

Reason:

- server-side control
- not dependent on browser session
- cleaner future integration for list and host actions

### 19.5 Not In V1

This should not be implemented until V1 upload and generate are working well.

---

## 20. Phase 3 Plan: Host Quiz

This is planned after save quiz.

### 20.1 Goal

Let the IDE host and operate a quiz directly without browser automation.

### 20.2 Preferred Design

Use Firebase Realtime Database directly through server-side logic.

Likely tools later:

- `host_quiz`
- `start_game`
- `get_host_status`
- `next_question`
- `end_game`

### 20.3 Why This Is Better Than Playwright

- more reliable
- does not depend on UI timing
- does not depend on page structure
- directly controls the real game state

### 20.4 Not In V1

Hosting is explicitly a later phase.

---

## 21. Future Refactor Plan For localStorage

This is a later cleanup project, not part of V1.

### 21.1 Current Problem

Uploaded textbook information is stored in browser localStorage, which is not shareable with MCP and not durable across environments.

### 21.2 Desired End State

Move textbook storage to server-side infrastructure.

Recommended design later:

- original file in Firebase Storage or another file store
- metadata in Firestore
- parsed text and chapters stored in a server-side accessible form

### 21.3 Why Not Do It Now

Because it would slow down the first useful prototype.

The current priority is to prove:

- upload via MCP
- generate quiz via MCP
- return results cleanly

---

## 22. Publish Plan For Later

After the local MCP server is stable, it can be shared for public use.

### 22.1 Local First

First release target:

- local repo-based MCP server
- users run it on their machine
- users point their IDE to it

### 22.2 Cleanup Needed Before Publishing

Before public release:

- improve README
- finalize environment variable contract
- add versioning
- add setup instructions
- add error documentation
- consider packaging

### 22.3 Possible Publication Paths

- GitHub repo
- Python package
- later MCP registry metadata

This is a later concern, not part of the first implementation.

---

## 23. Concrete Build Checklist

This is the execution checklist for the first prototype.

### Backend

- [ ] Confirm `/api/upload` returns full parsed chapter content, not only preview text
- [ ] If needed, update upload response shape to include full text for MCP use
- [ ] Verify `/api/quiz/generate` works with content from uploaded chapters

### MCP Server

- [ ] Create `mcp/` folder
- [ ] Add `requirements.txt`
- [ ] Add `server.py`
- [ ] Add `backend_client.py`
- [ ] Add `session_store.py`
- [ ] Add `README.md`
- [ ] Implement `upload_pdf`
- [ ] Implement `generate_quiz`
- [ ] Add input validation
- [ ] Add logging
- [ ] Return structured tool responses

### AntiGravity

- [ ] Add raw MCP config entry
- [ ] Point command to local Python server
- [ ] Set `BACKEND_URL`
- [ ] Test `upload_pdf`
- [ ] Test `generate_quiz`

### Validation

- [ ] Test with a valid PDF
- [ ] Test with invalid file path
- [ ] Test with invalid chapter names
- [ ] Test backend down scenario
- [ ] Test generated quiz response readability in IDE

---

## 24. Immediate Next Action

The immediate next implementation step should be:

1. create the `mcp/` folder
2. add a minimal `FastMCP` server over stdio
3. expose `upload_pdf`
4. expose `generate_quiz`
5. adjust `/api/upload` response if it does not return enough full text
6. connect the server in AntiGravity raw config

This is the smallest complete vertical slice.

---

## 25. Summary

The agreed plan is:

- no Playwright
- no combined mega-action
- build a Python MCP server
- connect it locally to AntiGravity over stdio
- use the existing FastAPI backend for upload and quiz generation
- keep uploaded document state in MCP memory for now
- first prototype only supports `upload_pdf` and `generate_quiz`
- save quiz comes next using Firebase Admin
- host quiz comes after that using direct Realtime Database control

If the implementation follows this document, the result should be a clean and testable first MCP prototype for QuizBeat.
