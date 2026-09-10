import type { ReasonCode } from '../domain/sessions/nextBestAction';
import type { Language } from '../store/languageStore';

/**
 * UI copy for recommendation reason codes. Domain logic emits codes only;
 * screens map them here AT the UI boundary with the selected language.
 * RU-first to match the session UI; EN provided for English mode.
 */
export function reasonCopy(
    reasonCode: ReasonCode,
    data?: { skillName?: string; day?: number },
    language: Language = 'ru',
): string {
    const skill = data?.skillName ?? '';
    const day = data?.day;
    if (language === 'en') {
        const where = skill && day ? ` "${skill}", day ${day}` : skill ? ` "${skill}"` : '';
        switch (reasonCode) {
            case 'recent_validation_failure':
                return `Struggled${where} — let's rebuild it`;
            case 'repeated_application_struggle':
                return `"${skill || 'Skill'}" needs work — short practice`;
            case 'recall_gap':
                return `Gap${where} — quick review`;
            case 'missing_validation':
                return `Ready to prove${where ? ` "${skill}"` : ''}`;
            case 'continue_path':
                return 'Continuing the path';
            case 'insufficient_evidence':
                return 'Start from the current step';
        }
    }
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
