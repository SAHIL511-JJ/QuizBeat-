import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Loader, Save } from 'lucide-react';
import QuizEditor from '../components/Quiz/QuizEditor';
import { getQuizById, updateQuiz } from '../services/quizService';
import { useAuth } from '../contexts/AuthContext';

export default function EditQuiz() {
    const { quizId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState([]);
    const [difficulty, setDifficulty] = useState('medium');
    const [source, setSource] = useState('ai');
    const [textbook, setTextbook] = useState('');
    const [chapters, setChapters] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        let active = true;

        async function loadQuiz() {
            try {
                const quiz = await getQuizById(quizId);
                if (!active) return;

                if (!quiz) {
                    setError('Quiz not found.');
                    return;
                }
                if (quiz.creatorId !== user?.uid) {
                    setError('You can only edit your own quizzes.');
                    return;
                }

                setTitle(quiz.title || '');
                setQuestions(Array.isArray(quiz.questions) ? quiz.questions : []);
                setDifficulty(quiz.difficulty || 'medium');
                setSource(quiz.source || 'ai');
                setTextbook(quiz.textbook || '');
                setChapters(Array.isArray(quiz.chapters) ? quiz.chapters : []);
            } catch (err) {
                console.error(err);
                if (active) setError('Failed to load quiz.');
            } finally {
                if (active) setLoading(false);
            }
        }

        loadQuiz();
        return () => {
            active = false;
        };
    }, [quizId, user?.uid]);

    const handleSave = async () => {
        if (error) return;

        setSaving(true);
        try {
            await updateQuiz(quizId, {
                title,
                questions,
                difficulty,
                source,
                textbook,
                chapters,
            });
            alert('Quiz updated successfully.');
            navigate('/my-quizzes');
        } catch (err) {
            console.error(err);
            setError('Failed to update quiz.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <Loader className="spinner" size={48} />
                <p>Loading quiz...</p>
            </div>
        );
    }

    return (
        <div className="generate-quiz-page">
            <div className="generate-container">
                <h1>Edit Quiz</h1>
                <p>Update your saved quiz and persist changes.</p>

                {error && (
                    <div className="error-message">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                <QuizEditor
                    title={title}
                    onTitleChange={setTitle}
                    questions={questions}
                    onQuestionsChange={setQuestions}
                    error={error}
                    onError={setError}
                />

                <div className="quiz-actions-row" style={{ marginTop: '1rem' }}>
                    <button
                        className="btn-primary-large"
                        onClick={handleSave}
                        disabled={saving || !!error}
                    >
                        <Save size={20} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                        className="btn-secondary-large"
                        onClick={() => navigate('/my-quizzes')}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
