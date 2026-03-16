export interface AppError {
    message: string;
    code?: string;
}

export function toAppError(error: unknown, defaultMessage = 'Unknown error'): AppError {
    if (error instanceof Error) {
        return { message: error.message };
    }

    if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
        return { message: (error as any).message };
    }

    try {
        const stringified = JSON.stringify(error);
        return { message: stringified || defaultMessage };
    } catch {
        return { message: defaultMessage };
    }
}

