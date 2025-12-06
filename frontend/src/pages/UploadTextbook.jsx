import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function UploadTextbook() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = (selectedFile) => {
        const allowedTypes = ['.pdf', '.docx', '.txt'];
        const fileExtension = '.' + selectedFile.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
            setError('Please upload a PDF, Word, or text file');
            return;
        }

        if (selectedFile.size > 50 * 1024 * 1024) {
            setError('File size must be less than 50MB');
            return;
        }

        setFile(selectedFile);
        setError(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            setUploadResult(result);

            // Store in localStorage for demo (in production, save to Firebase)
            const textbooks = JSON.parse(localStorage.getItem('textbooks') || '[]');
            textbooks.push({
                id: Date.now().toString(),
                filename: result.filename,
                chapters: result.chapters,
                fullText: result.full_text,
                uploadedAt: new Date().toISOString()
            });
            localStorage.setItem('textbooks', JSON.stringify(textbooks));

        } catch (err) {
            setError('Failed to upload file. Make sure the backend server is running.');
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    const removeFile = () => {
        setFile(null);
        setUploadResult(null);
    };

    return (
        <div className="upload-page">
            <div className="upload-container">
                <h1>Upload Textbook</h1>
                <p>Upload your PDF, Word, or text files to generate quizzes</p>

                {!uploadResult ? (
                    <>
                        <div
                            className={`drop-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,.txt"
                                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                hidden
                            />

                            {file ? (
                                <div className="file-preview">
                                    <FileText size={48} />
                                    <div className="file-info">
                                        <span className="file-name">{file.name}</span>
                                        <span className="file-size">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </span>
                                    </div>
                                    <button
                                        className="remove-btn"
                                        onClick={(e) => { e.stopPropagation(); removeFile(); }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="drop-content">
                                    <Upload size={48} />
                                    <p>Drag & drop your file here</p>
                                    <span>or click to browse</span>
                                    <span className="supported-formats">
                                        Supports: PDF, DOCX, TXT (max 50MB)
                                    </span>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="error-message">
                                <AlertCircle size={20} />
                                {error}
                            </div>
                        )}

                        <button
                            className="upload-btn"
                            onClick={handleUpload}
                            disabled={!file || uploading}
                        >
                            {uploading ? (
                                <>
                                    <Loader className="spinner" size={20} />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload size={20} />
                                    Upload & Process
                                </>
                            )}
                        </button>
                    </>
                ) : (
                    <div className="upload-success">
                        <CheckCircle size={64} className="success-icon" />
                        <h2>Upload Successful!</h2>
                        <p>{uploadResult.filename} has been processed</p>

                        <div className="upload-stats">
                            <div className="stat">
                                <span className="stat-value">{uploadResult.chapters.length}</span>
                                <span className="stat-label">Chapters Detected</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{(uploadResult.total_chars / 1000).toFixed(1)}k</span>
                                <span className="stat-label">Characters</span>
                            </div>
                        </div>

                        <div className="chapters-list">
                            <h3>Chapters Found:</h3>
                            <ul>
                                {uploadResult.chapters.map((chapter, index) => (
                                    <li key={index}>{chapter.title}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="action-buttons">
                            <button
                                className="btn-primary"
                                onClick={() => navigate('/generate-quiz')}
                            >
                                Generate Quiz
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() => { setFile(null); setUploadResult(null); }}
                            >
                                Upload Another
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
