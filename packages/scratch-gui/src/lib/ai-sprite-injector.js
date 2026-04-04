/**
 * Adds an AI-generated sprite to the project.
 */
export const addAISprite = async (vm, base64PNG, name) => {
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

    const costumeAsset = {
        assetId: asset.assetId,
        name: 'costume1',
        bitmapResolution: 2,
        dataFormat: 'png',
        md5ext: `${asset.assetId}.png`,
        rotationCenterX: 0,
        rotationCenterY: 0
    };

    const spriteJSON = {
        name: ensureUniqueName(vm, name),
        isStage: false,
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [costumeAsset],
        sounds: [],
        volume: 100,
        layerOrder: vm.runtime.targets.length,
        visible: true,
        x: 0,
        y: 0,
        size: 100,
        direction: 90,
        draggable: false,
        rotationStyle: 'all around'
    };

    // Calculate rotation center from image dimensions
    const img = new Image();
    const blob = new Blob([bytes], {type: 'image/png'});
    const url = URL.createObjectURL(blob);

    return new Promise(resolve => {
        img.onload = () => {
            costumeAsset.rotationCenterX = Math.floor(img.width / 2);
            costumeAsset.rotationCenterY = Math.floor(img.height / 2);
            URL.revokeObjectURL(url);
            vm.addSprite(JSON.stringify(spriteJSON)).then(() => {
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
