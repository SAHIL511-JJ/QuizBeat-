import { Check, Plus, Trash2 } from 'lucide-react';

const createEmptyQuestion = () => ({
    question: '',
    options: ['', '', '', ''],
    correct: 0,
});

function validateQuiz(title, questions) {
    if (!title?.trim()) {
        return 'Quiz title is required.';
    }
    if (!Array.isArray(questions) || questions.length < 1) {
        return 'Quiz must contain at least one question.';
    }
    for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        if (!q?.question?.trim()) {
            return `Question ${i + 1} is empty.`;
        }
        if (!Array.isArray(q?.options) || q.options.length !== 4) {
            return `Question ${i + 1} must have exactly 4 options.`;
        }
        for (let j = 0; j < q.options.length; j += 1) {
            if (!q.options[j]?.trim()) {
                return `Question ${i + 1}, Option ${j + 1} is empty.`;
            }
        }
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) {
            return `Question ${i + 1} must have a valid correct option (1-4).`;
        }
    }
    return null;
}

export default function QuizEditor({
    title,
    onTitleChange,
    questions,
    onQuestionsChange,
    error,
    onError,
}) {
    const setValidation = (nextTitle, nextQuestions) => {
        onError?.(validateQuiz(nextTitle, nextQuestions));
    };

    const handleTitleChange = (value) => {
        onTitleChange(value);
        setValidation(value, questions);
    };

    const updateQuestion = (index, field, value) => {
        const updated = [...questions];
        const target = { ...updated[index] };

        if (field === 'question') {
            target.question = value;
        } else if (field === 'correct') {
            target.correct = value;
        } else if (field.startsWith('option')) {
            const optionIndex = Number(field.replace('option', ''));
            const nextOptions = [...target.options];
            nextOptions[optionIndex] = value;
            target.options = nextOptions;
        }

        updated[index] = target;
        onQuestionsChange(updated);
        setValidation(title, updated);
    };

    const addQuestion = () => {
        const updated = [...questions, createEmptyQuestion()];
        onQuestionsChange(updated);
        setValidation(title, updated);
    };

    const removeQuestion = (index) => {
        if (questions.length <= 1) {
            onError?.('Quiz must contain at least one question.');
            return;
        }
        const updated = questions.filter((_, i) => i !== index);
        onQuestionsChange(updated);
        setValidation(title, updated);
    };

    return (
        <div className="quiz-editor">
            <div className="editor-header">
                <h3>Edit Quiz</h3>
                <span className="question-count">{questions.length} questions</span>
            </div>

            <div className="form-section">
                <label>Quiz Title</label>
                <input
                    type="text"
                    className="text-input quiz-title-input"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Enter quiz title"
                />
            </div>

            <div className="questions-list">
                {questions.map((q, qIndex) => (
                    <div key={qIndex} className="question-editor-card">
                        <div className="question-header">
                            <span className="q-number">Q{qIndex + 1}</span>
                            <button
                                type="button"
                                className="delete-q-btn"
                                onClick={() => removeQuestion(qIndex)}
                                title="Delete question"
                                disabled={questions.length <= 1}
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
                                        type="button"
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

            <button type="button" className="add-question-btn" onClick={addQuestion}>
                <Plus size={20} />
                Add Question
            </button>

            {error && <div className="error-message">{error}</div>}
        </div>
    );
}
