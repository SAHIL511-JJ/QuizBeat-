import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { Users, ArrowRight, Loader, AlertCircle } from 'lucide-react';

export default function JoinGame() {
    const navigate = useNavigate();
    const { joinGame } = useGame();
    const [gamePin, setGamePin] = useState('');
    const [teamName, setTeamName] = useState('');
    const [step, setStep] = useState(1); // 1 = enter PIN, 2 = enter team name
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState(null);

    const handlePinSubmit = (e) => {
        e.preventDefault();
        if (gamePin.length !== 6) {
            setError('Game PIN must be 6 digits');
            return;
        }
        setError(null);
        setStep(2);
    };

    const handleJoinGame = async (e) => {
        e.preventDefault();
        if (!teamName.trim()) {
            setError('Please enter a team name');
            return;
        }

        setJoining(true);
        setError(null);

        try {
            await joinGame(gamePin, teamName.trim());
            navigate(`/game/${gamePin}/lobby`);
        } catch (err) {
            setError(err.message || 'Failed to join game');
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="join-game-page">
            <div className="join-container">
                <div className="join-icon">
                    <Users size={64} />
                </div>
                <h1>Join Game</h1>

                {step === 1 ? (
                    <form onSubmit={handlePinSubmit} className="join-form">
                        <p>Enter the 6-digit game PIN</p>
                        <div className="pin-input-container">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={gamePin}
                                onChange={(e) => setGamePin(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="pin-input"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="error-message">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="join-btn"
                            disabled={gamePin.length !== 6}
                        >
                            Next
                            <ArrowRight size={20} />
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleJoinGame} className="join-form">
                        <p>Game PIN: <strong>{gamePin}</strong></p>
                        <p>Enter your team name</p>

                        <input
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder="Team Name"
                            className="team-input"
                            maxLength={20}
                            autoFocus
                        />

                        {error && (
                            <div className="error-message">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="button-group">
                            <button
                                type="button"
                                className="back-btn"
                                onClick={() => setStep(1)}
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                className="join-btn"
                                disabled={joining || !teamName.trim()}
                            >
                                {joining ? (
                                    <>
                                        <Loader className="spinner" size={20} />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        Join Game
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
