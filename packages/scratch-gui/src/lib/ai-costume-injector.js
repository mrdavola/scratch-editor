/**
 * Adds an AI-generated costume to the current editing target.
 */
export const addAICostume = async (vm, base64PNG, name) => {
    const target = vm.editingTarget;
    if (!target) return false;

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
        name: name || 'AI Costume',
        dataFormat: 'png',
        assetId: asset.assetId,
        md5ext: `${asset.assetId}.png`,
        rotationCenterX: 0,
        rotationCenterY: 0,
        bitmapResolution: 2
    };

    // Calculate rotation center from image dimensions
    const img = new Image();
    const blob = new Blob([bytes], {type: 'image/png'});
    const url = URL.createObjectURL(blob);

    return new Promise(resolve => {
        img.onload = () => {
            costume.rotationCenterX = Math.floor(img.width / 2);
            costume.rotationCenterY = Math.floor(img.height / 2);
            URL.revokeObjectURL(url);
            vm.addCostume(costume.md5ext, costume).then(() => {
                resolve(true);
            }).catch(() => resolve(false));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(false);
        };
        img.src = url;
    });
};
