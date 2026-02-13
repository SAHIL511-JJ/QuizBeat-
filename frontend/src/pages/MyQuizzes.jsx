import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserQuizzes, deleteQuiz } from '../services/quizService';
import {
    Brain,
    GamepadIcon,
    Trash2,
    Share2,
    Play,
    Clock,
    BookOpen,
    Loader,
    Plus
} from 'lucide-react';

export default function MyQuizzes() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) {
            loadQuizzes();
        }
    }, [user]);

    const loadQuizzes = async () => {
        try {
            const data = await getUserQuizzes(user.uid);
            setQuizzes(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load quizzes.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (quizId, title) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

        try {
            await deleteQuiz(quizId);
            setQuizzes(quizzes.filter(q => q.id !== quizId));
        } catch (err) {
            console.error(err);
            alert('Failed to delete quiz.');
        }
    };

    const handleHost = (quiz) => {
        // Store quiz data in localStorage for HostGame to pick up
        localStorage.setItem('hostQuizData', JSON.stringify({
            questions: quiz.questions,
            title: quiz.title,
            id: quiz.id
        }));
        navigate('/host-game?fromSaved=true');
    };

    const handleShare = (quizId) => {
        // Generate shareable link
        const url = `${window.location.origin}/quiz/${quizId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Quiz link copied to clipboard!');
        });
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <Loader className="spinner" size={48} />
                <p>Loading your quizzes...</p>
            </div>
        );
    }

    return (
        <div className="my-quizzes-page">
            <div className="page-header">
                <div className="header-content">
                    <h1>My Quizzes</h1>
                    <p>Manage, host, and share your saved quizzes</p>
                </div>
                <button className="btn-primary" onClick={() => navigate('/generate-quiz')}>
                    <Plus size={20} />
                    New Quiz
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="quizzes-grid">
                {quizzes.length === 0 ? (
                    <div className="empty-state">
                        <Brain size={64} />
                        <h2>No saved quizzes yet</h2>
                        <p>Generate one from your textbooks or create one manually.</p>
                        <button className="btn-secondary" onClick={() => navigate('/generate-quiz')}>
                            Generate Quiz
                        </button>
                    </div>
                ) : (
                    quizzes.map((quiz) => (
                        <div key={quiz.id} className="quiz-card">
                            <div className="quiz-card-header">
                                <h3 title={quiz.title}>{quiz.title}</h3>
                                <span className={`difficulty-badge ${quiz.difficulty}`}>
                                    {quiz.difficulty}
                                </span>
                            </div>

                            <div className="quiz-meta">
                                <div className="meta-item">
                                    <Brain size={16} />
                                    <span>{quiz.numQuestions} Qs</span>
                                </div>
                                <div className="meta-item">
                                    <Clock size={16} />
                                    <span>{new Date(quiz.createdAt?.toDate?.() || quiz.createdAt).toLocaleDateString()}</span>
                                </div>
                                {quiz.textbook && (
                                    <div className="meta-item full-width">
                                        <BookOpen size={16} />
                                        <span className="truncate">{quiz.textbook}</span>
                                    </div>
                                )}
                            </div>

                            <div className="quiz-actions">
                                <button
                                    className="action-btn host-btn"
                                    onClick={() => handleHost(quiz)}
                                    title="Host Game"
                                >
                                    <GamepadIcon size={18} />
                                    Host
                                </button>
                                <button
                                    className="action-btn share-btn"
                                    onClick={() => handleShare(quiz.id)}
                                    title="Share Link"
                                >
                                    <Share2 size={18} />
                                </button>
                                <button
                                    className="action-btn delete-btn"
                                    onClick={() => handleDelete(quiz.id, quiz.title)}
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
