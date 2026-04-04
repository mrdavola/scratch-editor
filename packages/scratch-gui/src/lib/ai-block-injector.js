/**
 * Injects AI-generated blocks into the scratch-vm workspace.
 */
export const injectGeneratedBlocks = (vm, generatedResult) => {
    const { blocks, createEntities, explanation } = generatedResult;
    const target = vm.runtime.getEditingTarget();

    if (!target) {
        console.error('No editing target available for block injection');
        return false;
    }

    // Step 1: Create new variables, lists, broadcasts
    if (createEntities) {
        if (createEntities.variables) {
            for (const v of createEntities.variables) {
                const existing = Object.values(target.variables)
                    .find(existing => existing.name === v.name);
                if (!existing) {
                    target.createVariable(generateUID(), v.name, '', false);
                }
            }
        }

        if (createEntities.lists) {
            for (const l of createEntities.lists) {
                const existing = Object.values(target.variables)
                    .find(existing => existing.name === l.name && existing.type === 'list');
                if (!existing) {
                    target.createVariable(generateUID(), l.name, 'list', false);
                }
            }
        }
    }

    // Step 2: Map variable IDs
    const updatedBlocks = mapVariableIds(blocks, target);

    // Step 3: Inject blocks
    for (const [blockId, blockData] of Object.entries(updatedBlocks)) {
        target.blocks.createBlock({ id: blockId, ...blockData });
    }

    // Step 4: Update workspace
    vm.emitWorkspaceUpdate();

    // Step 5: Trigger glow effect
    const topLevelIds = Object.entries(updatedBlocks)
        .filter(([_, b]) => b.topLevel)
        .map(([id, _]) => id);

    vm.runtime.emit('AI_BLOCKS_INJECTED', {
        blockIds: Object.keys(updatedBlocks),
        topLevelIds,
        explanation
    });

    return true;
};

function mapVariableIds(blocks, target) {
    const varLookup = {};
    for (const [id, v] of Object.entries(target.variables)) {
        varLookup[v.name] = id;
    }

    const stage = target.runtime.getTargetForStage();
    if (stage) {
        for (const [id, v] of Object.entries(stage.variables)) {
            if (!varLookup[v.name]) {
                varLookup[v.name] = id;
            }
        }
    }

    const updated = JSON.parse(JSON.stringify(blocks));
    for (const block of Object.values(updated)) {
        if (block.fields) {
            for (const [fieldName, fieldValue] of Object.entries(block.fields)) {
                if (fieldName === 'VARIABLE' || fieldName === 'LIST') {
                    const varName = fieldValue[0];
                    if (varLookup[varName]) {
                        fieldValue[1] = varLookup[varName];
                    }
                }
            }
        }
    }

    return updated;
}

function generateUID() {
    const soup = '!#%()*+,-./:;=?@[]^_`{|}~' +
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 20;
    const id = [];
    for (let i = 0; i < length; i++) {
        id.push(soup.charAt(Math.random() * soup.length));
    }
    return id.join('');
}
