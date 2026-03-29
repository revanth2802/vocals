// Helper utilities
export const FIXED_CATEGORIES = [
    'work',
    'personal',
    'shopping',
    'travel',
    'career',
    'health',
    'finance',
    'learning',
];

export const normalizeCategory = (category) => {
    switch ((category || '').toLowerCase()) {
        case 'work':
        case 'meeting':
        case 'debug':
            return 'work';
        case 'personal':
        case 'social':
        case 'reflection':
        case 'other':
        case 'inbox':
        case 'braindump':
            return 'personal';
        case 'shopping':
            return 'shopping';
        case 'travel':
            return 'travel';
        case 'career':
        case 'job':
        case 'jobs':
        case 'startup':
            return 'career';
        case 'health':
            return 'health';
        case 'finance':
        case 'money':
            return 'finance';
        case 'learning':
        case 'school':
        case 'study':
            return 'learning';
        default:
            return 'personal';
    }
};

export const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getPriorityColor = (priority) => {
    switch (priority) {
        case 'high': return '#FF3B30';
        case 'medium': return '#FFD60A';
        case 'low': return '#5E5CE6';
        default: return '#A0A0A0';
    }
};

export const getCategoryIconName = (category) => {
    switch (normalizeCategory(category)) {
        case 'work': return 'briefcase-outline';
        case 'personal': return 'person-outline';
        case 'shopping': return 'bag-handle-outline';
        case 'travel': return 'airplane-outline';
        case 'career': return 'trending-up-outline';
        case 'health': return 'heart-outline';
        case 'finance': return 'wallet-outline';
        case 'learning': return 'school-outline';
        default: return 'person-outline';
    }
};

export const getCategoryLabel = (category) => {
    switch (normalizeCategory(category)) {
        case 'work': return 'Work';
        case 'personal': return 'Personal';
        case 'shopping': return 'Shopping';
        case 'travel': return 'Travel';
        case 'career': return 'Career';
        case 'health': return 'Health';
        case 'finance': return 'Finance';
        case 'learning': return 'Learning';
        default: return 'Personal';
    }
};

export const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
};

export const truncateText = (text, maxLength = 100) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
};
