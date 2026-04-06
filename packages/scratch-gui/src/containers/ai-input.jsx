import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from '@scratch/scratch-vm';
import {connect} from 'react-redux';

import AIInputComponent from '../components/ai-input/ai-input.jsx';
import TemplatePrompt from './template-prompt.jsx';
import {extractProjectContext} from '../lib/ai-context.js';
import {generateBlocks} from '../lib/ai-api-client.js';
import {injectGeneratedBlocks, injectMultiSpriteBlocks} from '../lib/ai-block-injector.js';
import {startVoiceInput, isVoiceSupported} from '../lib/voice-input.js';
import {
    setAILoading,
    setAIResult,
    setAIError,
    addConversationMessage
} from '../reducers/ai-state';

class AIInput extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClose',
            'handleDismissExplanation',
            'handleInputChange',
            'handleMicClick',
            'handleOpen',
            'handleSubmit',
            'handleSetInputValue',
            'handleOpenTemplate',
            'handleCloseTemplate'
        ]);
        this.state = {
            inputValue: '',
            explanation: null,
            isOpen: false,
            isListening: false,
            templateOpen: false
        };
        this._recognition = null;
    }
    handleClose () {
        this.setState({isOpen: false});
    }
    handleDismissExplanation () {
        this.setState({explanation: null});
    }
    handleInputChange (e) {
        this.setState({inputValue: e.target.value});
    }
    handleMicClick () {
        if (this.state.isListening) {
            if (this._recognition) {
                this._recognition.stop();
                this._recognition = null;
            }
            this.setState({isListening: false});
            return;
        }
        this.setState({isListening: true});
        this._recognition = startVoiceInput(
            transcript => {
                this.setState({inputValue: transcript, isListening: false});
                this._recognition = null;
            },
            () => {
                this.setState({isListening: false});
                this._recognition = null;
            }
        );
    }
    handleOpen () {
        this.setState({isOpen: true});
    }
    handleOpenTemplate () {
        this.setState({templateOpen: true, isOpen: false});
    }
    handleCloseTemplate () {
        this.setState({templateOpen: false});
    }
    handleSetInputValue (value) {
        this.setState({inputValue: value, isOpen: true});
    }
    handleSubmit () {
        const prompt = this.state.inputValue.trim();
        if (!prompt || this.props.loading) return;

        this.setState({explanation: null});
        this.props.onSetLoading(true);
        this.props.onClearError();

        this.props.onAddMessage({role: 'user', content: prompt});

        const context = extractProjectContext(this.props.vm);

        generateBlocks(prompt, context, this.props.conversationHistory)
            .then(result => {
                if (result.success) {
                    const success = result.spriteBlocks
                        ? injectMultiSpriteBlocks(this.props.vm, result)
                        : injectGeneratedBlocks(this.props.vm, result);
                    if (success) {
                        this.props.onSetResult(result);
                        this.props.onAddMessage({
                            role: 'assistant',
                            content: result.explanation || 'Blocks generated.'
                        });
                        this.setState({
                            inputValue: '',
                            explanation: result.explanation || null
                        });
                    } else {
                        this.props.onSetError('Failed to inject blocks into workspace.');
                    }
                } else {
                    this.props.onSetError(result.message || 'Something went wrong.');
                }
            })
            .catch(err => {
                this.props.onSetError(err.message || 'Something went wrong.');
            })
            .finally(() => {
                this.props.onSetLoading(false);
            });
    }
    render () {
        return (
            <React.Fragment>
                <AIInputComponent
                    error={this.props.error}
                    explanation={this.state.explanation}
                    inputValue={this.state.inputValue}
                    isListening={this.state.isListening}
                    isOpen={this.state.isOpen}
                    loading={this.props.loading}
                    onClose={this.handleClose}
                    onDismissExplanation={this.handleDismissExplanation}
                    onInputChange={this.handleInputChange}
                    onMicClick={this.handleMicClick}
                    onOpen={this.handleOpen}
                    onOpenTemplate={this.handleOpenTemplate}
                    onSubmit={this.handleSubmit}
                    voiceSupported={isVoiceSupported()}
                />
                {this.state.templateOpen ? (
                    <TemplatePrompt
                        vm={this.props.vm}
                        onClose={this.handleCloseTemplate}
                    />
                ) : null}
            </React.Fragment>
        );
    }
}

AIInput.propTypes = {
    conversationHistory: PropTypes.arrayOf(PropTypes.shape({
        role: PropTypes.string,
        content: PropTypes.string
    })),
    error: PropTypes.string,
    loading: PropTypes.bool.isRequired,
    onAddMessage: PropTypes.func.isRequired,
    onClearError: PropTypes.func.isRequired,
    onSetError: PropTypes.func.isRequired,
    onSetLoading: PropTypes.func.isRequired,
    onSetResult: PropTypes.func.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    loading: state.scratchGui.aiState.loading,
    error: state.scratchGui.aiState.error,
    conversationHistory: state.scratchGui.aiState.conversationHistory
});

const mapDispatchToProps = dispatch => ({
    onSetLoading: loading => dispatch(setAILoading(loading)),
    onSetResult: result => dispatch(setAIResult(result)),
    onSetError: error => dispatch(setAIError(error)),
    onClearError: () => dispatch(setAIError(null)),
    onAddMessage: message => dispatch(addConversationMessage(message))
});

export default connect(mapStateToProps, mapDispatchToProps)(AIInput);
