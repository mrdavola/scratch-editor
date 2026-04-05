/**
 * Injects AI-generated blocks into the scratch-vm workspace.
 *
 * Includes an inlined sb3 deserializer to convert blocks from the compact
 * sb3 JSON format into the internal format the VM expects.
 * (Inlined to avoid importing scratch-vm internals which fail outside monorepo context.)
 */

// --- Inlined sb3 deserialization (from scratch-vm/src/serialization/sb3) ---

const INPUT_SAME_BLOCK_SHADOW = 1;
const INPUT_BLOCK_NO_SHADOW = 2;
const INPUT_DIFF_BLOCK_SHADOW = 3;

const PRIMITIVE_MAP = {
    4: {opcode: 'math_number', field: 'NUM'},
    5: {opcode: 'math_positive_number', field: 'NUM'},
    6: {opcode: 'math_whole_number', field: 'NUM'},
    7: {opcode: 'math_integer', field: 'NUM'},
    8: {opcode: 'math_angle', field: 'NUM'},
    9: {opcode: 'colour_picker', field: 'COLOUR'},
    10: {opcode: 'text', field: 'TEXT'},
    11: {opcode: 'event_broadcast_menu', field: 'BROADCAST_OPTION'},
    12: {opcode: 'data_variable', field: 'VARIABLE'},
    13: {opcode: 'data_listcontents', field: 'LIST'}
};

/**
 * Deserialize an input descriptor (compact array) into a full block in the blocks object.
 * @param {Array} inputDescArr - The compact input descriptor array.
 * @param {string|null} parentId - The parent block ID.
 * @param {boolean} isShadow - Whether this is a shadow block.
 * @param {object} blocks - The blocks object to mutate.
 * @returns {string} The ID of the deserialized block.
 */
function deserializeInputDesc (inputDescArr, parentId, isShadow, blocks) {
    const primitiveType = inputDescArr[0];
    const primitiveInfo = PRIMITIVE_MAP[primitiveType];
    if (!primitiveInfo) {
        throw new Error(`Unknown primitive type: ${primitiveType}`);
    }
    const newId = generateUID();
    const fields = {};
    const fieldData = {
        name: primitiveInfo.field,
        value: inputDescArr[1]
    };
    if (primitiveType === 11) {
        // Broadcast: value is name, id is in index 2
        fieldData.id = inputDescArr[2];
        fieldData.variableType = 'broadcast_msg';
    } else if (primitiveType === 12) {
        // Variable: value is name, id is in index 2
        fieldData.id = inputDescArr[2];
        fieldData.variableType = '';
    } else if (primitiveType === 13) {
        // List: value is name, id is in index 2
        fieldData.id = inputDescArr[2];
        fieldData.variableType = 'list';
    }
    fields[primitiveInfo.field] = fieldData;

    blocks[newId] = {
        id: newId,
        opcode: primitiveInfo.opcode,
        inputs: {},
        fields: fields,
        next: null,
        topLevel: false,
        parent: parentId,
        shadow: isShadow
    };
    return newId;
}

/**
 * Deserialize inputs from the compact sb3 format.
 * @param {object} inputs - The compact inputs object.
 * @param {string} parentId - The parent block ID.
 * @param {object} blocks - The blocks object to mutate.
 * @returns {object} The deserialized inputs object.
 */
function deserializeInputs (inputs, parentId, blocks) {
    const result = {};
    for (const inputName in inputs) {
        if (!Object.prototype.hasOwnProperty.call(inputs, inputName)) continue;
        const inputDescArr = inputs[inputName];
        const shadowIndicator = inputDescArr[0];
        let blockId = null;
        let shadowId = null;

        if (shadowIndicator === INPUT_SAME_BLOCK_SHADOW) {
            // input[1] is either a block ID (string) or a primitive array
            if (Array.isArray(inputDescArr[1])) {
                const id = deserializeInputDesc(inputDescArr[1], parentId, true, blocks);
                blockId = id;
                shadowId = id;
            } else {
                blockId = inputDescArr[1];
                shadowId = inputDescArr[1];
            }
        } else if (shadowIndicator === INPUT_BLOCK_NO_SHADOW) {
            blockId = inputDescArr[1];
            shadowId = null;
        } else if (shadowIndicator === INPUT_DIFF_BLOCK_SHADOW) {
            blockId = inputDescArr[1];
            if (Array.isArray(inputDescArr[2])) {
                shadowId = deserializeInputDesc(inputDescArr[2], parentId, true, blocks);
            } else {
                shadowId = inputDescArr[2];
            }
        }

        result[inputName] = {
            name: inputName,
            block: blockId,
            shadow: shadowId
        };
    }
    return result;
}

/**
 * Deserialize fields from the compact sb3 format.
 * @param {object} fields - The compact fields object.
 * @returns {object} The deserialized fields object.
 */
function deserializeFields (fields) {
    const result = {};
    for (const fieldName in fields) {
        if (!Object.prototype.hasOwnProperty.call(fields, fieldName)) continue;
        const fieldDescArr = fields[fieldName];
        const fieldData = {
            name: fieldName,
            value: fieldDescArr[0]
        };
        if (fieldDescArr.length > 1 && fieldDescArr[1] !== null) {
            fieldData.id = fieldDescArr[1];
        }
        if (fieldName === 'BROADCAST_OPTION') {
            fieldData.variableType = 'broadcast_msg';
        } else if (fieldName === 'VARIABLE') {
            fieldData.variableType = '';
        } else if (fieldName === 'LIST') {
            fieldData.variableType = 'list';
        }
        result[fieldName] = fieldData;
    }
    return result;
}

/**
 * Deserialize blocks from compact sb3 JSON format into the internal VM format.
 * Mutates the blocks object in place.
 * @param {object} blocks - The blocks object to deserialize.
 * @returns {object} The deserialized blocks object.
 */
function deserializeBlocks (blocks) {
    for (const blockId in blocks) {
        if (!Object.prototype.hasOwnProperty.call(blocks, blockId)) continue;
        const block = blocks[blockId];
        if (Array.isArray(block)) {
            // This is a top-level primitive (compact array form)
            delete blocks[blockId];
            deserializeInputDesc(block, null, false, blocks);
            continue;
        }
        block.id = blockId;
        if (block.inputs) {
            block.inputs = deserializeInputs(block.inputs, blockId, blocks);
        }
        if (block.fields) {
            block.fields = deserializeFields(block.fields);
        }
    }
    return blocks;
}

// --- End inlined sb3 deserialization ---

export const injectGeneratedBlocks = (vm, generatedResult) => {
    const {blocks, createEntities, explanation} = generatedResult;
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
                    .find(e => e.name === v.name);
                if (!existing) {
                    target.createVariable(generateUID(), v.name, '', false);
                }
            }
        }
        if (createEntities.lists) {
            for (const l of createEntities.lists) {
                const existing = Object.values(target.variables)
                    .find(e => e.name === l.name && e.type === 'list');
                if (!existing) {
                    target.createVariable(generateUID(), l.name, 'list', false);
                }
            }
        }
    }

    // Step 2: Use the VM's own sb3 deserializer
    try {
        const blocksToInject = JSON.parse(JSON.stringify(blocks));
        deserializeBlocks(blocksToInject);

        // Step 3: Map variable IDs to real VM IDs
        mapVariableIds(blocksToInject, target);

        // Step 4: Inject all blocks (originals + deserialized shadow blocks)
        for (const blockId in blocksToInject) {
            if (!Object.prototype.hasOwnProperty.call(blocksToInject, blockId)) continue;
            target.blocks.createBlock(blocksToInject[blockId]);
        }

        // Step 5: Update workspace to render blocks
        vm.emitWorkspaceUpdate();

        // Step 6: Emit event for glow effect
        const topLevelIds = Object.keys(blocksToInject)
            .filter(id => blocksToInject[id].topLevel);

        vm.runtime.emit('AI_BLOCKS_INJECTED', {
            blockIds: Object.keys(blocksToInject),
            topLevelIds,
            explanation
        });

        return true;
    } catch (e) {
        console.error('[AI Injector] Failed to inject blocks:', e);
        return false;
    }
};

export const injectMultiSpriteBlocks = (vm, generatedResult) => {
    const {spriteBlocks, explanation} = generatedResult;
    let allInjected = true;

    for (const [spriteName, spriteData] of Object.entries(spriteBlocks)) {
        // Find the target by name
        const target = vm.runtime.targets.find(
            t => t.isOriginal && t.getName() === spriteName
        );

        if (!target) {
            console.warn(`[AI Injector] Sprite "${spriteName}" not found, skipping`);
            allInjected = false;
            continue;
        }

        // Create entities on this target
        if (spriteData.createEntities) {
            if (spriteData.createEntities.variables) {
                for (const v of spriteData.createEntities.variables) {
                    const existing = Object.values(target.variables)
                        .find(e => e.name === v.name);
                    if (!existing) {
                        target.createVariable(generateUID(), v.name, '', false);
                    }
                }
            }
            if (spriteData.createEntities.lists) {
                for (const l of spriteData.createEntities.lists) {
                    const existing = Object.values(target.variables)
                        .find(e => e.name === l.name && e.type === 'list');
                    if (!existing) {
                        target.createVariable(generateUID(), l.name, 'list', false);
                    }
                }
            }
        }

        // Deserialize and inject blocks
        try {
            const blocksToInject = JSON.parse(JSON.stringify(spriteData.blocks));
            deserializeBlocks(blocksToInject);

            mapVariableIds(blocksToInject, target);

            for (const blockId in blocksToInject) {
                if (!Object.prototype.hasOwnProperty.call(blocksToInject, blockId)) continue;
                target.blocks.createBlock(blocksToInject[blockId]);
            }
        } catch (e) {
            console.error(`[AI Injector] Failed to inject blocks for "${spriteName}":`, e);
            allInjected = false;
        }
    }

    // Update workspace
    vm.emitWorkspaceUpdate();

    vm.runtime.emit('AI_BLOCKS_INJECTED', {
        blockIds: [],
        topLevelIds: [],
        explanation
    });

    return allInjected;
};

/**
 * Map variable/list names to their real VM IDs in block fields.
 */
function mapVariableIds (blocks, target) {
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

    for (const blockId in blocks) {
        if (!Object.prototype.hasOwnProperty.call(blocks, blockId)) continue;
        const block = blocks[blockId];
        if (!block.fields) continue;
        for (const fieldName in block.fields) {
            if (!Object.prototype.hasOwnProperty.call(block.fields, fieldName)) continue;
            const fieldObj = block.fields[fieldName];
            if (fieldName === 'VARIABLE' || fieldName === 'LIST') {
                if (varLookup[fieldObj.value]) {
                    fieldObj.id = varLookup[fieldObj.value];
                }
            }
        }
    }
}

function generateUID () {
    const soup = '!#%()*+,-./:;=?@[]^_`{|}~' +
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 20;
    const id = [];
    for (let i = 0; i < length; i++) {
        id.push(soup.charAt(Math.random() * soup.length));
    }
    return id.join('');
}
