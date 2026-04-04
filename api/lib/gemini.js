import { GoogleGenerativeAI } from '@google/generative-ai';

let genAIInstance = null;

function getGenAI() {
    if (!genAIInstance) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAIInstance;
}

export function getTextModel(modelName = 'gemini-2.5-flash') {
    return getGenAI().getGenerativeModel({ model: modelName });
}

export function getImageModel() {
    return getGenAI().getGenerativeModel({ model: 'gemini-3.1-flash-image-preview' });
}

export function getAudioModel() {
    return getGenAI().getGenerativeModel({ model: 'lyria-3-clip-preview' });
}
