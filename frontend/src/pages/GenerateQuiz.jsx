import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, BookOpen, Loader, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function GenerateQuiz() {
    const [textbooks, setTextbooks] = useState([]);
    const [selectedTextbook, setSelectedTextbook] = useState(null);
    const [selectedChapters, setSelectedChapters] = useState([]);
    const [difficulty, setDifficulty] = useState('medium');
    const [numQuestions, setNumQuestions] = useState(10);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Load textbooks from localStorage (in production, fetch from Firebase)
        const stored = JSON.parse(localStorage.getItem('textbooks') || '[]');
        setTextbooks(stored);
    }, []);

    const handleChapterToggle = (chapterTitle) => {
        setSelectedChapters(prev =>
            prev.includes(chapterTitle)
                ? prev.filter(c => c !== chapterTitle)
                : [...prev, chapterTitle]
        );
    };

    const selectAllChapters = () => {
        if (selectedTextbook) {
            setSelectedChapters(selectedTextbook.chapters.map(c => c.title));
        }
    };

    const deselectAllChapters = () => {
        setSelectedChapters([]);
    };

    const handleGenerate = async () => {
        if (!selectedTextbook || selectedChapters.length === 0) {
            setError('Please select a textbook and at least one chapter');
            return;
        }

        setGenerating(true);
        setError(null);

        // Get content from selected chapters
        const content = selectedTextbook.chapters
            .filter(c => selectedChapters.includes(c.title))
            .map(c => c.content)
            .join('\n\n');

        // DEBUG: Log what we're sending
        console.log('=== DEBUG: Quiz Generation Request ===');
        console.log('Selected textbook:', selectedTextbook);
        console.log('Selected chapters:', selectedChapters);
        console.log('Content length:', content.length);
        console.log('Content preview:', content.substring(0, 200));
        console.log('Full request:', { content, difficulty, num_questions: numQuestions });

        try {
            const response = await fetch(`${API_URL}/api/quiz/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content,
                    difficulty,
                    num_questions: numQuestions,
                }),
            });

            console.log('Response status:', response.status);
            const responseText = await response.text();
            console.log('Response body:', responseText);

            if (!response.ok) {
                throw new Error(`Failed to generate quiz: ${responseText}`);
            }

            const quiz = JSON.parse(responseText);

            // Store quiz for taking
            const quizId = Date.now().toString();
            const quizData = {
                id: quizId,
                questions: quiz.questions,
                difficulty: quiz.difficulty,
                textbook: selectedTextbook.filename,
                chapters: selectedChapters,
                createdAt: new Date().toISOString()
            };

            const quizzes = JSON.parse(localStorage.getItem('quizzes') || '[]');
            quizzes.push(quizData);
            localStorage.setItem('quizzes', JSON.stringify(quizzes));
            localStorage.setItem('currentQuiz', JSON.stringify(quizData));

            navigate(`/take-quiz/${quizId}`);

        } catch (err) {
            setError('Failed to generate quiz. Make sure the backend server is running and your Groq API key is configured.');
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="generate-quiz-page">
            <div className="generate-container">
                <h1>
                    <Brain size={32} />
                    Generate Quiz
                </h1>
                <p>Create an AI-powered quiz from your uploaded textbooks</p>

                {textbooks.length === 0 ? (
                    <div className="empty-state">
                        <BookOpen size={64} />
                        <h2>No Textbooks Found</h2>
                        <p>Upload a textbook first to generate quizzes</p>
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/upload')}
                        >
                            Upload Textbook
                        </button>
                    </div>
                ) : (
                    <div className="quiz-form">
                        {/* Textbook Selection */}
                        <div className="form-section">
                            <label>Select Textbook</label>
                            <div className="textbook-grid">
                                {textbooks.map((textbook) => (
                                    <div
                                        key={textbook.id}
                                        className={`textbook-card ${selectedTextbook?.id === textbook.id ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSelectedTextbook(textbook);
                                            setSelectedChapters([]);
                                        }}
                                    >
                                        <BookOpen size={24} />
                                        <span className="textbook-name">{textbook.filename}</span>
                                        <span className="chapter-count">
                                            {textbook.chapters.length} chapters
                                        </span>
                                        {selectedTextbook?.id === textbook.id && (
                                            <CheckCircle className="selected-icon" size={20} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chapter Selection */}
                        {selectedTextbook && (
                            <div className="form-section">
                                <div className="section-header">
                                    <label>Select Chapters</label>
                                    <div className="selection-actions">
                                        <button onClick={selectAllChapters}>Select All</button>
                                        <button onClick={deselectAllChapters}>Clear</button>
                                    </div>
                                </div>
                                <div className="chapters-grid">
                                    {selectedTextbook.chapters.map((chapter, index) => (
                                        <div
                                            key={index}
                                            className={`chapter-chip ${selectedChapters.includes(chapter.title) ? 'selected' : ''}`}
                                            onClick={() => handleChapterToggle(chapter.title)}
                                        >
                                            {selectedChapters.includes(chapter.title) && (
                                                <CheckCircle size={16} />
                                            )}
                                            {chapter.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Difficulty Selection */}
                        <div className="form-section">
                            <label>Difficulty Level</label>
                            <div className="difficulty-options">
                                {['easy', 'medium', 'hard'].map((level) => (
                                    <button
                                        key={level}
                                        className={`difficulty-btn ${difficulty === level ? 'selected' : ''} ${level}`}
                                        onClick={() => setDifficulty(level)}
                                    >
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Number of Questions */}
                        <div className="form-section">
                            <label>Number of Questions: {numQuestions}</label>
                            <input
                                type="range"
                                min="5"
                                max="30"
                                value={numQuestions}
                                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                                className="range-slider"
                            />
                            <div className="range-labels">
                                <span>5</span>
                                <span>30</span>
                            </div>
                        </div>

                        {error && (
                            <div className="error-message">
                                <AlertCircle size={20} />
                                {error}
                            </div>
                        )}

                        {/* Generate Button */}
                        <button
                            className="generate-btn"
                            onClick={handleGenerate}
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
                                    Generate {numQuestions} Questions
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
