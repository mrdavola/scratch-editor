import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from '@scratch/scratch-vm';

import TemplatePromptComponent from '../components/template-prompt/template-prompt.jsx';
import {generateTemplate, generateBackdrop, generateSprite, generateBlocks} from '../lib/ai-api-client.js';
import {addAIBackdrop} from '../lib/ai-backdrop-injector.js';
import {addAISprite} from '../lib/ai-sprite-injector.js';
import {injectGeneratedBlocks} from '../lib/ai-block-injector.js';

class TemplatePrompt extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClose',
            'handleExampleClick',
            'handleInputChange',
            'handleSubmit'
        ]);
        this.state = {
            inputValue: '',
            loading: false,
            error: null,
            progressStep: 0
        };
    }
    handleClose () {
        if (!this.state.loading) {
            this.props.onClose();
        }
    }
    handleExampleClick (idea) {
        this.setState({inputValue: idea});
    }
    handleInputChange (e) {
        this.setState({inputValue: e.target.value});
    }
    handleSubmit () {
        const idea = this.state.inputValue.trim();
        if (!idea || this.state.loading) return;

        this.setState({loading: true, error: null, progressStep: 0});

        generateTemplate(idea)
            .then(result => {
                if (!result.success) {
                    throw new Error(result.error || 'Failed to generate template');
                }
                return result.template;
            })
            .then(template => this.buildProject(template))
            .then(() => {
                this.setState({loading: false});
                this.props.onClose();
            })
            .catch(err => {
                this.setState({
                    loading: false,
                    error: err.message || 'Something went wrong. Please try again.'
                });
            });
    }
    async buildProject (template) {
        const {vm} = this.props;

        // Step 1: Generate and add backdrop
        this.setState({progressStep: 1});
        try {
            const backdropResult = await generateBackdrop(template.backdrop);
            if (backdropResult.success && backdropResult.image) {
                await addAIBackdrop(vm, backdropResult.image, 'AI Backdrop');
            }
        } catch (err) {
            console.warn('[Template] Backdrop generation failed:', err.message);
        }

        // Step 2: Generate and add sprites
        this.setState({progressStep: 2});
        const spriteNames = [];
        for (let i = 0; i < template.sprites.length; i++) {
            try {
                const spriteResult = await generateSprite(template.sprites[i]);
                if (spriteResult.success && spriteResult.image) {
                    const name = `Sprite ${i + 1}`;
                    await addAISprite(vm, spriteResult.image, name);
                    spriteNames.push(name);
                }
            } catch (err) {
                console.warn(`[Template] Sprite ${i + 1} generation failed:`, err.message);
            }
        }

        // Step 3: Generate and inject starter code for each sprite
        this.setState({progressStep: 3});
        const targets = vm.runtime.targets.filter(t => t.isOriginal && !t.isStage);
        for (const target of targets) {
            try {
                // Set the editing target so blocks inject into the right sprite
                vm.setEditingTarget(target.id);

                const context = {
                    activeSprite: {
                        name: target.getName(),
                        costumes: target.getCostumes().map(c => c.name),
                        sounds: target.getSounds ? target.getSounds().map(s => s.name) : [],
                        position: {x: target.x, y: target.y}
                    },
                    sprites: targets.map(t => ({name: t.getName()})),
                    gradeLevel: 'K-2'
                };

                const blocksResult = await generateBlocks(template.starterCode, context);
                if (blocksResult.success) {
                    injectGeneratedBlocks(vm, blocksResult);
                }
            } catch (err) {
                console.warn(`[Template] Code generation failed for ${target.getName()}:`, err.message);
            }
        }

        // Reset editing target to first sprite if available
        if (targets.length > 0) {
            vm.setEditingTarget(targets[0].id);
        }
    }
    render () {
        return (
            <TemplatePromptComponent
                error={this.state.error}
                inputValue={this.state.inputValue}
                loading={this.state.loading}
                progressStep={this.state.progressStep}
                onClose={this.handleClose}
                onExampleClick={this.handleExampleClick}
                onInputChange={this.handleInputChange}
                onSubmit={this.handleSubmit}
            />
        );
    }
}

TemplatePrompt.propTypes = {
    onClose: PropTypes.func.isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

export default TemplatePrompt;
