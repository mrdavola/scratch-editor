/**
 * Adds an AI-generated backdrop to the stage.
 */
export const addAIBackdrop = async (vm, base64PNG, name) => {
    const stage = vm.runtime.getTargetForStage();
    if (!stage) return false;

    const binaryString = atob(base64PNG);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const storage = vm.runtime.storage;
    const asset = storage.createAsset(
        storage.AssetType.ImageBitmap,
        storage.DataFormat.PNG,
        bytes.buffer,
        null,
        true
    );

    const costume = {
        name: name || 'AI Backdrop',
        dataFormat: 'png',
        assetId: asset.assetId,
        md5ext: `${asset.assetId}.png`,
        rotationCenterX: 240,
        rotationCenterY: 180,
        bitmapResolution: 2
    };

    vm.addBackdrop(costume.md5ext, costume);
    return true;
};
