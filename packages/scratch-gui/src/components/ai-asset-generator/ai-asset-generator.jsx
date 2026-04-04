import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';

import styles from './ai-asset-generator.css';

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

const STYLE_OPTIONS = [
    {value: 'cartoon', label: 'Cartoon'},
    {value: 'pixel', label: 'Pixel Art'},
    {value: 'realistic', label: 'Realistic'},
    {value: 'hand-drawn', label: 'Hand-drawn'}
];

const SOUND_TYPE_OPTIONS = [
    {value: 'effect', label: 'Sound Effect'},
    {value: 'music', label: 'Music'}
];

const PLACEHOLDERS = {
    sprite: 'A friendly orange cat wearing a top hat...',
    backdrop: 'A colorful underwater coral reef scene...',
    costume: 'The character jumping with arms raised...',
    sound: 'A laser beam shooting sound effect...'
};

class AIAssetGenerator extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleDescriptionChange',
            'handleStyleChange',
            'handleSoundTypeChange',
            'handleGenerate',
            'handleAdd',
            'handleRetry',
            'handleKeyDown',
            'handleOverlayClick'
        ]);
        this.state = {
            description: '',
            style: 'cartoon',
            soundType: 'effect',
            loading: false,
            error: null,
            previewData: null // base64 PNG or WAV data
        };
    }
    handleDescriptionChange (e) {
        this.setState({description: e.target.value});
    }
    handleStyleChange (e) {
        this.setState({style: e.target.value});
    }
    handleSoundTypeChange (e) {
        this.setState({soundType: e.target.value});
    }
    handleGenerate () {
        const {description, style, soundType} = this.state;
        const {type} = this.props;
        if (!description.trim()) return;

        this.setState({loading: true, error: null, previewData: null});

        const isSound = type === 'sound';
        const generateArg = isSound ? soundType : style;

        this.props.onGenerate(description.trim(), generateArg)
            .then(result => {
                const data = isSound ? result && result.audio : result && result.image;
                if (data) {
                    this.setState({
                        loading: false,
                        previewData: data,
                        error: null
                    });
                } else {
                    const noun = isSound ? 'audio' : 'image';
                    this.setState({
                        loading: false,
                        error: `No ${noun} was returned. Please try again.`
                    });
                }
            })
            .catch(err => {
                this.setState({
                    loading: false,
                    error: err.message || 'Failed to generate. Please try again.'
                });
            });
    }
    handleAdd () {
        const {previewData, description} = this.state;
        if (!previewData) return;
        this.props.onAdd(previewData, description.trim());
        this.props.onClose();
    }
    handleRetry () {
        this.setState({previewData: null, error: null});
    }
    handleKeyDown (e) {
        if (e.key === 'Enter' && !this.state.loading && this.state.description.trim()) {
            this.handleGenerate();
        }
        if (e.key === 'Escape') {
            this.props.onClose();
        }
    }
    handleOverlayClick (e) {
        if (e.target === e.currentTarget) {
            this.props.onClose();
        }
    }
    render () {
        const {title, type, onClose} = this.props;
        const {description, style, soundType, loading, error, previewData} = this.state;
        const isSound = type === 'sound';

        return (
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
                className={styles.modalOverlay}
                onClick={this.handleOverlayClick}
                onKeyDown={e => e.stopPropagation()}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
            >
                <div className={styles.modalContent}>
                    <div className={styles.modalHeader}>
                        <div className={styles.modalTitle}>
                            <SparkleIcon />
                            {title}
                        </div>
                        <button
                            className={styles.closeButton}
                            onClick={onClose}
                        >
                            {'\u2715'}
                        </button>
                    </div>
                    <div className={styles.modalBody}>
                        {loading ? (
                            <div className={styles.loadingContainer}>
                                <div className={styles.loadingSpinner} />
                                <div className={styles.loadingText}>
                                    {'Generating your '}
                                    {type}
                                    {'...'}
                                </div>
                            </div>
                        ) : previewData ? (
                            <div className={styles.previewContainer}>
                                <div className={styles.previewImageWrapper}>
                                    {isSound ? (
                                        <audio
                                            className={styles.previewAudio}
                                            controls
                                            src={`data:audio/wav;base64,${previewData}`}
                                        />
                                    ) : (
                                        <img
                                            className={styles.previewImage}
                                            src={`data:image/png;base64,${previewData}`}
                                            alt={`AI generated ${type}`}
                                        />
                                    )}
                                </div>
                                <div className={styles.previewActions}>
                                    <button
                                        className={styles.addButton}
                                        onClick={this.handleAdd}
                                    >
                                        {'Add to Project'}
                                    </button>
                                    <button
                                        className={styles.retryButton}
                                        onClick={this.handleRetry}
                                    >
                                        {'Try Another'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <React.Fragment>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        {'Description'}
                                    </label>
                                    <textarea
                                        autoFocus
                                        className={styles.descriptionInput}
                                        placeholder={PLACEHOLDERS[type] || 'Describe what you want...'}
                                        rows="3"
                                        value={description}
                                        onChange={this.handleDescriptionChange}
                                        onKeyDown={this.handleKeyDown}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        {isSound ? 'Type' : 'Style'}
                                    </label>
                                    {isSound ? (
                                        <select
                                            className={styles.styleSelect}
                                            value={soundType}
                                            onChange={this.handleSoundTypeChange}
                                        >
                                            {SOUND_TYPE_OPTIONS.map(opt => (
                                                <option
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select
                                            className={styles.styleSelect}
                                            value={style}
                                            onChange={this.handleStyleChange}
                                        >
                                            {STYLE_OPTIONS.map(opt => (
                                                <option
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                {error ? (
                                    <div className={styles.errorMessage}>
                                        {error}
                                    </div>
                                ) : null}
                                <button
                                    className={styles.generateButton}
                                    disabled={!description.trim()}
                                    onClick={this.handleGenerate}
                                >
                                    <SparkleIcon />
                                    {'Generate'}
                                </button>
                            </React.Fragment>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

AIAssetGenerator.propTypes = {
    onAdd: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onGenerate: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['sprite', 'backdrop', 'costume', 'sound']).isRequired
};

export default AIAssetGenerator;
