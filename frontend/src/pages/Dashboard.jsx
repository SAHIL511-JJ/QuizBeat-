import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Upload,
    Brain,
    GamepadIcon,
    History,
    BookOpen,
    ArrowRight,
    Sparkles,
    Trash2,
    FileText
} from 'lucide-react';

export default function Dashboard() {
    const { user } = useAuth();
    const [textbooks, setTextbooks] = useState([]);

    useEffect(() => {
        loadTextbooks();
    }, []);

    const loadTextbooks = () => {
        const stored = JSON.parse(localStorage.getItem('textbooks') || '[]');
        setTextbooks(stored);
    };

    const handleDeleteTextbook = (textbookId) => {
        if (!confirm('Are you sure you want to delete this textbook?')) return;

        const updated = textbooks.filter(t => t.id !== textbookId);
        localStorage.setItem('textbooks', JSON.stringify(updated));
        setTextbooks(updated);
    };

    const actions = [
        {
            title: 'Upload Textbook',
            description: 'Upload PDF or Word files to generate quizzes',
            icon: Upload,
            link: '/upload',
            color: 'primary'
        },
        {
            title: 'Generate Quiz',
            description: 'Create AI-powered quizzes from your textbooks',
            icon: Brain,
            link: '/generate-quiz',
            color: 'secondary'
        },
        {
            title: 'Host Game',
            description: 'Create a multiplayer quiz competition',
            icon: GamepadIcon,
            link: '/host-game',
            color: 'success'
        },
        {
            title: 'Join Game',
            description: 'Enter a game PIN to join a quiz',
            icon: Sparkles,
            link: '/join-game',
            color: 'warning'
        }
    ];

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>Welcome back, {user?.displayName?.split(' ')[0]}! 👋</h1>
                <p>Ready to learn something new today?</p>
            </div>

            <div className="quick-actions">
                <h2>Quick Actions</h2>
                <div className="actions-grid">
                    {actions.map((action) => (
                        <Link
                            key={action.title}
                            to={action.link}
                            className={`action-card ${action.color}`}
                        >
                            <div className="action-icon">
                                <action.icon size={32} />
                            </div>
                            <div className="action-content">
                                <h3>{action.title}</h3>
                                <p>{action.description}</p>
                            </div>
                            <ArrowRight className="action-arrow" size={20} />
                        </Link>
                    ))}
                </div>
            </div>

            <div className="dashboard-sections">
                <section className="recent-activity">
                    <h2>
                        <History size={20} />
                        Recent Activity
                    </h2>
                    <div className="activity-list">
                        <div className="empty-state">
                            <BookOpen size={48} />
                            <p>No recent activity yet</p>
                            <span>Upload a textbook to get started!</span>
                        </div>
                    </div>
                </section>

                <section className="my-textbooks">
                    <h2>
                        <BookOpen size={20} />
                        My Textbooks ({textbooks.length})
                    </h2>
                    <div className="textbook-list">
                        {textbooks.length === 0 ? (
                            <div className="empty-state">
                                <Upload size={48} />
                                <p>No textbooks uploaded</p>
                                <Link to="/upload" className="btn-link">Upload your first textbook</Link>
                            </div>
                        ) : (
                            <div className="textbooks-items">
                                {textbooks.map((textbook) => (
                                    <div key={textbook.id} className="textbook-item">
                                        <div className="textbook-icon">
                                            <FileText size={24} />
                                        </div>
                                        <div className="textbook-info">
                                            <span className="textbook-name">{textbook.filename}</span>
                                            <span className="textbook-meta">
                                                {textbook.chapters?.length || 0} chapters •
                                                {new Date(textbook.uploadedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <button
                                            className="delete-textbook-btn"
                                            onClick={() => handleDeleteTextbook(textbook.id)}
                                            title="Delete textbook"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
