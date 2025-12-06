import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Upload,
    Brain,
    GamepadIcon,
    History,
    BookOpen,
    ArrowRight,
    Sparkles
} from 'lucide-react';

export default function Dashboard() {
    const { user } = useAuth();

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
                        My Textbooks
                    </h2>
                    <div className="textbook-list">
                        <div className="empty-state">
                            <Upload size={48} />
                            <p>No textbooks uploaded</p>
                            <Link to="/upload" className="btn-link">Upload your first textbook</Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
