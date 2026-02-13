import {
    Task,
    TaskType,
    TaskStatus,
    UserStateSnapshot,
    UserHobby,
    UserEarning,
    EarningMethod
} from './supabase/types';

export const taskEngine = {
    generateDailyPlan: (
        userId: string,
        dateString: string,
        snapshot: UserStateSnapshot | null,
        hobbies: UserHobby[],
        activeEarnings: UserEarning[] = [],
        earningMethods: EarningMethod[] = []
    ): Task[] => {
        const tasks: Task[] = [];
        const date = new Date(dateString);

        // --- 1. Determine Difficulty & Duration based on Snapshot ---
        let baseDuration = 15; // default 15 mins
        let difficultyLevel = 'beginner';

        if (snapshot) {
            // Adjust duration based on average session time (aim for slightly more to push growth)
            if (snapshot.avg_session_time && snapshot.avg_session_time > 0) {
                baseDuration = Math.min(60, Math.max(5, snapshot.avg_session_time + 5));
            }

            // Adjust difficulty if user is struggling
            if (snapshot.loss_streak && snapshot.loss_streak > 3) {
                difficultyLevel = 'recovery'; // easier tasks
                baseDuration = Math.max(5, baseDuration - 5);
            }
        }

        // Identify primary hobby
        const primaryHobby = hobbies.find(h => h.is_primary) || hobbies[0];
        const hobbyId = primaryHobby?.hobby_id;

        // --- 2. Generate 4 Fixed Tasks ---

        // Task 1: Learning (Theory/Study)
        tasks.push({
            user_id: userId,
            title: generateLearningTitle(hobbyId, difficultyLevel),
            type: 'learning',
            status: 'pending',
            hobby_id: hobbyId,
            scheduled_date: dateString,
            duration_minutes: baseDuration,
            is_ai_generated: false
        });

        // Task 2: Practice (Hands-on)
        tasks.push({
            user_id: userId,
            title: generatePracticeTitle(hobbyId, difficultyLevel),
            type: 'practice',
            status: 'pending',
            hobby_id: hobbyId,
            scheduled_date: dateString,
            duration_minutes: baseDuration,
            is_ai_generated: false
        });

        // Task 3: Action (Career/Earning or Application)
        const earningTask = generateEarningTask(userId, dateString, activeEarnings, earningMethods);
        if (earningTask) {
            tasks.push(earningTask);
        } else {
            // Fallback action task if no earning path active
            tasks.push({
                user_id: userId,
                title: 'Применить навык на практике', // Apply skill in practice
                type: 'action',
                status: 'pending',
                hobby_id: hobbyId,
                scheduled_date: dateString,
                duration_minutes: 10,
                is_ai_generated: false
            });
        }

        // Task 4: Wellbeing (Recovery/Mindset)
        tasks.push({
            user_id: userId,
            title: generateWellbeingTitle(snapshot),
            type: 'wellbeing',
            status: 'pending',
            scheduled_date: dateString,
            duration_minutes: 5,
            is_ai_generated: false
        });

        return tasks;
    }
};

// --- Helper Functions for Title Generation ---

function generateLearningTitle(hobbyId: string | undefined, difficulty: string): string {
    if (!hobbyId) return 'Изучить что-то новое';

    if (difficulty === 'recovery') {
        const recoveryTitles = [
            'Повторить основы',
            'Пересмотреть базовый урок',
            'Легкое чтение по теме'
        ];
        return recoveryTitles[Math.floor(Math.random() * recoveryTitles.length)];
    }

    const titles: Record<string, string[]> = {
        chess: ['Изучить дебют', 'Разбор партии гроссмейстера', 'Теория эндшпиля'],
        video_editing: ['Изучить новый эффект', 'Урок по цветокоррекции', 'Анализ монтажа фильма'],
        drawing: ['Изучить пропорции', 'Теория цвета', 'Композиция кадра'],
        default: ['Изучить теорию', 'Прочитать статью', 'Посмотреть урок']
    };

    const options = titles[hobbyId as string] || titles['default'];
    return options[Math.floor(Math.random() * options.length)];
}

function generatePracticeTitle(hobbyId: string | undefined, difficulty: string): string {
    if (!hobbyId) return 'Практическая сессия';

    if (difficulty === 'recovery') {
        return 'Легкая разминка (5 мин)';
    }

    const titles: Record<string, string[]> = {
        chess: ['Решение задач (тактика)', 'Партия с анализом', 'Разыгрывание позиций'],
        video_editing: ['Монтаж короткого ролика', 'Практика переходов', 'Настройка звука'],
        drawing: ['Набросок с натуры', 'Штриховка', 'Рисунок по памяти'],
        default: ['Практическое упражнение', 'Тренировка навыка', 'Закрепление материала']
    };

    const options = titles[hobbyId as string] || titles['default'];
    return options[Math.floor(Math.random() * options.length)];
}

function generateWellbeingTitle(snapshot: UserStateSnapshot | null): string {
    if (snapshot) {
        if (snapshot.sessions_last_24h && snapshot.sessions_last_24h > 5) {
            return 'Отдохнуть от экрана 15 минут';
        }
        if (snapshot.loss_streak && snapshot.loss_streak > 2) {
            return 'Медитация или прогулка';
        }
    }
    const defaults = [
        'Сделать зарядку для глаз',
        'Короткая медитация',
        'Записать 3 успеха дня',
        'Прогулка без телефона'
    ];
    return defaults[Math.floor(Math.random() * defaults.length)];
}

function generateEarningTask(
    userId: string,
    date: string,
    activeEarnings: UserEarning[],
    earningMethods: EarningMethod[]
): Task | null {
    // Find active earning path
    const activePath = activeEarnings.find(e => e.status === 'learning' || e.status === 'practicing');

    if (!activePath) return null;

    const method = earningMethods.find(m => m.id === activePath.earning_method_id);
    if (!method) return null;

    // Get next step from method steps if available
    // For MVP, we'll generate a generic step based on status
    let title = `Работа над: ${method.title}`;

    if (activePath.status === 'learning') {
        title = `Изучить требования про ${method.title}`;
    } else if (activePath.status === 'practicing') {
        title = `Подготовить портфолио: ${method.title}`;
    }

    return {
        user_id: userId,
        title: title,
        type: 'action',
        status: 'pending',
        earning_step_id: activePath.id, // Linking to the user_earning record for now
        scheduled_date: date,
        duration_minutes: 20,
        is_ai_generated: false
    };
}
