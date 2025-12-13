import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
    BookOpen,
    LogOut,
    User,
    Upload,
    GamepadIcon,
    Trophy,
    Menu,
    X,
    Sun,
    Moon
} from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-brand">
                    <BookOpen size={28} />
                    <span>StudyQuiz</span>
                </Link>

                {user && (
                    <>
                        <div className={`navbar-links ${mobileMenuOpen ? 'active' : ''}`}>
                            <Link to="/dashboard" className="nav-link">
                                <Trophy size={18} />
                                Dashboard
                            </Link>
                            <Link to="/upload" className="nav-link">
                                <Upload size={18} />
                                Upload
                            </Link>
                            <Link to="/host-game" className="nav-link">
                                <GamepadIcon size={18} />
                                Host Game
                            </Link>
                            <Link to="/join-game" className="nav-link join-btn">
                                Join Game
                            </Link>
                        </div>

                        <div className="navbar-user">
                            {/* Theme Toggle Button */}
                            <button
                                onClick={toggleTheme}
                                className="theme-toggle-btn"
                                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                            >
                                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                            </button>

                            <div className="user-info">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="user-avatar" />
                                ) : (
                                    <div className="user-avatar-placeholder">
                                        <User size={20} />
                                    </div>
                                )}
                                <span className="user-name">{user.displayName?.split(' ')[0]}</span>
                            </div>
                            <button onClick={handleLogout} className="logout-btn" title="Logout">
                                <LogOut size={18} />
                            </button>
                        </div>

                        <button
                            className="mobile-menu-btn"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
}

