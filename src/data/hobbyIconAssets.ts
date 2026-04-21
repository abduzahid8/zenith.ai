import { ImageSourcePropType } from 'react-native';

const codeIcon = require('../../assets/images/icons-hobby/code.png');
const bookIcon = require('../../assets/images/icons-hobby/book-icon.png');
const ukIcon = require('../../assets/images/icons-hobby/united-kingdom.png');
const chinaIcon = require('../../assets/images/icons-hobby/china.png');
const defaultIcon = require('../../assets/images/icons-hobby/Mask group.png');

/** Every hobby uses one of the shared assets in `assets/images/icons-hobby`. */
const HOBBY_ICON_BY_ID: Record<string, ImageSourcePropType> = {
    // Flags / languages
    english: ukIcon,
    languages: ukIcon,
    chinese: chinaIcon,

    // Code & digital craft
    python: codeIcon,
    programming: codeIcon,
    web_design: codeIcon,
    mobile_design: codeIcon,
    video_editing: codeIcon,
    '3d_motion': codeIcon,
    logic_puzzles: codeIcon,

    // Reading, writing, structured learning
    reading: bookIcon,
    speed_reading: bookIcon,
    writing: bookIcon,
    journaling: bookIcon,
    public_speaking: bookIcon,
    planning: bookIcon,
    finance: bookIcon,

    // Default asset: strategy, body, creativity, mindfulness, practical
    chess: defaultIcon,
    drawing: defaultIcon,
    music: defaultIcon,
    photography: defaultIcon,
    content_creation: defaultIcon,
    home_workout: defaultIcon,
    running: defaultIcon,
    yoga: defaultIcon,
    dancing: defaultIcon,
    martial_arts: defaultIcon,
    meditation: defaultIcon,
    cooking: defaultIcon,
};

export function getHobbyIconSource(hobbyId: string | null | undefined): ImageSourcePropType {
    if (!hobbyId) return bookIcon;
    return HOBBY_ICON_BY_ID[hobbyId] ?? defaultIcon;
}
