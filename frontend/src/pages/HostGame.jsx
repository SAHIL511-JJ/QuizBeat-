import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { GamepadIcon, Brain, Loader, Clock, BookOpen, Plus, Trash2, Edit3, Check, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Empty question template
const createEmptyQuestion = () => ({
    question: '',
    options: ['', '', '', ''],
    correct: 0
});

export default function HostGame() {
    const navigate = useNavigate();
    const { createGame } = useGame();
    const [textbooks, setTextbooks] = useState([]);
    const [selectedTextbook, setSelectedTextbook] = useState(null);
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [quizMode, setQuizMode] = useState('ai'); // 'ai' or 'custom'
    const [difficulty, setDifficulty] = useState('medium');
    const [numQuestions, setNumQuestions] = useState(10);
    const [timePerQuestion, setTimePerQuestion] = useState(20);
    const [gameTitle, setGameTitle] = useState('');
    const [creating, setCreating] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    // Custom quiz state
    const [customQuestions, setCustomQuestions] = useState([createEmptyQuestion()]);
    const [editingIndex, setEditingIndex] = useState(null);
    const [showQuizEditor, setShowQuizEditor] = useState(false);

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('textbooks') || '[]');
        setTextbooks(stored);
    }, []);

    const handleChapterToggle = (title) => {
        setSelectedChapters(prev =>
            prev.includes(title) ? prev.filter(c => c !== title) : [...prev, title]
        );
    };

    // Generate AI quiz and show editor
    const handleGenerateQuiz = async () => {
        if (!selectedTextbook || selectedChapters.length === 0) {
            setError('Please select a textbook and chapters');
            return;
        }

        setGenerating(true);
        setError(null);

        try {
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
            setCustomQuestions(quiz.questions);
            setShowQuizEditor(true);
        } catch (err) {
            setError('Failed to generate quiz. ' + err.message);
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    // Update question
    const updateQuestion = (index, field, value) => {
        setCustomQuestions(prev => {
            const updated = [...prev];
            if (field === 'question') {
                updated[index].question = value;
            } else if (field.startsWith('option')) {
                const optionIndex = parseInt(field.replace('option', ''));
                updated[index].options[optionIndex] = value;
            } else if (field === 'correct') {
                updated[index].correct = value;
            }
            return updated;
        });
    };

    // Add new question
    const addQuestion = () => {
        setCustomQuestions(prev => [...prev, createEmptyQuestion()]);
        setEditingIndex(customQuestions.length);
    };

    // Remove question
    const removeQuestion = (index) => {
        if (customQuestions.length <= 1) {
            setError('You need at least one question');
            return;
        }
        setCustomQuestions(prev => prev.filter((_, i) => i !== index));
        if (editingIndex === index) setEditingIndex(null);
    };

    // Validate questions
    const validateQuestions = () => {
        for (let i = 0; i < customQuestions.length; i++) {
            const q = customQuestions[i];
            if (!q.question.trim()) {
                setError(`Question ${i + 1} is empty`);
                return false;
            }
            for (let j = 0; j < q.options.length; j++) {
                if (!q.options[j].trim()) {
                    setError(`Question ${i + 1}, Option ${j + 1} is empty`);
                    return false;
                }
            }
        }
        return true;
    };

    const handleCreateGame = async () => {
        if (quizMode === 'ai' && !showQuizEditor) {
            setError('Please generate the quiz first');
            return;
        }

        if (!validateQuestions()) return;

        setCreating(true);
        setError(null);

        try {
            const gamePin = await createGame(
                { questions: customQuestions },
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
                                onClick={() => { setQuizMode('ai'); setShowQuizEditor(false); setCustomQuestions([createEmptyQuestion()]); }}
                            >
                                <Brain size={24} />
                                <span>AI Generated</span>
                                <small>From your textbooks</small>
                            </button>
                            <button
                                className={`mode-btn ${quizMode === 'custom' ? 'selected' : ''}`}
                                onClick={() => { setQuizMode('custom'); setShowQuizEditor(true); }}
                            >
                                <Edit3 size={24} />
                                <span>Custom Quiz</span>
                                <small>Create your own</small>
                            </button>
                        </div>
                    </div>

                    {quizMode === 'ai' && !showQuizEditor && (
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
                                    <div className="section-header">
                                        <label>Select Chapters</label>
                                        <div className="selection-actions">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedChapters(selectedTextbook.chapters.map(ch => ch.title))}
                                            >
                                                Select All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedChapters([])}
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>
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
                                    max="50"
                                    value={numQuestions}
                                    onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                                    className="range-slider"
                                />
                            </div>

                            {/* Generate Button */}
                            <button
                                className="generate-quiz-btn"
                                onClick={handleGenerateQuiz}
                                disabled={generating || !selectedTextbook || selectedChapters.length === 0}
                            >
                                {generating ? (
                                    <>
                                        <Loader className="spinner" size={20} />
                                        Generating Quiz...
                                    </>
                                ) : (
                                    <>
                                        <Brain size={20} />
                                        Generate Quiz
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>

                {/* Quiz Editor */}
                {showQuizEditor && (
                    <div className="quiz-editor">
                        <div className="editor-header">
                            <h3>
                                <Edit3 size={20} />
                                {quizMode === 'ai' ? 'Edit Generated Quiz' : 'Create Your Quiz'}
                            </h3>
                            <span className="question-count">{customQuestions.length} questions</span>
                        </div>

                        <div className="questions-list">
                            {customQuestions.map((q, qIndex) => (
                                <div key={qIndex} className="question-editor-card">
                                    <div className="question-header">
                                        <span className="q-number">Q{qIndex + 1}</span>
                                        <button
                                            className="delete-q-btn"
                                            onClick={() => removeQuestion(qIndex)}
                                            title="Delete question"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <textarea
                                        className="question-input"
                                        placeholder="Enter your question..."
                                        value={q.question}
                                        onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                                        rows={2}
                                    />

                                    <div className="options-editor">
                                        {q.options.map((opt, optIndex) => (
                                            <div key={optIndex} className="option-row">
                                                <button
                                                    className={`correct-toggle ${q.correct === optIndex ? 'is-correct' : ''}`}
                                                    onClick={() => updateQuestion(qIndex, 'correct', optIndex)}
                                                    title={q.correct === optIndex ? 'Correct answer' : 'Set as correct'}
                                                >
                                                    {q.correct === optIndex ? <Check size={16} /> : <span>{optIndex + 1}</span>}
                                                </button>
                                                <input
                                                    type="text"
                                                    className="option-input"
                                                    placeholder={`Option ${optIndex + 1}`}
                                                    value={opt}
                                                    onChange={(e) => updateQuestion(qIndex, `option${optIndex}`, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="add-question-btn" onClick={addQuestion}>
                            <Plus size={20} />
                            Add Question
                        </button>
                    </div>
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
                        max="60"
                        value={timePerQuestion}
                        onChange={(e) => setTimePerQuestion(parseInt(e.target.value))}
                        className="range-slider"
                    />
                </div>

                {error && <div className="error-message">{error}</div>}

                {/* Create Button */}
                {showQuizEditor && (
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
                )}
            </div>
        </div>
    );
}
