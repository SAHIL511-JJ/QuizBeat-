import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    where,
    serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

const QUIZZES_COLLECTION = 'quizzes';

/**
 * Save a quiz to Firestore
 */
export async function saveQuiz({ title, questions, difficulty, source, textbook, chapters, creatorId, creatorName }) {
    console.log('[quizService] saveQuiz called with:', { title, numQ: questions?.length, creatorId, creatorName });
    console.log('[quizService] db instance:', db);
    const quizData = {
        title,
        questions,
        difficulty: difficulty || 'medium',
        numQuestions: questions.length,
        source: source || 'ai',
        textbook: textbook || '',
        chapters: chapters || [],
        creatorId,
        creatorName: creatorName || 'Anonymous',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    console.log('[quizService] About to call addDoc...');
    try {
        const docRef = await addDoc(collection(db, QUIZZES_COLLECTION), quizData);
        console.log('[quizService] saveQuiz SUCCESS, docId:', docRef.id);
        return { id: docRef.id, ...quizData };
    } catch (err) {
        console.error('[quizService] saveQuiz FAILED:', err);
        throw err;
    }
}

/**
 * Get all quizzes for a specific user
 */
export async function getUserQuizzes(userId) {
    console.log('[quizService] getUserQuizzes called for userId:', userId);
    try {
        const q = query(
            collection(db, QUIZZES_COLLECTION),
            where('creatorId', '==', userId)
        );

        console.log('[quizService] About to call getDocs...');
        const snapshot = await getDocs(q);
        console.log('[quizService] getUserQuizzes SUCCESS, count:', snapshot.docs.length);
        const quizzes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
        // Sort client-side (newest first)
        quizzes.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });
        return quizzes;
    } catch (err) {
        console.error('[quizService] getUserQuizzes FAILED:', err);
        throw err;
    }
}

/**
 * Get a single quiz by ID (for sharing)
 */
export async function getQuizById(quizId) {
    console.log('[quizService] getQuizById called for:', quizId);
    try {
        const docRef = doc(db, QUIZZES_COLLECTION, quizId);
        const docSnap = await getDoc(docRef);
        console.log('[quizService] getQuizById result exists:', docSnap.exists());
        if (!docSnap.exists()) {
            return null;
        }
        return { id: docSnap.id, ...docSnap.data() };
    } catch (err) {
        console.error('[quizService] getQuizById FAILED:', err);
        throw err;
    }
}

/**
 * Delete a quiz
 */
export async function deleteQuiz(quizId) {
    await deleteDoc(doc(db, QUIZZES_COLLECTION, quizId));
}

/**
 * Update an existing quiz in Firestore
 */
export async function updateQuiz(quizId, updates) {
    const docRef = doc(db, QUIZZES_COLLECTION, quizId);
    const payload = {
        ...updates,
        updatedAt: serverTimestamp(),
    };

    if (Array.isArray(updates?.questions)) {
        payload.numQuestions = updates.questions.length;
    }

    delete payload.createdAt;
    delete payload.creatorId;
    delete payload.creatorName;

    await updateDoc(docRef, payload);
}
