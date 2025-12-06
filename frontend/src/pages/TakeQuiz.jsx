import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ArrowRight, CheckCircle } from 'lucide-react';

export default function TakeQuiz() {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [startTime, setStartTime] = useState(null);

    useEffect(() => {
        const storedQuiz = localStorage.getItem('currentQuiz');
        if (storedQuiz) {
            setQuiz(JSON.parse(storedQuiz));
            setStartTime(Date.now());
        }
    }, [quizId]);

    if (!quiz) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading quiz...</p>
            </div>
        );
    }

    const currentQuestion = quiz.questions[currentIndex];
    const isLastQuestion = currentIndex === quiz.questions.length - 1;
    const progress = ((currentIndex + 1) / quiz.questions.length) * 100;

    const handleAnswerSelect = (optionIndex) => {
        if (showFeedback) return;
        setSelectedAnswer(optionIndex);
    };

    const handleSubmitAnswer = () => {
        if (selectedAnswer === null) return;

        const isCorrect = selectedAnswer === currentQuestion.correct;

        setAnswers(prev => ({
            ...prev,
            [currentIndex]: {
                selected: selectedAnswer,
                correct: currentQuestion.correct,
                isCorrect,
                question: currentQuestion.question,
                options: currentQuestion.options
            }
        }));

        setShowFeedback(true);

        // Auto-advance after feedback
        setTimeout(() => {
            if (isLastQuestion) {
                // Complete quiz
                const results = {
                    quizId: quiz.id,
                    answers: {
                        ...answers,
                        [currentIndex]: {
                            selected: selectedAnswer,
                            correct: currentQuestion.correct,
                            isCorrect,
                            question: currentQuestion.question,
                            options: currentQuestion.options
                        }
                    },
                    totalQuestions: quiz.questions.length,
                    timeTaken: Date.now() - startTime,
                    completedAt: new Date().toISOString()
                };
                localStorage.setItem('quizResults', JSON.stringify(results));
                navigate(`/quiz-results/${quiz.id}`);
            } else {
                setCurrentIndex(prev => prev + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            }
        }, 1500);
    };

    const getOptionClass = (index) => {
        let className = 'option-btn';

        if (selectedAnswer === index) {
            className += ' selected';
        }

        if (showFeedback) {
            if (index === currentQuestion.correct) {
                className += ' correct';
            } else if (selectedAnswer === index && index !== currentQuestion.correct) {
                className += ' wrong';
            }
        }

        return className;
    };

    return (
        <div className="take-quiz-page">
            <div className="quiz-container">
                {/* Progress Bar */}
                <div className="quiz-header">
                    <div className="progress-info">
                        <span>Question {currentIndex + 1} of {quiz.questions.length}</span>
                        <span className={`difficulty-badge ${quiz.difficulty}`}>
                            {quiz.difficulty}
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                {/* Question Card */}
                <div className="question-card">
                    <h2 className="question-text">{currentQuestion.question}</h2>

                    <div className="options-grid">
                        {currentQuestion.options.map((option, index) => (
                            <button
                                key={index}
                                className={getOptionClass(index)}
                                onClick={() => handleAnswerSelect(index)}
                                disabled={showFeedback}
                            >
                                <span className="option-letter">
                                    {String.fromCharCode(65 + index)}
                                </span>
                                <span className="option-text">{option}</span>
                                {showFeedback && index === currentQuestion.correct && (
                                    <CheckCircle className="correct-icon" size={24} />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    className="submit-btn"
                    onClick={handleSubmitAnswer}
                    disabled={selectedAnswer === null || showFeedback}
                >
                    {showFeedback ? (
                        isLastQuestion ? 'Finishing...' : 'Next Question...'
                    ) : (
                        <>
                            {isLastQuestion ? 'Finish Quiz' : 'Submit Answer'}
                            <ArrowRight size={20} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
