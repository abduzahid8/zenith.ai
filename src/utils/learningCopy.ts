import type { ReasonCode } from '../domain/sessions/nextBestAction';

/**
 * UI copy for recommendation reason codes (RU-first, like the rest of the
 * session UI). Domain logic emits codes only; screens map them here.
 */
export function reasonCopy(reasonCode: ReasonCode, data?: { skillName?: string; day?: number }): string {
    const skill = data?.skillName ?? '';
    const day = data?.day;
    const where = skill && day ? ` «${skill}», день ${day}` : skill ? ` «${skill}»` : '';
    switch (reasonCode) {
        case 'recent_validation_failure':
            return `Сложности${where} — разберём заново`;
        case 'repeated_application_struggle':
            return `«${skill || 'Навык'}» даётся с трудом — короткая практика`;
        case 'recall_gap':
            return `Пробел${where} — быстро повторим`;
        case 'missing_validation':
            return `Готов проверить${where ? ` «${skill}»` : ''}`;
        case 'continue_path':
            return 'Продолжаем путь';
        case 'insufficient_evidence':
            return 'Начни с текущего шага';
    }
}
