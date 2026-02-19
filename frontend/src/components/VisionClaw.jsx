import { useState, useRef, useEffect, useCallback } from 'react';
import './VisionClaw.css'; // We'll create this CSS file next

const VisionClaw = ({ onCapture, onClose }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const recognitionRef = useRef(null);
    const streamRef = useRef(null); // Use ref to avoid stale closure in cleanup

    const [error, setError] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Helper: stop camera stream
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    // Helper: stop speech recognition
    const stopRecognition = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }
    }, []);

    // Initialize Camera
    useEffect(() => {
        let aborted = false; // Prevents leaked streams from StrictMode double-mount

        const startCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }, // Prefer back camera on mobile
                    audio: false
                });

                // If this effect was already cleaned up (StrictMode), stop immediately
                if (aborted) {
                    mediaStream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = mediaStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                if (!aborted) {
                    console.error("Error accessing camera:", err);
                    setError("Could not access camera. Please allow permissions.");
                }
            }
        };

        startCamera();

        // Cleanup function — uses ref so it always has the real stream
        return () => {
            aborted = true; // Mark so any pending getUserMedia result gets discarded
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
        };
    }, []);

    // Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let interim = '';
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }
                // Update transcript to show live feedback
                setTranscript(prev => {
                    // If we have a final result, append it. Otherwise just show interim.
                    if (final) return (prev + ' ' + final).trim();
                    return prev;
                    // Note: This logic is simplified; for a perfectly robust live transcript 
                    // you might handle interim display separately.
                });
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                if (event.error === 'not-allowed') {
                    setError("Microphone access denied.");
                }
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
                setTranscript(''); // Clear previous transcript on new session
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsProcessing(true);

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current frame
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get base64 string
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        // Strip prefix for backend
        const base64Image = imageDataUrl.split(',')[1];

        // Stop camera & microphone immediately after capturing the frame
        stopCamera();
        stopRecognition();
        setIsListening(false);

        // Return to parent (this will also trigger setShowVision(false) → unmount)
        onCapture({
            image: base64Image,
            text: transcript || "What is this?" // Default prompt if no speech
        });
    };

    return (
        <div className="vision-claw-overlay">
            <div className="vision-claw-container">
                <button className="vision-close-btn" onClick={() => { stopCamera(); stopRecognition(); onClose(); }}>✕</button>

                {error ? (
                    <div className="vision-error">{error}</div>
                ) : (
                    <div className="video-wrapper">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="vision-video"
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Transcript Overlay */}
                        {transcript && (
                            <div className="vision-transcript-overlay">
                                {transcript}
                            </div>
                        )}
                    </div>
                )}

                <div className="vision-controls">
                    <button
                        className={`vision-mic-btn ${isListening ? 'listening' : ''}`}
                        onClick={toggleListening}
                    >
                        {isListening ? '🛑 Stop Listening' : '🎤 Start Speaking'}
                    </button>

                    <button
                        className="vision-capture-btn"
                        onClick={handleCapture}
                        disabled={!!error || isProcessing}
                    >
                        <div className="shutter-inner"></div>
                    </button>

                    <div className="vision-spacers"></div>
                </div>

                <div className="vision-instruction">
                    Look at the object and speak your question, then tap the shutter.
                </div>
            </div>
        </div>
    );
};

export default VisionClaw;
