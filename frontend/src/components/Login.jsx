import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../App.css';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState('');
    const { login, register } = useAuth();

    const validatePassword = (pwd) => {
        if (pwd.length < 8) return "Password must be at least 8 characters long";
        if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter";
        if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter";
        if (!/\d/.test(pwd)) return "Password must contain at least one number";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return "Password must contain at least one special character";
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (isRegistering) {
            if (password !== confirmPassword) {
                setError("Passwords do not match");
                return;
            }
            const pwdError = validatePassword(password);
            if (pwdError) {
                setError(pwdError);
                return;
            }
        }

        let success;
        if (isRegistering) {
            success = await register(username, password);
        } else {
            success = await login(username, password);
        }

        if (!success) {
            setError(isRegistering ? 'Registration failed. Username may be taken.' : 'Login failed. Check credentials.');
        }
    };

    return (
        <div className="app">
            <header className="header">
                <h1>🛍️ AI Shopping Assistant</h1>
                <p>Login to access your personalized shopping history</p>
            </header>

            <div className="container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="chat-container" style={{ height: 'auto', minWidth: '400px', padding: '2rem' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
                        {isRegistering ? 'Create Account' : 'Welcome Back'}
                    </h2>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="message-input"
                                style={{ width: '100%' }}
                                required
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="message-input"
                                style={{ width: '100%' }}
                                required
                            />
                        </div>

                        {isRegistering && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="message-input"
                                    style={{ width: '100%' }}
                                    required
                                />
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    Password must be 8+ chars, include uppercase, lowercase, number, and special char.
                                </div>
                            </div>
                        )}

                        {!isRegistering && <div style={{ marginBottom: '1.5rem' }}></div>}

                        {error && (
                            <div style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="send-button" style={{ width: '100%', marginBottom: '1rem' }}>
                            {isRegistering ? 'Register' : 'Login'}
                        </button>

                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRegistering(!isRegistering);
                                    setError('');
                                    setConfirmPassword('');
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                {isRegistering ? 'Login here' : 'Register here'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
