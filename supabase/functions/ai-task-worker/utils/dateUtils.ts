export class DateUtils {
    /**
     * Returns the current date in the user's timezone in YYYY-MM-DD format.
     * Defaults to UTC if timezone is invalid or not provided.
     */
    static getTodayDate(timezone?: string): string {
        try {
            const tz = timezone || 'UTC';
            const now = new Date();
            // Create a formatter for the given timezone
            const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            return formatter.format(now);
        } catch (error) {
            console.error(`Invalid timezone '${timezone}', falling back to UTC`, error);
            return new Date().toISOString().split('T')[0];
        }
    }

    /**
     * Validates if a timezone string is supported
     */
    static isValidTimezone(timezone: string): boolean {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            return true;
        } catch {
            return false;
        }
    }
}
