/**
 * Adds an AI-generated backdrop to the stage.
 * Uses BitmapAdapter for proper image processing.
 */
import {BitmapAdapter} from '@scratch/scratch-svg-renderer';

export const addAIBackdrop = async (vm, base64PNG, name) => {
    const stage = vm.runtime.getTargetForStage();
    if (!stage) return false;

    const storage = vm.runtime.storage;

    const binaryString = atob(base64PNG);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const bitmapAdapter = new BitmapAdapter();
    const dataBuffer = await bitmapAdapter.importBitmap(bytes.buffer, 'image/png');

    const asset = storage.createAsset(
        storage.AssetType.ImageBitmap,
        storage.DataFormat.PNG,
        dataBuffer,
        null,
        true
    );

    const vmCostume = {
        name: name || 'AI Backdrop',
        dataFormat: storage.DataFormat.PNG,
        asset: asset,
        md5: `${asset.assetId}.${storage.DataFormat.PNG}`,
        assetId: asset.assetId
    };

    vm.addBackdrop(vmCostume.md5, vmCostume);
    return true;
};
