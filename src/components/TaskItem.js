// TaskItem Component — Single task with completion toggle
import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/theme';
import { getPriorityColor, getCategoryLabel } from '../utils/helpers';

const TaskItem = ({ task, onToggle, onPress, onDelete, showSource = false }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const swipeableRef = useRef(null);

    const handleToggle = () => {
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        onToggle && onToggle(task);
    };

    const priorityColor = getPriorityColor(task.priority);
    const isCompleted = task.completed;

    const handleDelete = () => {
        swipeableRef.current?.close();
        onDelete && onDelete(task);
    };

    const renderRightActions = () => {
        if (!onDelete) return null;

        return (
            <TouchableOpacity
                style={styles.deleteAction}
                onPress={handleDelete}
                activeOpacity={0.85}
            >
                <View style={styles.binIcon}>
                    <View style={styles.binLidHandle} />
                    <View style={styles.binLid} />
                    <View style={styles.binBody}>
                        <View style={styles.binLine} />
                        <View style={styles.binLine} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false}>
            <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
                <TouchableOpacity
                    style={styles.checkbox}
                    onPress={handleToggle}
                    activeOpacity={0.7}
                >
                    <View style={[
                        styles.checkboxInner,
                        isCompleted && styles.checkboxCompleted,
                        { borderColor: isCompleted ? COLORS.success : priorityColor }
                    ]}>
                        {isCompleted && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.content}
                    onPress={() => onPress && onPress(task)}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.taskText,
                        isCompleted && styles.taskTextCompleted,
                    ]}>
                        {task.text}
                    </Text>

                    <View style={styles.meta}>
                        {task.dueDescription && (
                            <View style={[styles.badge, { backgroundColor: COLORS.warningDim }]}>
                                <Text style={[styles.badgeText, { color: COLORS.warning }]}>
                                    Due {task.dueDescription}
                                </Text>
                            </View>
                        )}
                        {task.category && (
                            <View style={[styles.badge, { backgroundColor: COLORS.infoDim }]}>
                                <Text style={[styles.badgeText, { color: COLORS.info }]}>
                                    {getCategoryLabel(task.category)}
                                </Text>
                            </View>
                        )}
                    </View>
            </TouchableOpacity>
            </Animated.View>
        </Swipeable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    checkbox: {
        marginRight: SPACING.md,
        marginTop: 2,
    },
    checkboxInner: {
        width: 22,
        height: 22,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxCompleted: {
        backgroundColor: COLORS.success,
    },
    checkmark: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: FONT_WEIGHT.bold,
    },
    content: {
        flex: 1,
    },
    taskText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
        lineHeight: 22,
    },
    taskTextCompleted: {
        color: COLORS.textTertiary,
        textDecorationLine: 'line-through',
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.xs,
        gap: SPACING.sm,
    },
    badge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
    },
    badgeText: {
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.medium,
    },
    deleteAction: {
        width: 92,
        marginBottom: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        backgroundColor: COLORS.urgent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    binIcon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    binLidHandle: {
        width: 10,
        height: 3,
        borderRadius: 2,
        backgroundColor: '#FFFFFF',
        marginBottom: 2,
    },
    binLid: {
        width: 24,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFFFFF',
        marginBottom: 2,
    },
    binBody: {
        width: 20,
        height: 22,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        borderTopWidth: 2,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 4,
        paddingTop: 2,
    },
    binLine: {
        width: 2,
        height: 10,
        borderRadius: 1,
        backgroundColor: '#FFFFFF',
    },
});

export default TaskItem;
