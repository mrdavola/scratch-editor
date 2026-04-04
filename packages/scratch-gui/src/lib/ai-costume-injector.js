/**
 * Adds an AI-generated costume to the current editing target.
 * Uses BitmapAdapter for proper image processing.
 */
import {BitmapAdapter} from '@scratch/scratch-svg-renderer';

export const addAICostume = async (vm, base64PNG, name) => {
    const target = vm.editingTarget;
    if (!target) return false;

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
        name: name || 'AI Costume',
        dataFormat: storage.DataFormat.PNG,
        asset: asset,
        md5: `${asset.assetId}.${storage.DataFormat.PNG}`,
        assetId: asset.assetId
    };

    await vm.addCostume(vmCostume.md5, vmCostume);
    return true;
};
