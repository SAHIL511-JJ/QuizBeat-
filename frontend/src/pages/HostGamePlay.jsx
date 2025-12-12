import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Trophy, TrendingUp, TrendingDown, Minus, ChevronRight, Users } from 'lucide-react';

export default function HostGamePlay() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { subscribeToGame, nextQuestion, endGame, calculateScore } = useGame();
    const [game, setGame] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [previousRankings, setPreviousRankings] = useState([]);
    const [currentRankings, setCurrentRankings] = useState([]);
    const [displayRankings, setDisplayRankings] = useState([]); // What to show before time up
    const [pointsAdded, setPointsAdded] = useState({});
    const [questionStartTime, setQuestionStartTime] = useState(null);

    // Subscribe to game updates
    useEffect(() => {
        const unsubscribe = subscribeToGame(gameId, (gameData) => {
            setGame(gameData);

            // Check if host
            if (user && gameData.hostId !== user.uid) {
                navigate(`/game/${gameId}/play`);
                return;
            }

            if (gameData.status === 'finished') {
                navigate(`/game/${gameId}/results`);
                return;
            }

            // New question started
            if (gameData.questionStartTime !== questionStartTime) {
                // Save current rankings as previous before resetting
                if (currentRankings.length > 0) {
                    setPreviousRankings(currentRankings);
                    setDisplayRankings(currentRankings); // Freeze display at start of question
                }
                setQuestionStartTime(gameData.questionStartTime);
                setShowResults(false);
                setPointsAdded({});
                setTimeLeft(gameData.quiz.timePerQuestion);
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [gameId, navigate, subscribeToGame, questionStartTime, user, currentRankings]);

    // Calculate rankings whenever game data changes
    useEffect(() => {
        if (!game || !game.teams) return;

        const rankings = Object.entries(game.teams).map(([teamId, team]) => {
            let totalScore = 0;
            let currentQuestionPoints = 0;
            const answers = team.answers || {};

            Object.entries(answers).forEach(([qIndex, answer]) => {
                const qIdx = parseInt(qIndex);
                const question = game.quiz.questions[qIdx];
                if (answer.answer === question.correct) {
                    const responseTime = answer.time - game.questionStartTime;
                    const maxTime = game.quiz.timePerQuestion * 1000;
                    const baseScore = 1000;
                    const speedBonus = Math.max(0, 500 * (1 - responseTime / maxTime));
                    const points = Math.round(baseScore + speedBonus);
                    totalScore += points;

                    // Track points for current question
                    if (qIdx === game.currentQuestion) {
                        currentQuestionPoints = points;
                    }
                }
            });

            return {
                id: teamId,
                name: team.name,
                score: totalScore,
                pointsThisQuestion: currentQuestionPoints,
                hasAnswered: answers[game.currentQuestion] !== undefined
            };
        });

        rankings.sort((a, b) => b.score - a.score);
        setCurrentRankings(rankings);

        // Update points added for animation and update display rankings when time is up
        if (showResults) {
            setDisplayRankings(rankings); // Now show updated scores
            const newPointsAdded = {};
            rankings.forEach(team => {
                newPointsAdded[team.id] = team.pointsThisQuestion;
            });
            setPointsAdded(newPointsAdded);
        }
    }, [game, showResults]);

    // Timer countdown
    useEffect(() => {
        if (!game || showResults) return;

        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - game.questionStartTime) / 1000);
            const remaining = Math.max(0, game.quiz.timePerQuestion - elapsed);
            setTimeLeft(remaining);

            if (remaining === 0 && !showResults) {
                setShowResults(true);
            }
        }, 100);

        return () => clearInterval(timer);
    }, [game, showResults]);

    // Get rank change for a team
    const getRankChange = (teamId) => {
        if (previousRankings.length === 0) return 0;
        const prevIndex = previousRankings.findIndex(t => t.id === teamId);
        const currIndex = currentRankings.findIndex(t => t.id === teamId);
        if (prevIndex === -1) return 0;
        return prevIndex - currIndex; // Positive = moved up
    };

    const handleNextQuestion = async () => {
        const nextIndex = game.currentQuestion + 1;
        if (nextIndex >= game.quiz.questions.length) {
            await endGame(gameId);
            navigate(`/game/${gameId}/results`);
        } else {
            await nextQuestion(gameId, nextIndex);
        }
    };

    if (!game || game.currentQuestion < 0) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading game...</p>
            </div>
        );
    }

    const currentQ = game.quiz.questions[game.currentQuestion];
    const timerPercent = (timeLeft / game.quiz.timePerQuestion) * 100;
    const answeredCount = currentRankings.filter(t => t.hasAnswered).length;
    const totalTeams = currentRankings.length;
    // Use displayRankings for showing scores (frozen until time up)
    // but use currentRankings for hasAnswered status (real-time)
    const rankingsToShow = displayRankings.length > 0 ? displayRankings : currentRankings;

    return (
        <div className="host-gameplay-page">
            {/* Left Panel - Question Display */}
            <div className="question-panel">
                {/* Timer Badge */}
                <div className={`timer-badge ${timeLeft <= 5 ? 'warning' : ''}`}>
                    <Clock size={20} />
                    <span>{timeLeft}s</span>
                </div>

                {/* Question Counter */}
                <div className="question-counter">
                    <span>Question {game.currentQuestion + 1} of {game.quiz.questions.length}</span>
                </div>

                {/* Question */}
                <div className="game-question host-question">
                    <h1>{currentQ.question}</h1>
                </div>

                {/* Options Display (for host reference) */}
                <div className="host-options-grid">
                    {currentQ.options.map((option, index) => (
                        <div
                            key={index}
                            className={`host-option ${showResults && index === currentQ.correct ? 'correct' : ''}`}
                        >
                            <span className="option-label">
                                {index === 0 && '▲'}
                                {index === 1 && '◆'}
                                {index === 2 && '●'}
                                {index === 3 && '■'}
                            </span>
                            <span className="option-text">{option}</span>
                        </div>
                    ))}
                </div>

                {/* Answers Status */}
                <div className="answers-status">
                    <Users size={20} />
                    <span>{answeredCount} / {totalTeams} teams answered</span>
                </div>

                {/* Next Question Button */}
                {showResults && (
                    <button className="next-question-btn" onClick={handleNextQuestion}>
                        {game.currentQuestion + 1 >= game.quiz.questions.length ? (
                            <>
                                <Trophy size={20} />
                                Show Final Results
                            </>
                        ) : (
                            <>
                                Next Question
                                <ChevronRight size={20} />
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Right Panel - Live Leaderboard */}
            <div className="leaderboard-panel">
                <div className="leaderboard-header">
                    <Trophy size={24} />
                    <h2>Live Rankings</h2>
                </div>

                <div className="live-leaderboard">
                    {rankingsToShow.map((team, index) => {
                        const rankChange = showResults ? getRankChange(team.id) : 0;
                        const pointsGained = showResults ? (pointsAdded[team.id] || 0) : 0;
                        // Get real-time answered status from currentRankings
                        const currentTeamData = currentRankings.find(t => t.id === team.id);
                        const hasAnswered = currentTeamData?.hasAnswered || false;

                        return (
                            <div
                                key={team.id}
                                className={`leaderboard-row ${showResults ? 'show-changes' : ''} ${rankChange > 0 ? 'moved-up' : rankChange < 0 ? 'moved-down' : ''}`}
                                style={{ '--rank-index': index }}
                            >
                                <div className="rank-badge">
                                    {index === 0 && '🥇'}
                                    {index === 1 && '🥈'}
                                    {index === 2 && '🥉'}
                                    {index > 2 && `#${index + 1}`}
                                </div>

                                <div className="team-info">
                                    <span className="team-name">{team.name}</span>
                                    <span className="team-score">{team.score.toLocaleString()} pts</span>
                                </div>

                                {/* Rank Change Indicator */}
                                {showResults && rankChange !== 0 && (
                                    <div className={`rank-change ${rankChange > 0 ? 'up' : 'down'}`}>
                                        {rankChange > 0 ? (
                                            <><TrendingUp size={16} /> +{rankChange}</>
                                        ) : (
                                            <><TrendingDown size={16} /> {rankChange}</>
                                        )}
                                    </div>
                                )}

                                {showResults && rankChange === 0 && (
                                    <div className="rank-change same">
                                        <Minus size={16} />
                                    </div>
                                )}

                                {/* Points Added Animation */}
                                {showResults && pointsGained > 0 && (
                                    <div className="points-popup">
                                        +{pointsGained}
                                    </div>
                                )}

                                {/* Answer Status */}
                                {!showResults && (
                                    <div className={`answer-indicator ${hasAnswered ? 'answered' : ''}`}>
                                        {hasAnswered ? '✓' : '...'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
