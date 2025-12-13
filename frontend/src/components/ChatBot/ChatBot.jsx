import { useState } from 'react';
import { MessageCircle, X, ChevronRight, ChevronDown } from 'lucide-react';
import './ChatBot.css';

const faqData = [
    {
        category: "Getting Started",
        icon: "🚀",
        questions: [
            {
                q: "What is QuizBeat?",
                a: "QuizBeat is an AI-powered quiz platform that lets you create quizzes from your textbooks and host multiplayer quiz competitions. Upload your study materials, generate questions automatically, and compete with friends in real-time!"
            },
            {
                q: "How do I create an account?",
                a: "Click the 'Sign In' button in the top-right corner and sign in with your Google account. That's it - no separate registration needed!"
            }
        ]
    },
    {
        category: "Uploading Content",
        icon: "📤",
        questions: [
            {
                q: "How do I upload a textbook?",
                a: "Click 'Upload' in the navigation bar, then drag & drop your file or click to browse. Once selected, click 'Upload & Process' to extract the content."
            },
            {
                q: "What file formats are supported?",
                a: "QuizBeat supports PDF, Word documents (DOCX), and plain text files (TXT). Maximum file size is 50MB."
            },
            {
                q: "Where are my uploaded textbooks stored?",
                a: "Your textbooks are stored locally in your browser. This means they're private to your device and won't sync across different browsers or devices."
            }
        ]
    },
    {
        category: "Quiz Generation",
        icon: "🧠",
        questions: [
            {
                q: "How do I generate a quiz from my textbook?",
                a: "Go to 'Host Game', select 'AI Generated', choose your textbook and chapters, set the difficulty and number of questions, then click 'Generate Quiz'. Our AI will create questions based on your content!"
            },
            {
                q: "Can I create my own custom quiz?",
                a: "Yes! When hosting a game, select 'Custom Quiz' instead of 'AI Generated'. You can then manually add questions, options, and set the correct answers."
            },
            {
                q: "What difficulty levels are available?",
                a: "Three levels: Easy (straightforward questions), Medium (moderately challenging), and Hard (requires deep understanding with tricky distractors)."
            },
            {
                q: "How many questions can I generate?",
                a: "You can generate between 5 and 50 questions per quiz. For AI-generated quizzes, more questions means more variety from your content."
            }
        ]
    },
    {
        category: "Hosting Games",
        icon: "🎮",
        questions: [
            {
                q: "How do I host a multiplayer game?",
                a: "Click 'Host Game', configure your quiz (AI or custom), set the time per question, then click 'Start Game'. You'll get a 6-digit PIN to share with players."
            },
            {
                q: "How do players join my game?",
                a: "Players click 'Join Game', enter the 6-digit game PIN you share with them, type their team name, and they're in! They'll see a waiting screen until you start."
            }
        ]
    },
    {
        category: "Playing & Scoring",
        icon: "🏆",
        questions: [
            {
                q: "How is scoring calculated?",
                a: "Correct answers earn 1000 base points plus a speed bonus (up to 500 extra points). The faster you answer correctly, the more points you get!"
            },
            {
                q: "When do scores update on the leaderboard?",
                a: "Scores update on the host's screen only after the question timer ends - not immediately when you answer. This builds suspense!"
            }
        ]
    },
    {
        category: "Settings",
        icon: "⚙️",
        questions: [
            {
                q: "How do I switch between light and dark mode?",
                a: "Click the sun/moon icon in the top-right corner of the navigation bar to toggle between light and dark themes."
            },
            {
                q: "How do I log out?",
                a: "Click on your profile picture in the top-right corner, then click the logout icon to sign out of your account."
            }
        ]
    }
];

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [selectedQuestion, setSelectedQuestion] = useState(null);

    const toggleCategory = (index) => {
        setExpandedCategory(expandedCategory === index ? null : index);
        setSelectedQuestion(null);
    };

    const selectQuestion = (question) => {
        setSelectedQuestion(question);
    };

    const goBack = () => {
        setSelectedQuestion(null);
    };

    return (
        <div className="chatbot-container">
            {/* Chat Panel */}
            {isOpen && (
                <div className="chatbot-panel">
                    <div className="chatbot-header">
                        <div className="chatbot-title">
                            <span className="chatbot-icon">🤖</span>
                            <span>QuizBeat Help</span>
                        </div>
                        <button className="chatbot-close" onClick={() => setIsOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="chatbot-content">
                        {selectedQuestion ? (
                            <div className="chatbot-answer">
                                <button className="back-btn" onClick={goBack}>
                                    ← Back to questions
                                </button>
                                <div className="question-display">
                                    <strong>{selectedQuestion.q}</strong>
                                </div>
                                <div className="answer-display">
                                    {selectedQuestion.a}
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className="chatbot-intro">How can I help you today?</p>
                                <div className="faq-categories">
                                    {faqData.map((category, index) => (
                                        <div key={index} className="faq-category">
                                            <button
                                                className={`category-header ${expandedCategory === index ? 'expanded' : ''}`}
                                                onClick={() => toggleCategory(index)}
                                            >
                                                <span className="category-icon">{category.icon}</span>
                                                <span className="category-name">{category.category}</span>
                                                {expandedCategory === index ? (
                                                    <ChevronDown size={18} />
                                                ) : (
                                                    <ChevronRight size={18} />
                                                )}
                                            </button>
                                            {expandedCategory === index && (
                                                <div className="category-questions">
                                                    {category.questions.map((q, qIndex) => (
                                                        <button
                                                            key={qIndex}
                                                            className="question-btn"
                                                            onClick={() => selectQuestion(q)}
                                                        >
                                                            {q.q}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                className={`chatbot-fab ${isOpen ? 'hidden' : ''}`}
                onClick={() => setIsOpen(true)}
                aria-label="Open help chat"
            >
                <MessageCircle size={24} />
            </button>
        </div>
    );
}
