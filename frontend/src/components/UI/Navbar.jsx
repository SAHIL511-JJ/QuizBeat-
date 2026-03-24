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
    Moon,
    KeyRound,
    Copy,
    Check,
    RefreshCw
} from 'lucide-react';
import { useState } from 'react';
import { createMcpLoginCode } from '../../services/mcpAuthService';

export default function Navbar() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mcpModalOpen, setMcpModalOpen] = useState(false);
    const [mcpLoading, setMcpLoading] = useState(false);
    const [mcpError, setMcpError] = useState(null);
    const [mcpCodeData, setMcpCodeData] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    const openMcpModal = () => {
        setMcpModalOpen(true);
        setMcpError(null);
        setCopied(false);
    };

    const closeMcpModal = () => {
        setMcpModalOpen(false);
        setMcpError(null);
        setCopied(false);
    };

    const handleGenerateMcpCode = async () => {
        setMcpLoading(true);
        setMcpError(null);
        setCopied(false);
        try {
            const result = await createMcpLoginCode(user);
            setMcpCodeData(result);
        } catch (err) {
            setMcpError(err.message || 'Failed to generate MCP login code.');
        } finally {
            setMcpLoading(false);
        }
    };

    const handleCopyCode = async () => {
        if (!mcpCodeData?.login_code) return;
        try {
            await navigator.clipboard.writeText(mcpCodeData.login_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            setMcpError('Failed to copy login code.');
        }
    };

    return (
        <>
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
                                <button
                                    type="button"
                                    onClick={openMcpModal}
                                    className="mcp-connect-btn"
                                    title="Generate MCP login code"
                                >
                                    <KeyRound size={18} />
                                    <span>MCP</span>
                                </button>

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

            {mcpModalOpen && (
                <div className="mcp-modal-overlay" onClick={closeMcpModal}>
                    <div className="mcp-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="mcp-modal-header">
                            <div>
                                <h3>Connect MCP</h3>
                                <p className="mcp-modal-subtitle">
                                    Generate a one-time code for your IDE or CLI MCP login.
                                </p>
                            </div>
                            <button type="button" className="mcp-close-btn" onClick={closeMcpModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mcp-account-card">
                            <span className="mcp-account-label">Current QuizBeat account</span>
                            <strong>{user.displayName || 'QuizBeat User'}</strong>
                            <span>{user.email}</span>
                        </div>

                        {!mcpCodeData && (
                            <div className="mcp-empty-state">
                                <p>Click generate to create a short-lived login code for MCP.</p>
                            </div>
                        )}

                        {mcpCodeData && (
                            <div className="mcp-code-panel">
                                <div className="mcp-code-box">
                                    <span className="mcp-code-label">One-time login code</span>
                                    <code className="mcp-code-value">{mcpCodeData.login_code}</code>
                                    <button type="button" className="mcp-copy-btn" onClick={handleCopyCode}>
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                        <span>{copied ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>

                                <div className="mcp-code-meta">
                                    <p>Expires at: {new Date(mcpCodeData.expires_at).toLocaleString()}</p>
                                    <p>Use this code once with the MCP `login` tool.</p>
                                </div>
                            </div>
                        )}

                        {mcpError && <div className="error-message">{mcpError}</div>}

                        <div className="mcp-modal-actions">
                            <button
                                type="button"
                                className="mcp-generate-btn"
                                onClick={handleGenerateMcpCode}
                                disabled={mcpLoading}
                            >
                                {mcpLoading ? (
                                    <>
                                        <RefreshCw size={16} className="spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <KeyRound size={16} />
                                        <span>{mcpCodeData ? 'Generate New Code' : 'Generate Code'}</span>
                                    </>
                                )}
                            </button>

                            <button type="button" className="mcp-secondary-btn" onClick={closeMcpModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

