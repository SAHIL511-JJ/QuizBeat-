import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { Trophy, Medal, Home, RefreshCw } from 'lucide-react';

export default function GameResults() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const { subscribeToGame } = useGame();
    const [game, setGame] = useState(null);
    const [rankings, setRankings] = useState([]);

    useEffect(() => {
        const unsubscribe = subscribeToGame(gameId, (gameData) => {
            setGame(gameData);

            if (gameData.teams) {
                // Calculate final scores
                const teamScores = Object.entries(gameData.teams).map(([id, team]) => {
                    let totalScore = 0;
                    const answers = team.answers || {};

                    Object.entries(answers).forEach(([qIndex, answer]) => {
                        const question = gameData.quiz.questions[parseInt(qIndex)];
                        if (answer.answer === question.correct) {
                            // Calculate score based on time
                            const responseTime = answer.time - gameData.questionStartTime;
                            const maxTime = gameData.quiz.timePerQuestion * 1000;
                            const baseScore = 1000;
                            const speedBonus = Math.max(0, 500 * (1 - responseTime / maxTime));
                            totalScore += Math.round(baseScore + speedBonus);
                        }
                    });

                    return {
                        id,
                        name: team.name,
                        score: totalScore
                    };
                });

                // Sort by score
                teamScores.sort((a, b) => b.score - a.score);
                setRankings(teamScores);
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [gameId, subscribeToGame]);

    if (!game) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading results...</p>
            </div>
        );
    }

    const getPodiumClass = (index) => {
        if (index === 0) return 'gold';
        if (index === 1) return 'silver';
        if (index === 2) return 'bronze';
        return '';
    };

    const getMedal = (index) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `#${index + 1}`;
    };

    return (
        <div className="game-results-page">
            <div className="results-container">
                {/* Confetti Animation */}
                <div className="confetti-container">
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={i}
                            className="confetti"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 3}s`,
                                backgroundColor: ['#FFD700', '#C0C0C0', '#CD7F32', '#6366f1', '#22c55e'][Math.floor(Math.random() * 5)]
                            }}
                        ></div>
                    ))}
                </div>

                {/* Winner Announcement */}
                <div className="winner-section">
                    <Trophy size={64} className="trophy-icon" />
                    <h1>Game Over!</h1>
                    {rankings[0] && (
                        <div className="winner-card">
                            <span className="winner-emoji">🏆</span>
                            <h2>{rankings[0].name}</h2>
                            <p className="winner-score">{rankings[0].score.toLocaleString()} pts</p>
                            <span className="winner-label">WINNER!</span>
                        </div>
                    )}
                </div>

                {/* Podium */}
                {rankings.length >= 3 && (
                    <div className="podium">
                        {/* Second Place */}
                        <div className="podium-place silver">
                            <div className="place-info">
                                <span className="medal">🥈</span>
                                <span className="team-name">{rankings[1].name}</span>
                                <span className="score">{rankings[1].score.toLocaleString()}</span>
                            </div>
                            <div className="podium-bar"></div>
                        </div>

                        {/* First Place */}
                        <div className="podium-place gold">
                            <div className="place-info">
                                <span className="medal">🥇</span>
                                <span className="team-name">{rankings[0].name}</span>
                                <span className="score">{rankings[0].score.toLocaleString()}</span>
                            </div>
                            <div className="podium-bar"></div>
                        </div>

                        {/* Third Place */}
                        <div className="podium-place bronze">
                            <div className="place-info">
                                <span className="medal">🥉</span>
                                <span className="team-name">{rankings[2].name}</span>
                                <span className="score">{rankings[2].score.toLocaleString()}</span>
                            </div>
                            <div className="podium-bar"></div>
                        </div>
                    </div>
                )}

                {/* Full Leaderboard */}
                <div className="leaderboard">
                    <h3>Final Standings</h3>
                    <div className="leaderboard-list">
                        {rankings.map((team, index) => (
                            <div key={team.id} className={`leaderboard-item ${getPodiumClass(index)}`}>
                                <span className="rank">{getMedal(index)}</span>
                                <span className="team-name">{team.name}</span>
                                <span className="score">{team.score.toLocaleString()} pts</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/host-game')}
                    >
                        <RefreshCw size={20} />
                        Play Again
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => navigate('/dashboard')}
                    >
                        <Home size={20} />
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
}
