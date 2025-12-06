# StudyQuiz - AI-Powered Quiz Platform

A comprehensive web application for students to upload textbooks, generate AI quizzes, and participate in Kahoot-like multiplayer quiz competitions.

## 🚀 Features

- **📚 Textbook Upload**: Upload PDF, Word, or text files
- **🧠 AI Quiz Generation**: Generate quizzes using Groq's Llama 70B model
- **📊 Difficulty Levels**: Easy, Medium, Hard
- **📖 Chapter Selection**: Narrow down quiz scope to specific chapters
- **✅ Results & Explanations**: View answers with AI-generated explanations
- **🔐 Google Sign-In**: Secure authentication
- **🎮 Kahoot-like Multiplayer**: Real-time team competitions with scoring

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Backend**: FastAPI (Python)
- **Database/Auth**: Firebase
- **AI**: Groq API (Llama 70B)
- **Deployment**: Vercel (frontend) + Render (backend)

## 📋 Prerequisites

- Node.js 18+
- Python 3.9+
- Firebase account
- Groq API key

## 🔧 Setup

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "studyquiz"
3. Enable **Google Authentication**
4. Create **Firestore Database** (test mode)
5. Create **Realtime Database** (test mode)
6. Get your config from Project Settings > Your Apps > Web

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with your Firebase config
npm install
npm run dev
```

### 3. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Groq API key
uvicorn app.main:app --reload
```

## 🌐 Environment Variables

### Frontend (.env)
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_API_URL=http://localhost:8000
```

### Backend (.env)
```
GROQ_API_KEY=your_groq_api_key
FRONTEND_URL=http://localhost:5173
```

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
npx vercel --prod
```

### Backend (Render)
1. Push to GitHub
2. Connect repo to Render
3. Set environment variables
4. Deploy

## 📁 Project Structure

```
├── frontend/          # React app
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
│
├── backend/           # FastAPI app
│   ├── app/
│   │   ├── routers/
│   │   ├── services/
│   │   └── utils/
│   └── requirements.txt
│
└── README.md
```

## 📝 License

MIT
