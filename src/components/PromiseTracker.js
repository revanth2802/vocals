// PromiseTracker — Broken Promise Stats Widget
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, CARD_STYLE } from '../constants/theme';

const PromiseTracker = ({ stats, patterns }) => {
    const { totalSpoken = 0, totalCompleted = 0 } = stats || {};
    const broken = totalSpoken - totalCompleted;
    const completionRate = totalSpoken > 0 ? Math.round((totalCompleted / totalSpoken) * 100) : 0;

    // Get top broken promises from patterns
    const sortedPatterns = Object.entries(patterns || {})
        .map(([key, val]) => ({
            keyword: key,
            mentioned: val.mentioned,
            completed: val.completed,
            rate: val.mentioned > 0 ? Math.round((val.completed / val.mentioned) * 100) : 0,
        }))
        .filter(p => p.mentioned > 1)
        .sort((a, b) => a.rate - b.rate);

    if (totalSpoken === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Execution Score</Text>
                <View style={[styles.scoreBadge, {
                    backgroundColor: completionRate >= 70 ? COLORS.successDim :
                        completionRate >= 40 ? COLORS.warningDim : COLORS.urgentDim,
                }]}>
                    <Text style={[styles.scoreText, {
                        color: completionRate >= 70 ? COLORS.success :
                            completionRate >= 40 ? COLORS.warning : COLORS.urgent,
                    }]}>
                        {completionRate}%
                    </Text>
                </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{totalSpoken}</Text>
                    <Text style={styles.statLabel}>Spoken</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: COLORS.success }]}>{totalCompleted}</Text>
                    <Text style={styles.statLabel}>Done</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: COLORS.urgent }]}>{broken}</Text>
                    <Text style={styles.statLabel}>Broken</Text>
                </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
            </View>

            {/* Pattern Breakdown */}
            {sortedPatterns.length > 0 && (
                <View style={styles.patterns}>
                    <Text style={styles.patternsTitle}>Recurring Patterns</Text>
                    {sortedPatterns.slice(0, 3).map((pattern, idx) => (
                        <View key={idx} style={styles.patternRow}>
                            <Text style={styles.patternKeyword}>
                                {pattern.keyword}
                            </Text>
                            <Text style={styles.patternStat}>
                                mentioned {pattern.mentioned}x → done {pattern.completed}x
                            </Text>
                            <Text style={[styles.patternRate, {
                                color: pattern.rate >= 70 ? COLORS.success :
                                    pattern.rate >= 40 ? COLORS.warning : COLORS.urgent,
                            }]}>
                                {pattern.rate}%
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...CARD_STYLE,
        marginBottom: SPACING.lg,
        backgroundColor: '#F7F3FF',
        borderColor: '#E6DEFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    headerTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.bodyLarge,
        fontWeight: FONT_WEIGHT.semibold,
    },
    scoreBadge: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
    },
    scoreText: {
        fontSize: FONT_SIZE.bodyLarge,
        fontWeight: FONT_WEIGHT.heavy,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.heading,
        fontWeight: FONT_WEIGHT.bold,
    },
    statLabel: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.medium,
        marginTop: SPACING.xs,
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: '#E6DEFF',
    },
    progressBar: {
        height: 6,
        backgroundColor: '#ECE6FF',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: SPACING.lg,
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.accent,
        borderRadius: 3,
    },
    patterns: {
        borderTopWidth: 1,
        borderTopColor: '#E6DEFF',
        paddingTop: SPACING.md,
    },
    patternsTitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    patternRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.xs,
    },
    patternKeyword: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
        flex: 1,
        textTransform: 'capitalize',
    },
    patternStat: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        flex: 2,
        textAlign: 'center',
    },
    patternRate: {
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.bold,
        width: 40,
        textAlign: 'right',
    },
});

export default PromiseTracker;
