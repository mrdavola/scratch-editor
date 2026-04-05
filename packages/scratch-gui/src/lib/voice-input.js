/**
 * Web Speech API wrapper for voice-to-blocks.
 * Transcribes speech and feeds it into the NL-to-blocks pipeline.
 */
export const startVoiceInput = (onResult, onError) => {
    if (!('webkitSpeechRecognition' in window) &&
        !('SpeechRecognition' in window)) {
        onError('Voice input is not supported in this browser.');
        return null;
    }

    const SpeechRecognition = window.SpeechRecognition ||
                              window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        recognition.stop();
        onResult(transcript);
    };

    recognition.onerror = (event) => {
        recognition.stop();
        onError(`Voice recognition error: ${event.error}`);
    };

    recognition.onend = () => {
        // Ensure cleanup even if stop/abort wasn't explicit
    };

    recognition.start();
    return recognition;
};

export const isVoiceSupported = () => {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
};
