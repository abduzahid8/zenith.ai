import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    ScrollView,
    Image,
    Platform,
    PanResponder,
    Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { aiService } from '../../services/ai';
import { useT } from '../../store/languageStore';
import * as Haptics from 'expo-haptics';

import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

function splitTextIntoThreeCards(body: string, title: string) {
    const normalizedTitle = title.toLowerCase();
    
    if (normalizedTitle.includes('фигур') && (normalizedTitle.includes('ход') || normalizedTitle.includes('как'))) {
        return [
            {
                subtitle: 'Король и Ферзь',
                text: 'Шахматы — это игра на 8×8 клетках. ♔ Король ходит на 1 клетку в любом направлении. ♕ Ферзь — самая сильная фигура, ходит на любое количество клеток по прямой и диагонали.',
            },
            {
                subtitle: 'Ладья и Слон',
                text: '♖ Ладья ходит только по прямым линиям (вертикалям и горизонталям). ♗ Слон ходит только по диагоналям любого цвета.',
            },
            {
                subtitle: 'Конь и Пешка',
                text: '♘ Конь ходит необычным Г-образным способом (2 клетки прямо и 1 вбок). ♙ Пешка ходит только вперёд на 1 клетку (в первый ход на 2) и бьёт по диагонали.',
            },
        ];
    }
    
    if (normalizedTitle.includes('ценност')) {
        return [
            {
                subtitle: 'Ценность фигур',
                text: 'Каждая фигура имеет свою ценность: ♙ Пешка = 1 очко, ♘ Конь = 3, ♗ Слон = 3, ♖ Ладья = 5, ♕ Ферзь = 9, а ♔ Король — бесценен.',
            },
            {
                subtitle: 'Выгодный размен',
                text: 'Зная ценности, вы легко поймёте: отдавать ладью за коня крайне невыгодно (5 > 3), а забрать ферзя соперника за ладью — отличная сделка.',
            },
            {
                subtitle: 'Главное правило',
                text: 'Помните: конкретная позиция на доске всегда важнее номинальной ценности. Иногда пожертвовать фигуру выгоднее!',
            },
        ];
    }
    
    if (normalizedTitle.includes('дебют') || normalizedTitle.includes('начало')) {
        return [
            {
                subtitle: '1. Захват центра',
                text: 'ЦЕНТР (поля e4, d4, e5, d5): займи или атакуй центр пешками, чтобы контролировать пространство на доске.',
            },
            {
                subtitle: '2. Развитие фигур',
                text: 'РАЗВИТИЕ: выводи легкие фигуры (коней и слонов) как можно быстрее. Старайся не ходить одной фигурой дважды!',
            },
            {
                subtitle: '3. Безопасность короля',
                text: 'БЕЗОПАСНОСТЬ КОРОЛЯ: сделай рокировку как можно раньше, чтобы укрыть короля в безопасном углу.',
            },
        ];
    }
    
    if (normalizedTitle.includes('рокировк')) {
        return [
            {
                subtitle: 'Суть рокировки',
                text: 'Рокировка — это единственный ход в шахматах, когда за один ход двигаются сразу две фигуры: король и ладья.',
            },
            {
                subtitle: 'Виды рокировки',
                text: 'Короткая рокировка: король идёт на g1 (или g8), ладья на f1. Длинная рокировка: король идёт на c1 (или c8), ладья на d1.',
            },
            {
                subtitle: 'Когда нельзя делать',
                text: 'Нельзя рокироваться, если: король или ладья уже ходили, между ними стоят фигуры, или король находится под шахом.',
            },
        ];
    }
    
    if (normalizedTitle.includes('шах') || normalizedTitle.includes('мат') || normalizedTitle.includes('пат')) {
        return [
            {
                subtitle: 'Шах',
                text: 'ШАХ — это прямое нападение фигуры соперника на вашего короля. Король обязан защититься: уйти, закрыться или срубить атакующую фигуру.',
            },
            {
                subtitle: 'Мат',
                text: 'МАТ — это шах, от которого нет спасения. Король атакован и не имеет защиты. Это означает немедленную победу!',
            },
            {
                subtitle: 'Пат',
                text: 'ПАТ — ситуация, когда у игрока нет ни одного разрешенного хода, но его король при этом не под шахом. Это ничья!',
            },
        ];
    }
    
    if (normalizedTitle.includes('вилк') || normalizedTitle.includes('двойной')) {
        return [
            {
                subtitle: 'Что такое вилка?',
                text: 'Вилка (двойной удар) — это тактический приём, при котором одна фигура нападает сразу на две или более фигуры соперника.',
            },
            {
                subtitle: 'Вилка конём',
                text: 'Самая опасная вилка совершается конём, так как он прыгает через фигуры и может атаковать цели с неожиданных углов.',
            },
            {
                subtitle: 'Пример вилки',
                text: 'Например: конь прыгает на клетку f7 (или c7) и одновременно атакует короля и ладью соперника. Взятие ладьи неизбежно!',
            },
        ];
    }
    
    if (normalizedTitle.includes('повторен') || normalizedTitle.includes('итог')) {
        return [
            {
                subtitle: 'Базовые правила',
                text: 'Вы освоили ходы фигур, их ценность (ферзь=9, ладья=5), три принципа дебюта и важность безопасности короля.',
            },
            {
                subtitle: 'Шахматная тактика',
                text: 'Изучили шах, мат и пат (спасительную ничью), а также мощный тактический приём — вилку (двойной удар).',
            },
            {
                subtitle: 'Главный совет',
                text: 'Запомните главный принцип: каждый ваш ход должен делать что-то полезное и иметь чёткую цель на доске!',
            },
        ];
    }

    // Dynamic split fallback for other/AI-generated lessons
    const sentences = body.match(/[^.!?]+[.!?]+/g) || [body];
    if (sentences.length >= 3) {
        const count = Math.ceil(sentences.length / 3);
        return [
            {
                subtitle: 'Часть 1',
                text: sentences.slice(0, count).join(' ').trim(),
            },
            {
                subtitle: 'Часть 2',
                text: sentences.slice(count, count * 2).join(' ').trim(),
            },
            {
                subtitle: 'Часть 3',
                text: sentences.slice(count * 2).join(' ').trim(),
            },
        ];
    } else {
        return [
            { subtitle: 'Введение', text: body },
            { subtitle: 'Детали', text: 'Постарайтесь запомнить термины и закрепить знания на практике!' },
            { subtitle: 'Заключение', text: 'Желаем успехов в сегодняшнем задании!' },
        ];
    }
}

interface LearnStepProps {
    hobbyId: string;
    title: string;
    body: string;
    keywords: string[];
    onNext: () => void;
    onOpenChat?: () => void;
    onOpenTaskList?: () => void;
}

export const LearnStep: React.FC<LearnStepProps> = ({
    hobbyId,
    title,
    body,
    keywords,
    onNext,
    onOpenChat,
    onOpenTaskList,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const displayTitle = title === 'Рокировка: как и зачем' ? 'Рокировка' : title;

    const capitalize = (str: string) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // AI definition modal
    const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [loadingKeyword, setLoadingKeyword] = useState<string | null>(null);
    const [explanations, setExplanations] = useState<Record<string, string>>({});

    // Cards data
    const cards = useMemo(() => splitTextIntoThreeCards(body, title), [body, title]);
    const [activeIndex, setActiveIndex] = useState(0);

    // State to lock outer ScrollView when swiping cards
    const [scrollEnabled, setScrollEnabled] = useState(true);

    // Pan Gesture for Top Card
    const panRef = useRef(new Animated.ValueXY());

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
            // Only capture horizontal movements beyond a small threshold
            return Math.abs(gestureState.dx) > 8;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
            setScrollEnabled(false);
        },
        onPanResponderMove: (evt, gestureState) => {
            panRef.current.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderRelease: (evt, gestureState) => {
            const { dx, dy } = gestureState;
            const release = () => {
                setScrollEnabled(true);
            };

            if (Math.abs(dx) > scale(100)) {
                // Swipe out left or right
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Animated.timing(panRef.current, {
                    toValue: { x: dx > 0 ? scale(500) : -scale(500), y: dy },
                    duration: 250,
                    useNativeDriver: true,
                }).start(() => {
                    // Create a fresh Animated.Value for the next card to completely eliminate flicker
                    panRef.current = new Animated.ValueXY();
                    setActiveIndex(prev => (prev + 1) % 3);
                    release();
                });
            } else {
                // Return to center
                Animated.spring(panRef.current, {
                    toValue: { x: 0, y: 0 },
                    friction: 5,
                    useNativeDriver: true,
                }).start(release);
            }
        },
        onPanResponderTerminate: () => {
            Animated.spring(panRef.current, {
                toValue: { x: 0, y: 0 },
                friction: 5,
                useNativeDriver: true,
            }).start(() => {
                setScrollEnabled(true);
            });
        }
    }), []); // Empty deps because it reads panRef.current dynamically

    const activeCard = cards[activeIndex];

    // Pre-fetch all keywords in the background when the component mounts
    useEffect(() => {
        const prefetchKeywords = async () => {
            for (const kw of keywords) {
                try {
                    const prompt = `Объясни термин "${kw}" простыми словами в 2-3 предложениях.
Контекст: пользователь изучает "${hobbyId}" в приложении Zenyth.AI, уровень — начинающий.
Отвечай на том же языке, на котором написан термин. Не используй разметку markdown, пиши простым и тёплым текстом с 1 смайликом.`;
                    
                    const res = await aiService.sendMessage([{ role: 'user', content: prompt }], hobbyId);
                    setExplanations(prev => ({ ...prev, [kw]: res }));
                    
                    // Small delay to let the API breathe
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (err) {
                    console.error(`[LearnStep] Error prefetching keyword "${kw}":`, err);
                }
            }
        };

        if (keywords.length > 0) {
            prefetchKeywords();
        }
    }, [keywords, hobbyId]);

    const handleKeywordPress = async (keyword: string) => {
        // If already pre-fetched, open modal INSTANTLY!
        if (explanations[keyword]) {
            setExplanation(explanations[keyword]);
            setSelectedKeyword(capitalize(keyword));
            return;
        }

        // Fallback: If not pre-fetched yet, fetch on-demand
        if (loadingKeyword) return;
        console.log('[LearnStep] Keyword pressed (on-demand fallback):', keyword);
        setLoadingKeyword(keyword);

        try {
            const prompt = `Объясни термин "${keyword}" простыми словами в 2-3 предложениях.
Контекст: пользователь изучает "${hobbyId}" в приложении Zenyth.AI, уровень — начинающий.
Отвечай на том же языке, на котором написан термин. Не используй разметку markdown, пиши простым и тёплым текстом с 1 смайликом.`;

            const res = await aiService.sendMessage([{ role: 'user', content: prompt }], hobbyId);
            setExplanations(prev => ({ ...prev, [keyword]: res }));
            setExplanation(res);
            setSelectedKeyword(capitalize(keyword));
        } catch (err) {
            console.error('[LearnStep] Error fetching keyword explanation:', err);
            setExplanation('Не удалось загрузить объяснение. Попробуйте ещё раз.');
            setSelectedKeyword(capitalize(keyword));
        } finally {
            setLoadingKeyword(null);
        }
    };

    const renderCardStack = () => {
        const pan = panRef.current;

        // Interpolations for card 1 (middle card)
        const bgCard1Scale = pan.x.interpolate({
            inputRange: [-scale(150), 0, scale(150)],
            outputRange: [1, 0.95, 1],
            extrapolate: 'clamp',
        });
        const bgCard1TranslateY = pan.x.interpolate({
            inputRange: [-scale(150), 0, scale(150)],
            outputRange: [0, scale(12), 0],
            extrapolate: 'clamp',
        });
        const bgCard1Opacity = pan.x.interpolate({
            inputRange: [-scale(150), 0, scale(150)],
            outputRange: [1, 0.95, 1],
            extrapolate: 'clamp',
        });

        // Interpolations for card 2 (bottom card)
        const bgCard2Scale = pan.x.interpolate({
            inputRange: [-scale(150), 0, scale(150)],
            outputRange: [0.95, 0.90, 0.95],
            extrapolate: 'clamp',
        });
        const bgCard2TranslateY = pan.x.interpolate({
            inputRange: [-scale(150), 0, scale(150)],
            outputRange: [scale(12), scale(24), scale(12)],
            extrapolate: 'clamp',
        });
        const bgCard2Opacity = pan.x.interpolate({
            inputRange: [-scale(150), 0, scale(150)],
            outputRange: [0.95, 0.75, 0.95],
            extrapolate: 'clamp',
        });

        // Opacity interpolation for top card to fade out as it is swiped away
        const topCardOpacity = pan.x.interpolate({
            inputRange: [-scale(130), 0, scale(130)],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
        });

        const renderCardContent = (cardItem: typeof cards[0], isTop: boolean) => {
            return (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={styles.cardSubtitle}>{cardItem.subtitle}</Text>
                    <Text style={styles.cardText}>{cardItem.text}</Text>
                    <Text style={styles.swipeHint}>
                        Свайп для следующей карты ➔
                    </Text>
                </View>
            );
        };

        return [2, 1, 0].map(depth => {
            const cardIndex = (activeIndex + depth) % 3;
            const card = cards[cardIndex];
            if (!card) return null;

            const isTopCard = depth === 0;

            const cardStyle = isTopCard ? {
                transform: [
                    { scale: 1 },
                    { translateY: 0 },
                ],
                backgroundColor: cardIndex === 0 ? '#8CDEFF' : cardIndex === 1 ? '#78BAFF' : '#7EB0FF',
                zIndex: 3,
                opacity: topCardOpacity,
                elevation: 0,
                shadowOpacity: 0,
            } : depth === 1 ? {
                transform: [
                    { scale: bgCard1Scale },
                    { translateY: bgCard1TranslateY },
                ],
                backgroundColor: cardIndex === 0 ? '#8CDEFF' : cardIndex === 1 ? '#78BAFF' : '#7EB0FF',
                zIndex: 2,
                opacity: bgCard1Opacity,
                elevation: 0,
                shadowOpacity: 0,
            } : {
                transform: [
                    { scale: bgCard2Scale },
                    { translateY: bgCard2TranslateY },
                ],
                backgroundColor: cardIndex === 0 ? '#8CDEFF' : cardIndex === 1 ? '#78BAFF' : '#7EB0FF',
                zIndex: 1,
                opacity: bgCard2Opacity,
                elevation: 0,
                shadowOpacity: 0,
            };

            if (isTopCard) {
                const rotate = pan.x.interpolate({
                    inputRange: [-scale(200), 0, scale(200)],
                    outputRange: ['-10deg', '0deg', '10deg'],
                    extrapolate: 'clamp',
                });

                return (
                    <Animated.View
                        key={`depth-${depth}`}
                        {...panResponder.panHandlers}
                        style={[
                            styles.card,
                            cardStyle,
                            {
                                transform: [
                                    { translateX: pan.x },
                                    { translateY: pan.y },
                                    { rotate },
                                ],
                            },
                        ]}
                    >
                        {renderCardContent(card, true)}
                    </Animated.View>
                );
            } else {
                return (
                    <Animated.View
                        key={`depth-${depth}`}
                        style={[styles.card, styles.cardBehind, cardStyle]}
                    >
                        {renderCardContent(card, false)}
                    </Animated.View>
                );
            }
        });
    };

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={scrollEnabled}
            >
                {/* Big Title at the very top, outside the card, as on reference */}
                <Text style={styles.outerTitle}>{displayTitle}</Text>

                <View style={styles.stackContainer} key={activeIndex}>
                    {renderCardStack()}
                </View>

                {/* Dot Pagination Indicator */}
                <View style={styles.dotsContainer}>
                    {cards.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                activeIndex === i ? styles.activeDot : null
                            ]}
                        />
                    ))}
                </View>

                {keywords.length > 0 && (
                    <View style={styles.keywordsSection}>
                        <Text style={styles.keywordsTitle}>
                            {t('Термины')}
                        </Text>
                        <View style={styles.keywordsContainer}>
                            {keywords.map((kw, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={styles.keywordBadge}
                                    onPress={() => handleKeywordPress(kw)}
                                    activeOpacity={0.7}
                                    disabled={loadingKeyword !== null}
                                >
                                    {loadingKeyword === kw ? (
                                        <ActivityIndicator size="small" color="#0F2147" style={{ transform: [{ scale: 0.8 }] }} />
                                    ) : (
                                        <Text style={styles.keywordText}>{capitalize(kw)}</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity style={styles.nextButton} onPress={onNext} activeOpacity={0.8}>
                <Text style={styles.nextButtonText}>{t('Далее')}</Text>
            </TouchableOpacity>

            {/* Keyword Explanation Modal */}
            <Modal
                transparent
                visible={selectedKeyword !== null}
                animationType="fade"
                onRequestClose={() => setSelectedKeyword(null)}
            >
                <BlurView intensity={40} tint="light" style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{selectedKeyword}</Text>
                        <Text style={styles.modalBody}>{explanation}</Text>

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setSelectedKeyword(null)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalCloseText}>{t('Понятно')}</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </Modal>
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EDF2F7',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        paddingTop: scale(15),
        paddingBottom: scale(180),
        paddingHorizontal: scale(24),
    },
    outerTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(36),
        lineHeight: scale(42),
        color: '#1A253C',
        marginBottom: scale(36),
        marginTop: scale(25),
    },
    stackContainer: {
        position: 'relative',
        minHeight: scale(240),
        marginBottom: scale(28),
    },
    card: {
        backgroundColor: '#8CDEFF',
        borderRadius: scale(24),
        padding: scale(24),
        borderWidth: 0,
        minHeight: scale(190),
        justifyContent: 'center',
    },
    cardBehind: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
    },
    cardSubtitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(19),
        lineHeight: scale(24),
        color: '#1A253C',
        marginBottom: scale(10),
    },
    cardText: {
        fontFamily: fonts.body?.light || fonts.heading.light,
        fontSize: scale(15),
        lineHeight: scale(22),
        color: '#2B3E60',
    },
    swipeHint: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(11),
        color: 'rgba(43, 62, 96, 0.4)',
        textAlign: 'right',
        marginTop: scale(12),
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(8),
        marginTop: scale(-12),
        marginBottom: scale(24),
    },
    dot: {
        width: scale(8),
        height: scale(8),
        borderRadius: scale(4),
        backgroundColor: '#D1DCEF',
    },
    activeDot: {
        width: scale(20),
        backgroundColor: '#0F2147',
    },
    floatingZenythBtn: {
        position: 'absolute',
        bottom: scale(132),
        right: scale(24),
        width: scale(54),
        height: scale(54),
        borderRadius: scale(27),
        backgroundColor: '#D6EEFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
    },
    keywordsSection: {
        marginTop: scale(4),
    },
    keywordsTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        lineHeight: scale(30),
        color: '#1A253C',
        marginBottom: scale(16),
    },
    keywordsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: scale(12),
    },
    keywordBadge: {
        backgroundColor: '#D1DCEF',
        borderRadius: scale(20),
        paddingHorizontal: scale(20),
        paddingVertical: scale(10),
    },
    keywordText: {
        fontFamily: fonts.body?.regular || fonts.heading.regular || undefined,
        fontWeight: '400',
        fontSize: scale(15),
        color: '#2B3E60',
    },
    nextButton: {
        position: 'absolute',
        bottom: scale(60),
        left: scale(24),
        right: scale(24),
        backgroundColor: '#0F2147',
        borderRadius: scale(30),
        height: scale(56),
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: '#FFFFFF',
    },
    // Modal Styles
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(30),
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(24),
        padding: scale(24),
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(15, 33, 71, 0.1)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: '#1A253C',
        marginBottom: scale(16),
        textAlign: 'center',
    },
    modalBody: {
        fontFamily: fonts.body?.light || fonts.heading.light,
        fontSize: scale(16),
        lineHeight: scale(22),
        color: '#2B3E60',
        textAlign: 'center',
        marginBottom: scale(24),
    },
    modalCloseButton: {
        backgroundColor: '#0F2147',
        borderRadius: scale(20),
        paddingVertical: scale(10),
        paddingHorizontal: scale(30),
        minWidth: scale(120),
        alignItems: 'center',
    },
    modalCloseText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: '#FFFFFF',
    },
});

export default LearnStep;
