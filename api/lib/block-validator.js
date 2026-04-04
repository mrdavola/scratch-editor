const VALID_OPCODES = new Set([
    // Motion
    'motion_movesteps', 'motion_turnright', 'motion_turnleft', 'motion_goto',
    'motion_gotoxy', 'motion_glideto', 'motion_glidesecs', 'motion_pointindirection',
    'motion_pointtowards', 'motion_changexby', 'motion_setx', 'motion_changeyby',
    'motion_sety', 'motion_ifonedgebounce', 'motion_setrotationstyle',
    'motion_xposition', 'motion_yposition', 'motion_direction',

    // Looks
    'looks_sayforsecs', 'looks_say', 'looks_thinkforsecs', 'looks_think',
    'looks_switchcostumeto', 'looks_nextcostume', 'looks_switchbackdropto',
    'looks_nextbackdrop', 'looks_changesizeby', 'looks_setsizeto',
    'looks_changeeffectby', 'looks_seteffectto', 'looks_cleargraphiceffects',
    'looks_show', 'looks_hide', 'looks_gotofrontback', 'looks_goforwardbackwardlayers',
    'looks_costumenumbername', 'looks_backdropnumbername', 'looks_size',

    // Sound
    'sound_playuntildone', 'sound_play', 'sound_stopallsounds',
    'sound_changeeffectby', 'sound_seteffectto', 'sound_cleareffects',
    'sound_changevolumeby', 'sound_setvolumeto', 'sound_volume',

    // Events
    'event_whenflagclicked', 'event_whenkeypressed', 'event_whenthisspriteclicked',
    'event_whenbackdropswitchesto', 'event_whengreaterthan',
    'event_whenbroadcastreceived', 'event_broadcast', 'event_broadcastandwait',

    // Control
    'control_wait', 'control_repeat', 'control_forever', 'control_if',
    'control_if_else', 'control_wait_until', 'control_repeat_until',
    'control_stop', 'control_start_as_clone', 'control_create_clone_of',
    'control_delete_this_clone',

    // Sensing
    'sensing_touchingobject', 'sensing_touchingcolor', 'sensing_coloristouchingcolor',
    'sensing_distanceto', 'sensing_askandwait', 'sensing_answer',
    'sensing_keypressed', 'sensing_mousedown', 'sensing_mousex', 'sensing_mousey',
    'sensing_setdragmode', 'sensing_loudness', 'sensing_timer', 'sensing_resettimer',
    'sensing_of', 'sensing_current', 'sensing_dayssince2000', 'sensing_username',

    // Operators
    'operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide',
    'operator_random', 'operator_gt', 'operator_lt', 'operator_equals',
    'operator_and', 'operator_or', 'operator_not', 'operator_join',
    'operator_letter_of', 'operator_length', 'operator_contains',
    'operator_mod', 'operator_round', 'operator_mathop',

    // Variables
    'data_setvariableto', 'data_changevariableby', 'data_showvariable',
    'data_hidevariable', 'data_addtolist', 'data_deleteoflist',
    'data_deletealloflist', 'data_insertatlist', 'data_replaceitemoflist',
    'data_itemoflist', 'data_itemnumoflist', 'data_lengthoflist',
    'data_listcontainsitem', 'data_showlist', 'data_hidelist',

    // Procedures
    'procedures_definition', 'procedures_call', 'procedures_prototype',
    'argument_reporter_string_number', 'argument_reporter_boolean',

    // Menus (shadow blocks)
    'motion_goto_menu', 'motion_glideto_menu', 'motion_pointtowards_menu',
    'looks_costume', 'looks_backdrops', 'sound_sounds_menu',
    'event_broadcast_menu', 'control_create_clone_of_menu',
    'sensing_touchingobjectmenu', 'sensing_distancetomenu',
    'sensing_keyoptions', 'sensing_of_object_menu', 'operator_mathop_menu',
]);

export function validateBlockJSON(blocks, context = {}) {
    const errors = [];

    if (!blocks || typeof blocks !== 'object') {
        return { valid: false, errors: ['blocks must be a non-null object'] };
    }

    const blockIds = new Set(Object.keys(blocks));

    if (blockIds.size === 0) {
        return { valid: false, errors: ['blocks object is empty'] };
    }

    let hasTopLevel = false;

    for (const [id, block] of Object.entries(blocks)) {
        // Check valid opcode
        if (!block.opcode || !VALID_OPCODES.has(block.opcode)) {
            errors.push(`Block "${id}" has invalid opcode: "${block.opcode}"`);
        }

        // Check topLevel
        if (block.topLevel) {
            hasTopLevel = true;
        }

        // Check next reference resolves
        if (block.next && !blockIds.has(block.next)) {
            errors.push(`Block "${id}" has unresolved next reference: "${block.next}"`);
        }

        // Check parent reference resolves
        if (block.parent && !blockIds.has(block.parent)) {
            errors.push(`Block "${id}" has unresolved parent reference: "${block.parent}"`);
        }

        // Check input block references resolve
        if (block.inputs) {
            for (const [inputName, inputValue] of Object.entries(block.inputs)) {
                if (Array.isArray(inputValue)) {
                    // Input format: [shadow_type, value_or_block_id, ...]
                    // If index 1 is a string and it's a block reference (not an array literal)
                    const ref = inputValue[1];
                    if (typeof ref === 'string' && !Array.isArray(ref) && !blockIds.has(ref)) {
                        errors.push(`Block "${id}" input "${inputName}" has unresolved block reference: "${ref}"`);
                    }
                }
            }
        }
    }

    if (!hasTopLevel) {
        errors.push('No top-level block found. At least one block must have topLevel: true');
    }

    return { valid: errors.length === 0, errors };
}

export { VALID_OPCODES };
