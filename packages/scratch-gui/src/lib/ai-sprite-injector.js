/**
 * Adds an AI-generated sprite to the project.
 * Uses the same costumeUpload flow as file uploads to ensure
 * the bitmap is properly processed and cached in storage.
 */
import {BitmapAdapter} from '@scratch/scratch-svg-renderer';

export const addAISprite = async (vm, base64PNG, name) => {
    const storage = vm.runtime.storage;

    // Decode base64 to binary
    const binaryString = atob(base64PNG);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Use BitmapAdapter to properly process the image (same as file upload flow)
    const bitmapAdapter = new BitmapAdapter();
    const dataBuffer = await bitmapAdapter.importBitmap(bytes.buffer, 'image/png');

    // Create a storage asset
    const asset = storage.createAsset(
        storage.AssetType.ImageBitmap,
        storage.DataFormat.PNG,
        dataBuffer,
        null,
        true
    );

    // Build costume with the asset reference (critical for rendering)
    const vmCostume = {
        name: 'costume1',
        dataFormat: storage.DataFormat.PNG,
        asset: asset,
        md5: `${asset.assetId}.${storage.DataFormat.PNG}`,
        assetId: asset.assetId
    };

    // Build sprite JSON with the costume
    const spriteJSON = {
        name: ensureUniqueName(vm, name),
        isStage: false,
        x: 0,
        y: 0,
        visible: true,
        size: 100,
        rotationStyle: 'all around',
        direction: 90,
        draggable: false,
        currentCostume: 0,
        blocks: {},
        variables: {},
        costumes: [vmCostume],
        sounds: []
    };

    await vm.addSprite(spriteJSON);
    return true;
};

function ensureUniqueName (vm, name) {
    const existingNames = vm.runtime.targets.map(t => t.getName());
    let uniqueName = name;
    let counter = 2;
    while (existingNames.includes(uniqueName)) {
        uniqueName = `${name} ${counter}`;
        counter++;
    }
    return uniqueName;
}
