import { FadeInDown, FadeInUp, ZoomIn, Layout, Keyframe } from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';

export const ANIMATIONS = {
    // Screen Entrance: Smooth upward slide with fade
    ScreenEntrance: FadeInDown.springify().mass(1).damping(20).stiffness(100),

    // Header/Text Entrance: Slightly faster
    HeaderEntrance: FadeInDown.delay(100).duration(400).easing(Easing.out(Easing.quad)),

    // List Item Entrance: Staggered based on index
    ListItemEntrance: (index: number) =>
        FadeInDown.delay(200 + (index * 100))
            .springify()
            .damping(16)
            .mass(0.8),

    // Card/Container Reveal
    CardEntrance: ZoomIn.delay(100).springify().damping(15),

    // Modal/Overlay Reveal
    ModalEntrance: ZoomIn.duration(250).easing(Easing.out(Easing.back(1.5))),

    // Button interactions defined in component logic usually (useSharedValue), 
    // but we can define constants for spring configs here.
    ButtonPressConfig: {
        damping: 10,
        stiffness: 300,
        mass: 0.5,
    },
    ButtonReleaseConfig: {
        damping: 12,
        stiffness: 400,
        mass: 1,
    }
};
