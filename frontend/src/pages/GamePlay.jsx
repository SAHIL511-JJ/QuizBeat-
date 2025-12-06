import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { Clock, CheckCircle } from 'lucide-react';

export default function GamePlay() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const { subscribeToGame, submitAnswer, nextQuestion, calculateScore, currentGame } = useGame();
    const [game, setGame] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [questionStartTime, setQuestionStartTime] = useState(null);

    const teamName = currentGame?.teamName;
    const isHost = currentGame?.hostId === currentGame?.userId;

    useEffect(() => {
        const unsubscribe = subscribeToGame(gameId, (gameData) => {
            setGame(gameData);

            if (gameData.status === 'finished') {
                navigate(`/game/${gameId}/results`);
                return;
            }

            // Reset state for new question
            if (gameData.questionStartTime !== questionStartTime) {
                setQuestionStartTime(gameData.questionStartTime);
                setSelectedAnswer(null);
                setHasAnswered(false);
                setShowResults(false);
                setTimeLeft(gameData.quiz.timePerQuestion);
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [gameId, navigate, subscribeToGame, questionStartTime]);

    // Timer countdown
    useEffect(() => {
        if (!game || showResults) return;

        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - game.questionStartTime) / 1000);
            const remaining = Math.max(0, game.quiz.timePerQuestion - elapsed);
            setTimeLeft(remaining);

            if (remaining === 0 && !showResults) {
                setShowResults(true);
                // Auto advance after showing results (host only)
                if (isHost) {
                    setTimeout(() => {
                        const nextIndex = game.currentQuestion + 1;
                        if (nextIndex >= game.quiz.questions.length) {
                            // End game
                            navigate(`/game/${gameId}/results`);
                        } else {
                            nextQuestion(gameId, nextIndex);
                        }
                    }, 3000);
                }
            }
        }, 100);

        return () => clearInterval(timer);
    }, [game, showResults, isHost, gameId, navigate, nextQuestion]);

    const handleAnswerSelect = async (answerIndex) => {
        if (hasAnswered || showResults || !teamName) return;

        setSelectedAnswer(answerIndex);
        setHasAnswered(true);

        try {
            await submitAnswer(gameId, teamName, game.currentQuestion, answerIndex);
        } catch (err) {
            console.error('Failed to submit answer:', err);
        }
    };

    if (!game || game.currentQuestion < 0) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading question...</p>
            </div>
        );
    }

    const currentQ = game.quiz.questions[game.currentQuestion];
    const timerPercent = (timeLeft / game.quiz.timePerQuestion) * 100;

    // Option colors like Kahoot
    const optionColors = ['red', 'blue', 'yellow', 'green'];

    return (
        <div className="game-play-page">
            {/* Timer Bar */}
            <div className="timer-bar">
                <div
                    className={`timer-fill ${timeLeft <= 5 ? 'warning' : ''}`}
                    style={{ width: `${timerPercent}%` }}
                ></div>
                <span className="timer-text">
                    <Clock size={16} />
                    {timeLeft}s
                </span>
            </div>

            {/* Question Counter */}
            <div className="question-counter">
                <span>Question {game.currentQuestion + 1} of {game.quiz.questions.length}</span>
            </div>

            {/* Question */}
            <div className="game-question">
                <h1>{currentQ.question}</h1>
            </div>

            {/* Answer Options */}
            <div className="game-options">
                {currentQ.options.map((option, index) => {
                    let className = `game-option ${optionColors[index]}`;

                    if (selectedAnswer === index) {
                        className += ' selected';
                    }

                    if (showResults) {
                        if (index === currentQ.correct) {
                            className += ' correct';
                        } else if (selectedAnswer === index) {
                            className += ' wrong';
                        }
                    }

                    return (
                        <button
                            key={index}
                            className={className}
                            onClick={() => handleAnswerSelect(index)}
                            disabled={hasAnswered || showResults}
                        >
                            <span className="option-shape">
                                {index === 0 && '▲'}
                                {index === 1 && '◆'}
                                {index === 2 && '●'}
                                {index === 3 && '■'}
                            </span>
                            <span className="option-text">{option}</span>
                            {showResults && index === currentQ.correct && (
                                <CheckCircle size={32} className="correct-icon" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Answer Status */}
            {hasAnswered && !showResults && (
                <div className="answer-status">
                    <CheckCircle size={48} />
                    <p>Answer locked in!</p>
                    <span>Waiting for time to run out...</span>
                </div>
            )}

            {/* Results Overlay */}
            {showResults && (
                <div className="results-overlay">
                    <div className="results-content">
                        {selectedAnswer === currentQ.correct ? (
                            <>
                                <span className="result-emoji">🎉</span>
                                <h2>Correct!</h2>
                            </>
                        ) : selectedAnswer !== null ? (
                            <>
                                <span className="result-emoji">😅</span>
                                <h2>Wrong!</h2>
                                <p>Correct answer: {currentQ.options[currentQ.correct]}</p>
                            </>
                        ) : (
                            <>
                                <span className="result-emoji">⏰</span>
                                <h2>Time's up!</h2>
                                <p>Correct answer: {currentQ.options[currentQ.correct]}</p>
                            </>
                        )}
                        <span className="next-message">Next question coming up...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
