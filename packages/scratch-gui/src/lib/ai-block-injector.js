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

    // Step 2: Convert fields from array format to object format
    // AI returns fields as ["value", null] (sb3 JSON format)
    // but the VM runtime expects {name, value, id} objects
    const deserializedBlocks = deserializeBlockFields(blocks);

    // Step 3: Map variable IDs
    const updatedBlocks = mapVariableIds(deserializedBlocks, target);

    // Step 4: Inject blocks
    for (const [blockId, blockData] of Object.entries(updatedBlocks)) {
        target.blocks.createBlock({ id: blockId, ...blockData });
    }

    // Step 5: Update workspace
    vm.emitWorkspaceUpdate();

    // Step 6: Trigger glow effect
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

/**
 * Convert fields from sb3 array format to VM object format.
 * AI generates: { KEY_OPTION: ["space", null] }
 * VM expects:   { KEY_OPTION: { name: "KEY_OPTION", value: "space", id: null } }
 */
function deserializeBlockFields(blocks) {
    const result = JSON.parse(JSON.stringify(blocks));
    for (const block of Object.values(result)) {
        if (!block.fields) continue;
        for (const fieldName in block.fields) {
            const fieldValue = block.fields[fieldName];
            if (Array.isArray(fieldValue)) {
                block.fields[fieldName] = {
                    name: fieldName,
                    value: fieldValue[0]
                };
                if (fieldValue.length > 1 && fieldValue[1] !== null) {
                    block.fields[fieldName].id = fieldValue[1];
                }
                // Set variableType for special fields
                if (fieldName === 'BROADCAST_OPTION') {
                    block.fields[fieldName].variableType = 'broadcast_msg';
                } else if (fieldName === 'VARIABLE') {
                    block.fields[fieldName].variableType = '';
                } else if (fieldName === 'LIST') {
                    block.fields[fieldName].variableType = 'list';
                }
            }
        }
    }
    return result;
}

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

    // Blocks are already deserialized — fields are {name, value, id} objects
    const updated = JSON.parse(JSON.stringify(blocks));
    for (const block of Object.values(updated)) {
        if (block.fields) {
            for (const [fieldName, fieldObj] of Object.entries(block.fields)) {
                if (fieldName === 'VARIABLE' || fieldName === 'LIST') {
                    const varName = fieldObj.value;
                    if (varLookup[varName]) {
                        fieldObj.id = varLookup[varName];
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
