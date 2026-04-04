import PropTypes from 'prop-types';
import React from 'react';

import styles from './ai-input.css';

const SparkleIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z"
            fill="currentColor"
        />
    </svg>
);

const SendIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M3 20V4L22 12L3 20ZM5 17L16.85 12L5 7V10.5L11 12L5 13.5V17Z"
            fill="currentColor"
        />
    </svg>
);

const MicIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
            fill="currentColor"
        />
    </svg>
);

const AIInputComponent = props => {
    const {
        error,
        explanation,
        inputValue,
        isListening,
        isOpen,
        loading,
        onClose,
        onDismissExplanation,
        onInputChange,
        onMicClick,
        onOpen,
        onSubmit,
        voiceSupported
    } = props;

    const handleKeyDown = event => {
        if (event.key === 'Enter' && !loading) {
            onSubmit();
        }
        if (event.key === 'Escape') {
            onClose();
        }
    };

    // Collapsed state: show just the FAB button
    if (!isOpen) {
        return (
            <button
                className={`${styles.aiFab} ${loading ? styles.aiFabLoading : ''}`}
                onClick={loading ? null : onOpen}
                title="AI Assistant"
            >
                <SparkleIcon />
            </button>
        );
    }

    // Expanded state: show the chat panel
    return (
        <div className={styles.aiPanel}>
            {explanation ? (
                <div className={styles.aiExplanation}>
                    {explanation}
                    <button
                        className={styles.aiDismiss}
                        onClick={onDismissExplanation}
                    >
                        {'\u2715'}
                    </button>
                </div>
            ) : null}
            {error ? (
                <div className={styles.aiError}>
                    {error}
                </div>
            ) : null}
            {loading ? (
                <div className={styles.aiLoadingBar} />
            ) : null}
            <div className={styles.aiInputRow}>
                <input
                    autoFocus
                    className={styles.aiInputField}
                    disabled={loading}
                    placeholder="Describe what you want to happen..."
                    type="text"
                    value={inputValue}
                    onChange={onInputChange}
                    onKeyDown={handleKeyDown}
                />
                {voiceSupported ? (
                    <button
                        className={`${styles.aiMicButton} ${isListening ? styles.aiMicListening : ''}`}
                        disabled={loading}
                        onClick={onMicClick}
                        title={isListening ? 'Listening...' : 'Voice input'}
                    >
                        <MicIcon />
                    </button>
                ) : null}
                <button
                    className={styles.aiSendButton}
                    disabled={loading || !inputValue.trim()}
                    onClick={onSubmit}
                >
                    <SendIcon />
                </button>
                <button
                    className={styles.aiCloseButton}
                    onClick={onClose}
                >
                    {'\u2715'}
                </button>
            </div>
        </div>
    );
};

AIInputComponent.propTypes = {
    error: PropTypes.string,
    explanation: PropTypes.string,
    inputValue: PropTypes.string,
    isListening: PropTypes.bool,
    isOpen: PropTypes.bool,
    loading: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onDismissExplanation: PropTypes.func,
    onInputChange: PropTypes.func.isRequired,
    onMicClick: PropTypes.func,
    onOpen: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    voiceSupported: PropTypes.bool
};

AIInputComponent.defaultProps = {
    error: null,
    explanation: null,
    inputValue: '',
    isListening: false,
    isOpen: false,
    loading: false,
    onDismissExplanation: () => {},
    onMicClick: () => {},
    voiceSupported: false
};

export default AIInputComponent;
