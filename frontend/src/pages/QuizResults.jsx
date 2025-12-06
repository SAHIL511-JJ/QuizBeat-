import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, CheckCircle, XCircle, RefreshCw, Home, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function QuizResults() {
    const navigate = useNavigate();
    const [results, setResults] = useState(null);
    const [explanations, setExplanations] = useState({});
    const [loadingExplanation, setLoadingExplanation] = useState({});

    useEffect(() => {
        const storedResults = localStorage.getItem('quizResults');
        if (storedResults) {
            setResults(JSON.parse(storedResults));
        }
    }, []);

    if (!results) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading results...</p>
            </div>
        );
    }

    const answersArray = Object.values(results.answers);
    const correctCount = answersArray.filter(a => a.isCorrect).length;
    const score = Math.round((correctCount / results.totalQuestions) * 100);
    const timeTaken = Math.round(results.timeTaken / 1000);

    const getScoreMessage = () => {
        if (score >= 90) return { emoji: '🏆', message: 'Outstanding!' };
        if (score >= 70) return { emoji: '🌟', message: 'Great job!' };
        if (score >= 50) return { emoji: '👍', message: 'Good effort!' };
        return { emoji: '💪', message: 'Keep practicing!' };
    };

    const fetchExplanation = async (index, answer) => {
        if (explanations[index] || answer.isCorrect) return;

        setLoadingExplanation(prev => ({ ...prev, [index]: true }));

        try {
            const response = await fetch(`${API_URL}/api/quiz/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: answer.question,
                    user_answer: answer.options[answer.selected],
                    correct_answer: answer.options[answer.correct]
                })
            });

            const data = await response.json();
            setExplanations(prev => ({ ...prev, [index]: data.explanation }));
        } catch (err) {
            setExplanations(prev => ({
                ...prev,
                [index]: 'Unable to generate explanation. Please try again.'
            }));
        } finally {
            setLoadingExplanation(prev => ({ ...prev, [index]: false }));
        }
    };

    const { emoji, message } = getScoreMessage();

    return (
        <div className="results-page">
            <div className="results-container">
                {/* Score Summary */}
                <div className="score-card">
                    <div className="score-emoji">{emoji}</div>
                    <h1 className="score-message">{message}</h1>
                    <div className="score-value">{score}%</div>
                    <div className="score-details">
                        <div className="detail">
                            <CheckCircle size={20} className="correct" />
                            <span>{correctCount} Correct</span>
                        </div>
                        <div className="detail">
                            <XCircle size={20} className="wrong" />
                            <span>{results.totalQuestions - correctCount} Wrong</span>
                        </div>
                        <div className="detail">
                            <Trophy size={20} />
                            <span>{Math.floor(timeTaken / 60)}m {timeTaken % 60}s</span>
                        </div>
                    </div>
                </div>

                {/* Questions Review */}
                <div className="questions-review">
                    <h2>Review Your Answers</h2>

                    {answersArray.map((answer, index) => (
                        <div
                            key={index}
                            className={`review-card ${answer.isCorrect ? 'correct' : 'wrong'}`}
                        >
                            <div className="review-header">
                                <span className="question-number">Q{index + 1}</span>
                                {answer.isCorrect ? (
                                    <CheckCircle className="status-icon correct" size={24} />
                                ) : (
                                    <XCircle className="status-icon wrong" size={24} />
                                )}
                            </div>

                            <p className="review-question">{answer.question}</p>

                            <div className="review-answers">
                                <div className={`answer your-answer ${answer.isCorrect ? 'correct' : 'wrong'}`}>
                                    <span className="label">Your Answer:</span>
                                    <span className="value">{answer.options[answer.selected]}</span>
                                </div>

                                {!answer.isCorrect && (
                                    <div className="answer correct-answer">
                                        <span className="label">Correct Answer:</span>
                                        <span className="value">{answer.options[answer.correct]}</span>
                                    </div>
                                )}
                            </div>

                            {!answer.isCorrect && (
                                <div className="explanation-section">
                                    {explanations[index] ? (
                                        <div className="explanation">
                                            <strong>💡 Explanation:</strong>
                                            <p>{explanations[index]}</p>
                                        </div>
                                    ) : (
                                        <button
                                            className="explain-btn"
                                            onClick={() => fetchExplanation(index, answer)}
                                            disabled={loadingExplanation[index]}
                                        >
                                            {loadingExplanation[index] ? (
                                                <>
                                                    <Loader className="spinner" size={16} />
                                                    Getting explanation...
                                                </>
                                            ) : (
                                                'Get AI Explanation'
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/generate-quiz')}
                    >
                        <RefreshCw size={20} />
                        Take Another Quiz
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => navigate('/dashboard')}
                    >
                        <Home size={20} />
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
