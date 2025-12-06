import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { GamepadIcon, Brain, Loader, Users, Clock, BookOpen } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function HostGame() {
    const navigate = useNavigate();
    const { createGame } = useGame();
    const [textbooks, setTextbooks] = useState([]);
    const [selectedTextbook, setSelectedTextbook] = useState(null);
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [quizMode, setQuizMode] = useState('ai'); // 'ai' or 'manual'
    const [difficulty, setDifficulty] = useState('medium');
    const [numQuestions, setNumQuestions] = useState(10);
    const [timePerQuestion, setTimePerQuestion] = useState(20);
    const [gameTitle, setGameTitle] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('textbooks') || '[]');
        setTextbooks(stored);
    }, []);

    const handleChapterToggle = (title) => {
        setSelectedChapters(prev =>
            prev.includes(title) ? prev.filter(c => c !== title) : [...prev, title]
        );
    };

    const handleCreateGame = async () => {
        if (quizMode === 'ai' && (!selectedTextbook || selectedChapters.length === 0)) {
            setError('Please select a textbook and chapters');
            return;
        }

        setCreating(true);
        setError(null);

        try {
            let questions;

            if (quizMode === 'ai') {
                // Generate quiz using AI
                const content = selectedTextbook.chapters
                    .filter(c => selectedChapters.includes(c.title))
                    .map(c => c.content)
                    .join('\n\n');

                const response = await fetch(`${API_URL}/api/quiz/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content,
                        difficulty,
                        num_questions: numQuestions,
                    }),
                });

                if (!response.ok) throw new Error('Failed to generate quiz');
                const quiz = await response.json();
                questions = quiz.questions;
            } else {
                // Use sample questions for demo
                questions = [
                    {
                        question: "What is the capital of France?",
                        options: ["London", "Berlin", "Paris", "Madrid"],
                        correct: 2
                    },
                    {
                        question: "Which planet is known as the Red Planet?",
                        options: ["Venus", "Mars", "Jupiter", "Saturn"],
                        correct: 1
                    }
                ];
            }

            // Create game with Firebase
            const gamePin = await createGame(
                { questions },
                {
                    timePerQuestion,
                    title: gameTitle || 'Quiz Game'
                }
            );

            navigate(`/game/${gamePin}/lobby`);

        } catch (err) {
            setError('Failed to create game. ' + err.message);
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="host-game-page">
            <div className="host-container">
                <h1>
                    <GamepadIcon size={32} />
                    Host a Game
                </h1>
                <p>Create a multiplayer quiz competition</p>

                <div className="game-form">
                    {/* Game Title */}
                    <div className="form-section">
                        <label>Game Title</label>
                        <input
                            type="text"
                            placeholder="Enter a title for your game"
                            value={gameTitle}
                            onChange={(e) => setGameTitle(e.target.value)}
                            className="text-input"
                        />
                    </div>

                    {/* Quiz Mode */}
                    <div className="form-section">
                        <label>Quiz Source</label>
                        <div className="mode-options">
                            <button
                                className={`mode-btn ${quizMode === 'ai' ? 'selected' : ''}`}
                                onClick={() => setQuizMode('ai')}
                            >
                                <Brain size={24} />
                                <span>AI Generated</span>
                                <small>From your textbooks</small>
                            </button>
                            <button
                                className={`mode-btn ${quizMode === 'manual' ? 'selected' : ''}`}
                                onClick={() => setQuizMode('manual')}
                            >
                                <Users size={24} />
                                <span>Sample Quiz</span>
                                <small>Demo questions</small>
                            </button>
                        </div>
                    </div>

                    {quizMode === 'ai' && (
                        <>
                            {/* Textbook Selection */}
                            <div className="form-section">
                                <label>Select Textbook</label>
                                {textbooks.length === 0 ? (
                                    <div className="empty-notice">
                                        <p>No textbooks uploaded. <a href="/upload">Upload one first</a></p>
                                    </div>
                                ) : (
                                    <div className="textbook-grid compact">
                                        {textbooks.map((textbook) => (
                                            <div
                                                key={textbook.id}
                                                className={`textbook-card ${selectedTextbook?.id === textbook.id ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setSelectedTextbook(textbook);
                                                    setSelectedChapters([]);
                                                }}
                                            >
                                                <BookOpen size={20} />
                                                <span>{textbook.filename}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Chapters */}
                            {selectedTextbook && (
                                <div className="form-section">
                                    <label>Select Chapters</label>
                                    <div className="chapters-grid">
                                        {selectedTextbook.chapters.map((ch, i) => (
                                            <div
                                                key={i}
                                                className={`chapter-chip ${selectedChapters.includes(ch.title) ? 'selected' : ''}`}
                                                onClick={() => handleChapterToggle(ch.title)}
                                            >
                                                {ch.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Difficulty */}
                            <div className="form-section">
                                <label>Difficulty</label>
                                <div className="difficulty-options">
                                    {['easy', 'medium', 'hard'].map((level) => (
                                        <button
                                            key={level}
                                            className={`difficulty-btn ${difficulty === level ? 'selected' : ''} ${level}`}
                                            onClick={() => setDifficulty(level)}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Number of Questions */}
                            <div className="form-section">
                                <label>Questions: {numQuestions}</label>
                                <input
                                    type="range"
                                    min="5"
                                    max="20"
                                    value={numQuestions}
                                    onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                                    className="range-slider"
                                />
                            </div>
                        </>
                    )}

                    {/* Time per Question */}
                    <div className="form-section">
                        <label>
                            <Clock size={16} />
                            Time per Question: {timePerQuestion}s
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="30"
                            value={timePerQuestion}
                            onChange={(e) => setTimePerQuestion(parseInt(e.target.value))}
                            className="range-slider"
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    {/* Create Button */}
                    <button
                        className="create-game-btn"
                        onClick={handleCreateGame}
                        disabled={creating}
                    >
                        {creating ? (
                            <>
                                <Loader className="spinner" size={20} />
                                Creating Game...
                            </>
                        ) : (
                            <>
                                <GamepadIcon size={20} />
                                Create Game
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
