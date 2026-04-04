/**
 * Injects AI-generated blocks into the scratch-vm workspace.
 *
 * The AI generates blocks in sb3 JSON format (compact arrays for fields/inputs).
 * The VM runtime expects deserialized objects. This module handles the conversion.
 */

// Primitive type constants (match sb3.js)
const MATH_NUM_PRIMITIVE = 4;
const POSITIVE_NUM_PRIMITIVE = 5;
const WHOLE_NUM_PRIMITIVE = 6;
const INTEGER_NUM_PRIMITIVE = 7;
const ANGLE_NUM_PRIMITIVE = 8;
const COLOR_PICKER_PRIMITIVE = 9;
const TEXT_PRIMITIVE = 10;
const BROADCAST_PRIMITIVE = 11;
const VAR_PRIMITIVE = 12;
const LIST_PRIMITIVE = 13;

const INPUT_SAME_BLOCK_SHADOW = 1;
const INPUT_BLOCK_NO_SHADOW = 2;
const INPUT_DIFF_BLOCK_SHADOW = 3;

// Map from primitive type to {opcode, fieldName}
const PRIMITIVE_INFO = {
    [MATH_NUM_PRIMITIVE]: {opcode: 'math_number', field: 'NUM'},
    [POSITIVE_NUM_PRIMITIVE]: {opcode: 'math_positive_number', field: 'NUM'},
    [WHOLE_NUM_PRIMITIVE]: {opcode: 'math_whole_number', field: 'NUM'},
    [INTEGER_NUM_PRIMITIVE]: {opcode: 'math_integer', field: 'NUM'},
    [ANGLE_NUM_PRIMITIVE]: {opcode: 'math_angle', field: 'NUM'},
    [COLOR_PICKER_PRIMITIVE]: {opcode: 'colour_picker', field: 'COLOUR'},
    [TEXT_PRIMITIVE]: {opcode: 'text', field: 'TEXT'},
    [BROADCAST_PRIMITIVE]: {opcode: 'event_broadcast_menu', field: 'BROADCAST_OPTION'},
    [VAR_PRIMITIVE]: {opcode: 'data_variable', field: 'VARIABLE'},
    [LIST_PRIMITIVE]: {opcode: 'data_listcontents', field: 'LIST'},
};

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

    // Step 2: Deserialize blocks from sb3 format to VM internal format
    // This creates shadow blocks for inputs and converts fields to objects
    const allBlocks = deserializeAllBlocks(JSON.parse(JSON.stringify(blocks)));

    // Step 3: Map variable IDs to real VM IDs
    mapVariableIds(allBlocks, target);

    // Step 4: Inject all blocks (originals + generated shadow blocks)
    for (const [blockId, blockData] of Object.entries(allBlocks)) {
        target.blocks.createBlock({id: blockId, ...blockData});
    }

    // Step 5: Update workspace to render blocks
    vm.emitWorkspaceUpdate();

    // Step 6: Emit event for glow effect
    const topLevelIds = Object.entries(allBlocks)
        .filter(([_, b]) => b.topLevel)
        .map(([id]) => id);

    vm.runtime.emit('AI_BLOCKS_INJECTED', {
        blockIds: Object.keys(allBlocks),
        topLevelIds,
        explanation
    });

    return true;
};

/**
 * Deserialize all blocks from sb3 compact format to VM internal format.
 * Converts fields from arrays to objects and expands input primitives into shadow blocks.
 */
function deserializeAllBlocks (blocks) {
    for (const blockId in blocks) {
        const block = blocks[blockId];
        block.id = blockId;

        // Deserialize fields: ["value", null] → {name, value, id}
        if (block.fields) {
            block.fields = deserializeFields(block.fields);
        }

        // Deserialize inputs: [1, [10, "hi"]] → creates shadow block + {name, block, shadow}
        if (block.inputs) {
            block.inputs = deserializeInputs(block.inputs, blockId, blocks);
        }
    }
    return blocks;
}

/**
 * Convert fields from sb3 array format to VM object format.
 */
function deserializeFields (fields) {
    const obj = {};
    for (const fieldName in fields) {
        const fieldValue = fields[fieldName];
        if (Array.isArray(fieldValue)) {
            obj[fieldName] = {
                name: fieldName,
                value: fieldValue[0]
            };
            if (fieldValue.length > 1 && fieldValue[1] !== null) {
                obj[fieldName].id = fieldValue[1];
            }
            if (fieldName === 'BROADCAST_OPTION') {
                obj[fieldName].variableType = 'broadcast_msg';
            } else if (fieldName === 'VARIABLE') {
                obj[fieldName].variableType = '';
            } else if (fieldName === 'LIST') {
                obj[fieldName].variableType = 'list';
            }
        } else {
            // Already an object (shouldn't happen, but safe)
            obj[fieldName] = fieldValue;
        }
    }
    return obj;
}

/**
 * Deserialize inputs from sb3 compact format.
 * Creates shadow blocks for primitive values and adds them to the blocks map.
 */
function deserializeInputs (inputs, parentId, allBlocks) {
    const obj = {};
    for (const inputName in inputs) {
        const inputArr = inputs[inputName];
        if (!Array.isArray(inputArr)) {
            obj[inputName] = inputArr;
            continue;
        }

        let block = null;
        let shadow = null;
        const blockShadowInfo = inputArr[0];

        if (blockShadowInfo === INPUT_SAME_BLOCK_SHADOW) {
            block = shadow = deserializeInputDesc(inputArr[1], parentId, true, allBlocks);
        } else if (blockShadowInfo === INPUT_BLOCK_NO_SHADOW) {
            block = deserializeInputDesc(inputArr[1], parentId, false, allBlocks);
        } else if (blockShadowInfo === INPUT_DIFF_BLOCK_SHADOW) {
            block = deserializeInputDesc(inputArr[1], parentId, false, allBlocks);
            shadow = deserializeInputDesc(inputArr[2], parentId, true, allBlocks);
        }

        obj[inputName] = {name: inputName, block, shadow};
    }
    return obj;
}

/**
 * Deserialize a single input descriptor.
 * If it's a primitive array like [10, "hello"], create a shadow block for it.
 * If it's a string (block ID reference), return it directly.
 */
function deserializeInputDesc (inputDescOrId, parentId, isShadow, allBlocks) {
    // String means it's a reference to another block by ID
    if (typeof inputDescOrId === 'string') return inputDescOrId;
    // Not an array — return as-is
    if (!Array.isArray(inputDescOrId)) return inputDescOrId;

    const primitiveType = inputDescOrId[0];
    const info = PRIMITIVE_INFO[primitiveType];
    if (!info) return null;

    const newId = generateUID();
    const primitiveBlock = {
        id: newId,
        opcode: info.opcode,
        next: null,
        parent: parentId,
        shadow: isShadow,
        topLevel: false,
        inputs: {},
        fields: {}
    };

    primitiveBlock.fields[info.field] = {
        name: info.field,
        value: String(inputDescOrId[1])
    };

    // For broadcasts, variables, lists — include the ID
    if (primitiveType === BROADCAST_PRIMITIVE) {
        primitiveBlock.fields[info.field].id = inputDescOrId[2] || null;
        primitiveBlock.fields[info.field].variableType = 'broadcast_msg';
    } else if (primitiveType === VAR_PRIMITIVE) {
        primitiveBlock.fields[info.field].id = inputDescOrId[2] || null;
        primitiveBlock.fields[info.field].variableType = '';
    } else if (primitiveType === LIST_PRIMITIVE) {
        primitiveBlock.fields[info.field].id = inputDescOrId[2] || null;
        primitiveBlock.fields[info.field].variableType = 'list';
    }

    // Add this shadow block to the blocks map
    allBlocks[newId] = primitiveBlock;

    return newId;
}

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

    for (const block of Object.values(blocks)) {
        if (!block.fields) continue;
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
