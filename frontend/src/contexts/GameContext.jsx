import { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { realtimeDb } from '../services/firebase';
import { useAuth } from './AuthContext';

const GameContext = createContext(null);

export function useGame() {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
}

export function GameProvider({ children }) {
    const { user } = useAuth();
    const [currentGame, setCurrentGame] = useState(null);
    const [gameStatus, setGameStatus] = useState(null);
    const [teams, setTeams] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [scores, setScores] = useState({});

    // Generate 6-digit game PIN
    const generateGamePin = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    // Create a new game
    const createGame = async (quiz, settings = {}) => {
        const gamePin = generateGamePin();
        const gameRef = ref(realtimeDb, `games/${gamePin}`);

        const gameData = {
            hostId: user.uid,
            hostName: user.displayName,
            status: 'lobby',
            currentQuestion: -1,
            questionStartTime: null,
            quiz: {
                questions: quiz.questions,
                timePerQuestion: settings.timePerQuestion || 20,
                title: settings.title || 'Quiz Game'
            },
            teams: {},
            createdAt: Date.now()
        };

        await set(gameRef, gameData);
        setCurrentGame({ pin: gamePin, ...gameData });

        return gamePin;
    };

    // Join a game as a team
    const joinGame = async (gamePin, teamName) => {
        const gameRef = ref(realtimeDb, `games/${gamePin}`);

        return new Promise((resolve, reject) => {
            onValue(gameRef, (snapshot) => {
                const game = snapshot.val();
                if (!game) {
                    reject(new Error('Game not found'));
                    return;
                }
                if (game.status !== 'lobby') {
                    reject(new Error('Game has already started'));
                    return;
                }

                // Add team to game
                const teamRef = ref(realtimeDb, `games/${gamePin}/teams/${teamName}`);
                set(teamRef, {
                    name: teamName,
                    score: 0,
                    answers: {},
                    joinedAt: Date.now()
                }).then(() => {
                    setCurrentGame({ pin: gamePin, teamName, ...game });
                    resolve(true);
                }).catch(reject);
            }, { onlyOnce: true });
        });
    };

    // Start the game (host only)
    const startGame = async (gamePin) => {
        await update(ref(realtimeDb, `games/${gamePin}`), {
            status: 'playing',
            currentQuestion: 0,
            questionStartTime: Date.now()
        });
    };

    // Submit answer
    const submitAnswer = async (gamePin, teamName, questionIndex, answer) => {
        const answerTime = Date.now();
        const answerRef = ref(realtimeDb, `games/${gamePin}/teams/${teamName}/answers/${questionIndex}`);

        await set(answerRef, {
            answer,
            time: answerTime
        });
    };

    // Move to next question (host only)
    const nextQuestion = async (gamePin, questionIndex) => {
        await update(ref(realtimeDb, `games/${gamePin}`), {
            currentQuestion: questionIndex,
            questionStartTime: Date.now()
        });
    };

    // End game
    const endGame = async (gamePin) => {
        await update(ref(realtimeDb, `games/${gamePin}`), {
            status: 'finished'
        });
    };

    // Listen to game updates
    const subscribeToGame = (gamePin, callback) => {
        const gameRef = ref(realtimeDb, `games/${gamePin}`);
        return onValue(gameRef, (snapshot) => {
            const game = snapshot.val();
            if (game) {
                callback(game);
            }
        });
    };

    // Calculate score for an answer
    const calculateScore = (isCorrect, responseTime, maxTime) => {
        if (!isCorrect) return 0;

        const baseScore = 1000;
        const speedBonus = Math.max(0, 500 * (1 - responseTime / (maxTime * 1000)));

        return Math.round(baseScore + speedBonus);
    };

    const value = {
        currentGame,
        gameStatus,
        teams,
        currentQuestion,
        scores,
        generateGamePin,
        createGame,
        joinGame,
        startGame,
        submitAnswer,
        nextQuestion,
        endGame,
        subscribeToGame,
        calculateScore
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
}
