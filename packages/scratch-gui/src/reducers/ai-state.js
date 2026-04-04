const SET_AI_LOADING = 'scratch-gui/ai-state/SET_AI_LOADING';
const SET_AI_RESULT = 'scratch-gui/ai-state/SET_AI_RESULT';
const SET_AI_ERROR = 'scratch-gui/ai-state/SET_AI_ERROR';
const CLEAR_AI_STATE = 'scratch-gui/ai-state/CLEAR_AI_STATE';
const SET_AI_INPUT_VISIBLE = 'scratch-gui/ai-state/SET_AI_INPUT_VISIBLE';
const ADD_CONVERSATION_MESSAGE = 'scratch-gui/ai-state/ADD_CONVERSATION_MESSAGE';

const initialState = {
    loading: false,
    result: null,
    error: null,
    inputVisible: false,
    conversationHistory: []
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_AI_LOADING:
        return Object.assign({}, state, {
            loading: action.loading
        });
    case SET_AI_RESULT:
        return Object.assign({}, state, {
            result: action.result,
            loading: false,
            error: null
        });
    case SET_AI_ERROR:
        return Object.assign({}, state, {
            error: action.error,
            loading: false
        });
    case CLEAR_AI_STATE:
        return Object.assign({}, initialState);
    case SET_AI_INPUT_VISIBLE:
        return Object.assign({}, state, {
            inputVisible: action.inputVisible
        });
    case ADD_CONVERSATION_MESSAGE:
        return Object.assign({}, state, {
            conversationHistory: [...state.conversationHistory, action.message]
        });
    default:
        return state;
    }
};

const setAILoading = function (loading) {
    return {
        type: SET_AI_LOADING,
        loading: loading
    };
};

const setAIResult = function (result) {
    return {
        type: SET_AI_RESULT,
        result: result
    };
};

const setAIError = function (error) {
    return {
        type: SET_AI_ERROR,
        error: error
    };
};

const clearAIState = function () {
    return {
        type: CLEAR_AI_STATE
    };
};

const setAIInputVisible = function (inputVisible) {
    return {
        type: SET_AI_INPUT_VISIBLE,
        inputVisible: inputVisible
    };
};

const addConversationMessage = function (message) {
    return {
        type: ADD_CONVERSATION_MESSAGE,
        message: message
    };
};

export {
    reducer as default,
    initialState as aiStateInitialState,
    setAILoading,
    setAIResult,
    setAIError,
    clearAIState,
    setAIInputVisible,
    addConversationMessage
};
