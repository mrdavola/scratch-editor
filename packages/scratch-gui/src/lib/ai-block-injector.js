/**
 * Injects AI-generated blocks into the scratch-vm workspace.
 *
 * Uses the VM's own sb3 deserializer to convert blocks from the compact
 * sb3 JSON format into the internal format the VM expects.
 */
/* eslint-disable global-require */

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
    // This handles fields, inputs, shadow blocks, and all edge cases correctly
    const sb3 = require('@scratch/scratch-vm/src/serialization/sb3');
    const blocksToInject = JSON.parse(JSON.stringify(blocks));
    sb3.deserializeBlocks(blocksToInject);

    // Step 3: Map variable IDs to real VM IDs
    mapVariableIds(blocksToInject, target);

    // Step 4: Inject all blocks (originals + deserialized shadow blocks)
    for (const blockId in blocksToInject) {
        if (!Object.prototype.hasOwnProperty.call(blocksToInject, blockId)) continue;
        const block = blocksToInject[blockId];
        target.blocks.createBlock(block);
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
        const sb3 = require('@scratch/scratch-vm/src/serialization/sb3');
        const blocksToInject = JSON.parse(JSON.stringify(spriteData.blocks));
        sb3.deserializeBlocks(blocksToInject);

        mapVariableIds(blocksToInject, target);

        for (const blockId in blocksToInject) {
            if (!Object.prototype.hasOwnProperty.call(blocksToInject, blockId)) continue;
            target.blocks.createBlock(blocksToInject[blockId]);
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
