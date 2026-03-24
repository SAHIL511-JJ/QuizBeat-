# QuizBeat MCP Server

Local MCP server that exposes QuizBeat actions over `stdio`.

Current tools:
- account login/logout/status
- document upload
- quiz generation
- quiz save
- quiz edit (generated + saved)

## Prerequisites

- Python 3.11+
- QuizBeat FastAPI backend running locally at `http://localhost:8000` by default

## Setup

```bash
cd mcp
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` only if your backend URL is different.

## Running

The server is usually launched by an MCP-compatible IDE.

Manual run:

```bash
python server.py
```

## IDE Configuration

Example config for AntiGravity or Gemini CLI:

```json
{
  "mcpServers": {
    "quizbeat": {
      "command": "python",
      "args": ["c:\\kahoot\\mcp\\server.py"],
      "env": {
        "BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

## Tools

### `login`

Connect this MCP server to a QuizBeat account using a one-time login code from the web app.

Input:
- `login_code`

Returns:
- active account info
- session expiry

### `whoami`

Show the QuizBeat account currently linked to this MCP server.

Input:
- optional `verify` boolean to confirm the session with the backend

Returns:
- current account info
- or "not logged in"

### `logout`

Clear the current QuizBeat account session from this MCP server.

Input:
- none

Returns:
- logout result
- whether backend session revoke succeeded

### `upload_document`

Upload a local PDF, DOCX, or TXT file to the backend and cache the parsed result.

Input:
- `file_path` absolute local path

Returns:
- `document_id`
- filename
- character count
- chapter titles

### `generate_quiz`

Generate a quiz from a previously uploaded document.

Input:
- `document_id` from `upload_document`
- `difficulty` as `easy`, `medium`, or `hard`
- `num_questions` from 1 to 50
- optional `chapter_titles` list

Returns:
- `quiz_id`
- default `title`
- quiz questions
- quiz metadata

Note:
- this caches the generated quiz in the current MCP process
- use the returned `quiz_id` with `save_quiz`

### `save_quiz`

Save a previously generated quiz to the currently logged-in QuizBeat account.

Input:
- `quiz_id` from `generate_quiz`
- optional `title`
- optional `source` label, default `ai`

Returns:
- saved Firestore quiz ID
- title
- question count
- creator info

Requirements:
- you must be logged in through the MCP `login` tool
- the `quiz_id` must come from a quiz generated in the current MCP session

### `edit_quiz`

Edit a cached generated quiz or a saved quiz.

Input:
- target: `quiz_id` or `saved_quiz_id` (at least one required)
- optional metadata updates: `title`, `difficulty`, `source`, `textbook`, `chapters`
- optional question operations:
  - `question_updates` with `index` and optional `question`, `options`, `option_updates`, `correct`
  - `add_questions`
  - `remove_question_indexes`
- optional `persist_saved_quiz` boolean

Behavior:
- generated quiz edits update MCP cache
- saved quiz edits can be persisted via backend `PATCH /api/mcp/quizzes/{id}`
- strict validation is enforced:
  - non-empty title
  - at least one question
  - exactly 4 non-empty options per question
  - `correct` index in `0..3`

Returns:
- `quiz_id`
- `saved_quiz_id` when linked
- `persisted` status
- updated metadata summary

## Example Prompts

> "Login to QuizBeat with this code: ABCD2345EFGH"

> "Who am I?"

> "Upload the file `C:\\kahoot\\sample.pdf`"

> "Generate a hard quiz with 10 questions from that document"

> "Save quiz `quiz_ab12cd34` as Java Concurrency Hard Quiz"

> "Edit quiz `quiz_ab12cd34` title to `Java Concurrency - Revised`, fix question 1, and add one new question"

> "Edit saved quiz `abc123` and persist: change difficulty to hard and update chapter list"

## Known Limitations

- uploaded document state is lost if the MCP process restarts
- generated quiz state is lost if the MCP process restarts before save
- cached quiz edits are process-local until saved
- QuizBeat auth requires backend Firebase Admin credentials
- frontend and MCP do not share a persistent document store yet
