import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from '@scratch/scratch-vm';
import {connect} from 'react-redux';

import RemixSuggestionsComponent from '../components/remix-suggestions/remix-suggestions.jsx';
import {extractProjectContext} from '../lib/ai-context.js';
import {suggestRemix} from '../lib/ai-api-client.js';
import {setAIInputVisible} from '../reducers/ai-state.js';

const TRIGGER_DELAY_MS = 3000;

class RemixSuggestions extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleProjectRunStart',
            'handleProjectRunStop',
            'handleTrySuggestion',
            'handleDismiss'
        ]);
        this.state = {
            suggestions: [],
            visible: false
        };
        this._timer = null;
        this._triggered = false;
        this._boundRunStart = null;
        this._boundRunStop = null;
    }
    componentDidMount () {
        if (this.props.vm && this.props.vm.runtime) {
            this.props.vm.runtime.on('PROJECT_RUN_START', this.handleProjectRunStart);
            this.props.vm.runtime.on('PROJECT_RUN_STOP', this.handleProjectRunStop);
        }
    }
    componentWillUnmount () {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        if (this.props.vm && this.props.vm.runtime) {
            this.props.vm.runtime.removeListener('PROJECT_RUN_START', this.handleProjectRunStart);
            this.props.vm.runtime.removeListener('PROJECT_RUN_STOP', this.handleProjectRunStop);
        }
    }
    handleProjectRunStart () {
        if (this._triggered) return;

        this._timer = setTimeout(() => {
            this._triggered = true;
            const context = extractProjectContext(this.props.vm);
            suggestRemix(context)
                .then(result => {
                    if (result && result.suggestions && result.suggestions.length > 0) {
                        this.setState({
                            suggestions: result.suggestions.slice(0, 3),
                            visible: true
                        });
                    }
                })
                .catch(() => {
                    // Silently fail - suggestions are non-critical
                });
        }, TRIGGER_DELAY_MS);
    }
    handleProjectRunStop () {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }
    handleTrySuggestion (suggestion) {
        this.setState({visible: false, suggestions: []});
        // Feed the suggestion into the AI input by dispatching events
        // The AI input container will pick up the input value
        if (this.props.onTrySuggestion) {
            this.props.onTrySuggestion(suggestion);
        }
    }
    handleDismiss () {
        this.setState({visible: false, suggestions: []});
    }
    render () {
        if (!this.state.visible) return null;
        return (
            <RemixSuggestionsComponent
                suggestions={this.state.suggestions}
                onTrySuggestion={this.handleTrySuggestion}
                onDismiss={this.handleDismiss}
            />
        );
    }
}

RemixSuggestions.propTypes = {
    onTrySuggestion: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = () => ({});

const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(RemixSuggestions);
