/**
 * Extracts the current project context from the scratch-vm instance.
 * Used by all AI features to provide project-aware prompts.
 *
 * @param {VirtualMachine} vm - The scratch-vm instance
 * @returns {ProjectContext} - Structured context object
 */
export const extractProjectContext = (vm) => {
    const runtime = vm.runtime;
    const activeTarget = runtime.getEditingTarget();
    const stage = runtime.getTargetForStage();

    const sprites = runtime.targets
        .filter(t => t.isOriginal)
        .map(t => ({
            name: t.getName(),
            costumes: t.getCostumes().map(c => c.name),
            isStage: t.isStage
        }));

    const blocks = activeTarget ? summarizeBlocks(activeTarget.blocks) : [];

    const spriteVars = activeTarget
        ? Object.fromEntries(
            Object.values(activeTarget.variables).map(v => [v.name, v.value])
          )
        : {};

    const stageVars = stage
        ? Object.fromEntries(
            Object.values(stage.variables)
                .filter(v => v.type === '')
                .map(v => [v.name, v.value])
          )
        : {};

    const stageLists = stage
        ? Object.fromEntries(
            Object.values(stage.variables)
                .filter(v => v.type === 'list')
                .map(v => [v.name, v.value])
          )
        : {};

    return {
        activeSprite: activeTarget ? {
            name: activeTarget.getName(),
            costumes: activeTarget.getCostumes().map(c => c.name),
            sounds: activeTarget.getSounds().map(s => s.name),
            variables: spriteVars,
            blocks,
            position: { x: activeTarget.x, y: activeTarget.y },
            size: activeTarget.size,
            direction: activeTarget.direction
        } : null,
        sprites,
        stage: {
            backdrops: stage ? stage.getCostumes().map(c => c.name) : [],
            variables: stageVars,
            lists: stageLists
        }
    };
};

const summarizeBlocks = (blocksContainer) => {
    const blocks = blocksContainer._blocks;
    const topLevelBlocks = Object.values(blocks)
        .filter(b => b.topLevel);

    return topLevelBlocks.map(block => ({
        opcode: block.opcode,
        chain: describeChain(block, blocks)
    }));
};

const describeChain = (block, allBlocks, depth = 0) => {
    if (!block || depth > 20) return null;
    const result = { opcode: block.opcode };
    if (block.next) {
        result.next = describeChain(allBlocks[block.next], allBlocks, depth + 1);
    }
    return result;
};
