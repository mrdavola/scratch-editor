import PropTypes from 'prop-types';
import React from 'react';

import styles from './remix-suggestions.css';

const RemixSuggestions = props => {
    const {
        suggestions,
        onTrySuggestion,
        onDismiss
    } = props;

    if (!suggestions || suggestions.length === 0) {
        return null;
    }

    return (
        <div className={styles.remixContainer}>
            {suggestions.map((suggestion, index) => (
                <div
                    className={styles.remixWrapper}
                    key={index}
                >
                    <div className={styles.remixCard}>
                        <span className={styles.remixText}>
                            {suggestion}
                        </span>
                        <button
                            className={styles.remixTryButton}
                            onClick={() => onTrySuggestion(suggestion)}
                        >
                            {'Try it'}
                        </button>
                    </div>
                </div>
            ))}
            <button
                className={styles.remixDismiss}
                onClick={onDismiss}
                title="Dismiss suggestions"
            >
                {'\u2715'}
            </button>
        </div>
    );
};

RemixSuggestions.propTypes = {
    onDismiss: PropTypes.func.isRequired,
    onTrySuggestion: PropTypes.func.isRequired,
    suggestions: PropTypes.arrayOf(PropTypes.string)
};

RemixSuggestions.defaultProps = {
    suggestions: []
};

export default RemixSuggestions;
