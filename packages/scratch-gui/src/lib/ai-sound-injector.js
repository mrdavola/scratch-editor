/**
 * Adds an AI-generated sound to the current editing target.
 */
export const addAISound = async (vm, base64WAV, name) => {
    const target = vm.editingTarget;
    if (!target) return false;

    const storage = vm.runtime.storage;

    const binaryString = atob(base64WAV);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const asset = storage.createAsset(
        storage.AssetType.Sound,
        storage.DataFormat.WAV,
        new Uint8Array(bytes),
        null,
        true
    );

    const vmSound = {
        name: name || 'AI Sound',
        dataFormat: storage.DataFormat.WAV,
        asset: asset,
        md5: `${asset.assetId}.${storage.DataFormat.WAV}`,
        assetId: asset.assetId
    };

    await vm.addSound(vmSound).catch(e => {
        console.error('Failed to add sound:', e);
    });
    return true;
};
