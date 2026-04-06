import PropTypes from 'prop-types';
import React from 'react';

import styles from './template-prompt.css';

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

const EXAMPLES = [
    {
        title: 'Space Game',
        idea: 'a space invaders game with a spaceship and aliens'
    },
    {
        title: 'Dance Party',
        idea: 'a dance party where characters dance to music'
    },
    {
        title: 'Story Time',
        idea: 'an interactive story with talking characters'
    },
    {
        title: 'Art Maker',
        idea: 'a drawing app where you can paint with colors'
    }
];

const STEP_LABELS = [
    'Planning your project...',
    'Creating backdrop...',
    'Creating sprites...',
    'Adding starter code...'
];

const TemplatePromptComponent = props => {
    const {
        error,
        inputValue,
        loading,
        progressStep,
        onClose,
        onExampleClick,
        onInputChange,
        onSubmit
    } = props;

    const handleKeyDown = event => {
        if (event.key === 'Enter' && !loading && inputValue.trim()) {
            onSubmit();
        }
        if (event.key === 'Escape') {
            onClose();
        }
    };

    const handleOverlayClick = event => {
        if (event.target === event.currentTarget && !loading) {
            onClose();
        }
    };

    /* eslint-disable jsx-a11y/no-static-element-interactions */
    return (
        <div
            className={styles.overlay}
            onClick={handleOverlayClick}
            onKeyDown={e => e.stopPropagation()}
            onKeyUp={e => e.stopPropagation()}
        >
            <div className={styles.modal}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <SparkleIcon />
                        {'Start with AI'}
                    </div>
                    {!loading ? (
                        <button
                            className={styles.closeButton}
                            onClick={onClose}
                        >
                            {'\u2715'}
                        </button>
                    ) : null}
                </div>
                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingSpinner} />
                            <div className={styles.loadingText}>
                                {'Building your project...'}
                            </div>
                            <div className={styles.progressSteps}>
                                {STEP_LABELS.map((label, i) => (
                                    <div
                                        key={label}
                                        className={`${styles.progressStep} ${
                                            i === progressStep ? styles.progressStepActive : ''
                                        } ${
                                            i < progressStep ? styles.progressStepDone : ''
                                        }`}
                                    >
                                        <div className={styles.progressDot} />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <React.Fragment>
                            <h2 className={styles.heading}>
                                {'What do you want to make?'}
                            </h2>
                            <input
                                autoFocus
                                className={styles.ideaInput}
                                placeholder="Describe your project idea..."
                                type="text"
                                value={inputValue}
                                onChange={onInputChange}
                                onKeyDown={handleKeyDown}
                            />
                            <p className={styles.examplesLabel}>
                                {'Or try one of these:'}
                            </p>
                            <div className={styles.examplesGrid}>
                                {EXAMPLES.map(example => (
                                    <button
                                        className={styles.exampleCard}
                                        key={example.title}
                                        onClick={() => onExampleClick(example.idea)}
                                    >
                                        <div className={styles.exampleCardTitle}>
                                            {example.title}
                                        </div>
                                        <div className={styles.exampleCardDesc}>
                                            {example.idea}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {error ? (
                                <div className={styles.errorMessage}>
                                    {error}
                                </div>
                            ) : null}
                            <button
                                className={styles.createButton}
                                disabled={!inputValue.trim()}
                                onClick={onSubmit}
                            >
                                <SparkleIcon />
                                {'Create My Project'}
                            </button>
                        </React.Fragment>
                    )}
                </div>
            </div>
        </div>
    );
    /* eslint-enable jsx-a11y/no-static-element-interactions */
};

TemplatePromptComponent.propTypes = {
    error: PropTypes.string,
    inputValue: PropTypes.string,
    loading: PropTypes.bool,
    progressStep: PropTypes.number,
    onClose: PropTypes.func.isRequired,
    onExampleClick: PropTypes.func.isRequired,
    onInputChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired
};

TemplatePromptComponent.defaultProps = {
    error: null,
    inputValue: '',
    loading: false,
    progressStep: 0
};

export default TemplatePromptComponent;
