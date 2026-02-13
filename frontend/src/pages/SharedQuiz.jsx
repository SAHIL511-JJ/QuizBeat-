import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Brain, Play, GamepadIcon, Loader, AlertCircle, User, BookOpen } from 'lucide-react';
import { getQuizById } from '../services/quizService';
import { useAuth } from '../contexts/AuthContext';

export default function SharedQuiz() {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadQuiz();
    }, [quizId]);

    const loadQuiz = async () => {
        try {
            const quizData = await getQuizById(quizId);
            if (!quizData) {
                setError('Quiz not found. It may have been deleted.');
            } else {
                setQuiz(quizData);
            }
        } catch (err) {
            setError('Failed to load quiz. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleTakeQuiz = () => {
        const quizData = {
            id: quiz.id,
            questions: quiz.questions,
            difficulty: quiz.difficulty,
            textbook: quiz.textbook,
            chapters: quiz.chapters,
            createdAt: quiz.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        };
        localStorage.setItem('currentQuiz', JSON.stringify(quizData));
        navigate(`/take-quiz/${quiz.id}`);
    };

    const handleHostGame = () => {
        if (!isAuthenticated) {
            // Store intent and redirect to login
            localStorage.setItem('postLoginRedirect', `/shared-quiz/${quizId}`);
            navigate('/login');
            return;
        }

        localStorage.setItem('hostQuizData', JSON.stringify({
            questions: quiz.questions,
            title: quiz.title,
        }));
        navigate('/host-game?fromSaved=true');
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <Loader className="spinner" size={48} />
                <p>Loading quiz...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="shared-quiz-page">
                <div className="shared-quiz-container">
                    <div className="error-state">
                        <AlertCircle size={64} />
                        <h2>Oops!</h2>
                        <p>{error}</p>
                        <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="shared-quiz-page">
            <div className="shared-quiz-container">
                <div className="shared-quiz-card">
                    <div className="shared-quiz-header">
                        <Brain size={48} className="shared-quiz-icon" />
                        <h1>{quiz.title}</h1>
                        <div className="shared-quiz-meta">
                            <span className={`difficulty-badge ${quiz.difficulty}`}>
                                {quiz.difficulty}
                            </span>
                            <span>{quiz.numQuestions} questions</span>
                            <span className="quiz-source-badge">
                                {quiz.source === 'ai' ? '🤖 AI Generated' : '✏️ Manually Created'}
                            </span>
                        </div>
                    </div>

                    <div className="shared-quiz-info">
                        <div className="info-row">
                            <User size={16} />
                            <span>Created by <strong>{quiz.creatorName}</strong></span>
                        </div>
                        {quiz.textbook && (
                            <div className="info-row">
                                <BookOpen size={16} />
                                <span>From: {quiz.textbook}</span>
                            </div>
                        )}
                    </div>

                    <div className="shared-quiz-actions">
                        <button className="btn-primary large" onClick={handleTakeQuiz}>
                            <Play size={24} />
                            Take Quiz Solo
                        </button>
                        <button className="btn-secondary large" onClick={handleHostGame}>
                            <GamepadIcon size={24} />
                            Host Multiplayer Game
                            {!isAuthenticated && <small>(login required)</small>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
