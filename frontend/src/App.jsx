import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Navbar from './components/UI/Navbar';
import ChatBot from './components/ChatBot/ChatBot';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UploadTextbook from './pages/UploadTextbook';
import GenerateQuiz from './pages/GenerateQuiz';
import TakeQuiz from './pages/TakeQuiz';
import QuizResults from './pages/QuizResults';
import HostGame from './pages/HostGame';
import JoinGame from './pages/JoinGame';
import GameLobby from './pages/GameLobby';
import GamePlay from './pages/GamePlay';
import HostGamePlay from './pages/HostGamePlay';
import GameResults from './pages/GameResults';

import './index.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <GameProvider>
            <div className="app">
              <Navbar />
              <main className="main-content">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/join-game" element={<JoinGame />} />
                  <Route path="/game/:gameId/lobby" element={<GameLobby />} />
                  <Route path="/game/:gameId/play" element={<GamePlay />} />
                  <Route path="/game/:gameId/host" element={<HostGamePlay />} />
                  <Route path="/game/:gameId/results" element={<GameResults />} />

                  {/* Protected Routes */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/upload" element={
                    <ProtectedRoute>
                      <UploadTextbook />
                    </ProtectedRoute>
                  } />
                  <Route path="/generate-quiz" element={
                    <ProtectedRoute>
                      <GenerateQuiz />
                    </ProtectedRoute>
                  } />
                  <Route path="/take-quiz/:quizId" element={
                    <ProtectedRoute>
                      <TakeQuiz />
                    </ProtectedRoute>
                  } />
                  <Route path="/quiz-results/:quizId" element={
                    <ProtectedRoute>
                      <QuizResults />
                    </ProtectedRoute>
                  } />
                  <Route path="/host-game" element={
                    <ProtectedRoute>
                      <HostGame />
                    </ProtectedRoute>
                  } />

                  {/* Default Route */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
              <ChatBot />
            </div>
          </GameProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
