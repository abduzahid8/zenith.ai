export const getTodayDateString = (): string => {
    return new Date().toISOString().split('T')[0];
}
