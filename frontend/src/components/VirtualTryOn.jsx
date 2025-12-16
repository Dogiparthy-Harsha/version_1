import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const VirtualTryOn = () => {
    const { token } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [clothingImage, setClothingImage] = useState(null);
    const [avatarImage, setAvatarImage] = useState(null);
    const [resultImage, setResultImage] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (type === 'clothing') setClothingImage(file);
            else setAvatarImage(file);
        }
    };

    const API_URL = 'http://127.0.0.1:8000';

    const handleTryOn = async () => {
        if (!clothingImage || !avatarImage) {
            setError('Please upload both images.');
            return;
        }

        setIsProcessing(true);
        setError('');

        const formData = new FormData();
        formData.append('clothing_image', clothingImage);
        formData.append('avatar_image', avatarImage);

        try {
            const response = await axios.post(`${API_URL}/virtual-try-on`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                },
                responseType: 'blob' // We expect an image back
            });

            const imageUrl = URL.createObjectURL(response.data);
            setResultImage(imageUrl);
        } catch (err) {
            console.error('Try-on failed:', err);
            setError('Virtual try-on failed. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const closeAndReset = () => {
        setIsOpen(false);
        setResultImage(null);
        setClothingImage(null);
        setAvatarImage(null);
        setError('');
    };

    if (!isOpen) {
        return (
            <button
                className="virtual-try-on-fab"
                onClick={() => setIsOpen(true)}
                title="Virtual Try-On"
            >
                👔
            </button>
        );
    }

    return (
        <div className="virtual-try-on-overlay">
            <div className="virtual-try-on-modal">
                <button className="close-btn" onClick={closeAndReset}>×</button>
                <h2>Virtual Try-On (Beta)</h2>
                <p>Using Google Nano Banana 3</p>

                {error && <div className="error-message">{error}</div>}

                <div className="upload-section">
                    <div className="upload-box">
                        <label>1. Clothing Item</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'clothing')}
                        />
                        {clothingImage && <div className="file-name">{clothingImage.name}</div>}
                    </div>

                    <div className="upload-box">
                        <label>2. Your Photo</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'avatar')}
                        />
                        {avatarImage && <div className="file-name">{avatarImage.name}</div>}
                    </div>
                </div>

                <button
                    className="try-on-btn"
                    onClick={handleTryOn}
                    disabled={isProcessing || !clothingImage || !avatarImage}
                >
                    {isProcessing ? 'Processing with Nano Banana 3...' : 'Magic Try-On ✨'}
                </button>

                {isProcessing && <div className="loader">Running AI Model...</div>}

                {resultImage && (
                    <div className="result-section">
                        <h3>Result:</h3>
                        <img src={resultImage} alt="Virtual Try-On Result" className="result-img" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default VirtualTryOn;
