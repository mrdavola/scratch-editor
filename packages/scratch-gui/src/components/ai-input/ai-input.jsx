import PropTypes from 'prop-types';
import React from 'react';

import styles from './ai-input.css';

const AIInputComponent = props => {
    const {
        error,
        explanation,
        inputValue,
        loading,
        onDismissExplanation,
        onInputChange,
        onSubmit
    } = props;

    const handleKeyDown = event => {
        if (event.key === 'Enter' && !loading) {
            onSubmit();
        }
    };

    return (
        <div className={styles.aiInputWrapper}>
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
                    className={styles.aiInputField}
                    disabled={loading}
                    placeholder="Describe what you want to happen..."
                    type="text"
                    value={inputValue}
                    onChange={onInputChange}
                    onKeyDown={handleKeyDown}
                />
                <button
                    className={styles.aiSubmitButton}
                    disabled={loading || !inputValue.trim()}
                    onClick={onSubmit}
                >
                    {'\u2728'}
                </button>
            </div>
        </div>
    );
};

AIInputComponent.propTypes = {
    error: PropTypes.string,
    explanation: PropTypes.string,
    inputValue: PropTypes.string,
    loading: PropTypes.bool,
    onDismissExplanation: PropTypes.func,
    onInputChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired
};

AIInputComponent.defaultProps = {
    error: null,
    explanation: null,
    inputValue: '',
    loading: false,
    onDismissExplanation: () => {}
};

export default AIInputComponent;
