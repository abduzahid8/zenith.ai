import React from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated, StyleSheet, Image } from 'react-native';
import { Svg, Polyline } from 'react-native-svg';
import { scale } from '../../constants';
import { colors, fonts } from '../../theme';

export interface SessionTask {
    id: string;
    title: string;
    subtitle: string;
    completed: boolean;
    completedAt: number | null;
}

export interface TaskDrawerProps {
    /** List of tasks to display */
    tasks: SessionTask[];
    /** Animated value controlling drawer position (translateX) */
    drawerAnim: Animated.Value;
    /** Animated value controlling backdrop opacity */
    backdropAnim: Animated.Value;
    /** Called when a task's complete button is pressed */
    onCompleteTask: (id: string) => void;
    /** Called when the drawer should close (backdrop tap) */
    onClose: () => void;
}

const TaskDrawer: React.FC<TaskDrawerProps> = ({
    tasks,
    drawerAnim,
    backdropAnim,
    onCompleteTask,
    onClose,
}) => {
    return (
        <>
            {/* Backdrop */}
            <Animated.View style={[styles.drawerBackdrop, { opacity: backdropAnim }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            {/* Side Drawer */}
            <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: drawerAnim }] }]}>
                <Text style={styles.drawerTitle}>Твои задачи</Text>

                <View style={styles.componentsContainer}>
                    {tasks.map(task => (
                        <View key={task.id} style={styles.taskCard}>
                            <Text style={styles.taskTitle}>{task.title}</Text>
                            <Text style={styles.taskSubtitle}>{task.subtitle}</Text>
                            <TouchableOpacity
                                style={[styles.addButton, task.completed && styles.completedButton]}
                                onPress={() => onCompleteTask(task.id)}
                                disabled={task.completed}
                            >
                                {task.completed ? (
                                    <Svg
                                        width={scale(18)}
                                        height={scale(12)}
                                        viewBox="0 0 18 12"
                                        fill="none"
                                    >
                                        <Polyline
                                            points="2 6 6 10 16 2"
                                            stroke="#E4FAEB"
                                            strokeWidth="5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </Svg>
                                ) : (
                                    <Image
                                        source={require('../../../icons/plus.png')}
                                        style={{
                                            width: scale(21),
                                            height: scale(20),
                                            tintColor: colors.home.darkText
                                        }}
                                        resizeMode="contain"
                                    />
                                )}
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    drawerBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 100,
    },
    drawerContainer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: scale(286),
        backgroundColor: colors.sessionTimer.drawerBg,
        zIndex: 101,
        paddingHorizontal: scale(25),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.text,
        shadowOffset: { width: 5, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 20,
    },
    drawerTitle: {
        color: colors.sessionTimer.drawerText,
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        fontWeight: '700',
        lineHeight: scale(38),
        alignSelf: 'stretch',
        marginBottom: scale(20),
    },
    componentsContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: scale(10),
        alignSelf: 'stretch',
    },
    taskCard: {
        backgroundColor: colors.sessionTimer.taskBg,
        borderRadius: scale(16),
        padding: scale(16),
        width: '100%',
    },
    taskTitle: {
        color: 'white',
        fontSize: scale(18),
        fontFamily: fonts.heading.bold,
        marginBottom: scale(4),
    },
    taskSubtitle: {
        color: colors.sessionTimer.taskMuted,
        fontSize: scale(14),
        fontFamily: fonts.heading.regular,
        marginBottom: scale(12),
    },
    addButton: {
        backgroundColor: colors.sessionTimer.taskCheckbox,
        borderRadius: scale(20),
        height: scale(36),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(8),
    },
    completedButton: {
        backgroundColor: colors.sessionTimer.taskDone,
    },
});

export default TaskDrawer;
