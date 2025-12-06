import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { Users, Play, Loader, Copy, CheckCircle } from 'lucide-react';

export default function GameLobby() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { subscribeToGame, startGame, currentGame } = useGame();
    const [game, setGame] = useState(null);
    const [copied, setCopied] = useState(false);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToGame(gameId, (gameData) => {
            setGame(gameData);

            // If game started, redirect to play
            if (gameData.status === 'playing') {
                navigate(`/game/${gameId}/play`);
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [gameId, navigate, subscribeToGame]);

    const isHost = user && game?.hostId === user.uid;
    const teams = game?.teams ? Object.entries(game.teams) : [];

    const copyPin = () => {
        navigator.clipboard.writeText(gameId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStartGame = async () => {
        setStarting(true);
        try {
            await startGame(gameId);
        } catch (err) {
            console.error('Failed to start game:', err);
        } finally {
            setStarting(false);
        }
    };

    if (!game) {
        return (
            <div className="loading-screen">
                <Loader className="spinner" size={48} />
                <p>Loading game...</p>
            </div>
        );
    }

    return (
        <div className="game-lobby-page">
            <div className="lobby-container">
                {/* Game PIN Display */}
                <div className="pin-display">
                    <span className="pin-label">Game PIN</span>
                    <div className="pin-code" onClick={copyPin}>
                        {gameId}
                        {copied ? (
                            <CheckCircle size={24} className="copy-icon success" />
                        ) : (
                            <Copy size={24} className="copy-icon" />
                        )}
                    </div>
                    <span className="join-url">Join at studyquiz.app/join-game</span>
                </div>

                {/* Teams List */}
                <div className="teams-section">
                    <h2>
                        <Users size={24} />
                        Teams Joined ({teams.length})
                    </h2>

                    <div className="teams-grid">
                        {teams.length === 0 ? (
                            <div className="waiting-message">
                                <Loader className="spinner" size={24} />
                                <p>Waiting for teams to join...</p>
                            </div>
                        ) : (
                            teams.map(([teamId, team]) => (
                                <div key={teamId} className="team-card">
                                    <div className="team-avatar">
                                        {team.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="team-name">{team.name}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Host Controls */}
                {isHost && (
                    <div className="host-controls">
                        <p className="host-message">
                            You are the host. Start the game when all teams have joined.
                        </p>
                        <button
                            className="start-game-btn"
                            onClick={handleStartGame}
                            disabled={starting || teams.length === 0}
                        >
                            {starting ? (
                                <>
                                    <Loader className="spinner" size={20} />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Play size={20} />
                                    Start Game ({teams.length} team{teams.length !== 1 ? 's' : ''})
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Player Waiting */}
                {!isHost && (
                    <div className="player-waiting">
                        <Loader className="spinner" size={32} />
                        <p>Waiting for host to start the game...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
