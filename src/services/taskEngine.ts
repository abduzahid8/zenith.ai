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
            // Adjust duration based on average session time
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

        // --- 2. Select Balanced Pair ---
        // Pairs: Theory + Puzzles / Practice + Analysis / Theory + Practice
        const pairs: [TaskType, TaskType][] = [
            ['theory', 'puzzles'],
            ['practice', 'analysis'],
            ['theory', 'practice']
        ];

        // Randomly select one pair (could be rotated based on previous day if we had history)
        const selectedPair = pairs[Math.floor(Math.random() * pairs.length)];

        // --- 3. Generate 2 Tasks ---

        selectedPair.forEach(type => {
            let title = '';
            let duration = baseDuration;

            switch (type) {
                case 'theory':
                    title = generateTheoryTitle(hobbyId, difficultyLevel);
                    duration = 15;
                    break;
                case 'practice':
                    title = generatePracticeTitle(hobbyId, difficultyLevel);
                    duration = 30;
                    break;
                case 'analysis':
                    title = generateAnalysisTitle(hobbyId);
                    duration = 20;
                    break;
                case 'puzzles':
                    title = generatePuzzlesTitle(hobbyId);
                    duration = 15;
                    break;
            }

            tasks.push({
                user_id: userId,
                title,
                type,
                status: 'pending',
                hobby_id: hobbyId,
                scheduled_date: dateString,
                duration_minutes: duration,
                is_ai_generated: false
            });
        });



        return tasks;
    },

    generateTaskByType: (
        userId: string,
        type: TaskType,
        dateString: string,
        snapshot: UserStateSnapshot | null,
        hobbies: UserHobby[],
        template?: { title: string; duration: number } // Added optional template
    ): Task => {
        // Default params
        let baseDuration = 15;
        let difficultyLevel = 'beginner';

        if (snapshot) {
            if (snapshot.avg_session_time && snapshot.avg_session_time > 0) {
                baseDuration = Math.min(60, Math.max(5, snapshot.avg_session_time + 5));
            }
        }

        const primaryHobby = hobbies.find(h => h.is_primary) || hobbies[0];
        const hobbyId = primaryHobby?.hobby_id;

        let title = '';
        let duration = baseDuration;

        if (template) {
            title = template.title;
            duration = template.duration;
        } else {
            // Fallback to random generation if no template provided
            switch (type) {
                case 'theory':
                    title = generateTheoryTitle(hobbyId, difficultyLevel);
                    duration = 15;
                    break;
                case 'practice':
                    title = generatePracticeTitle(hobbyId, difficultyLevel);
                    duration = 30;
                    break;
                case 'analysis':
                    title = generateAnalysisTitle(hobbyId);
                    duration = 20;
                    break;
                case 'puzzles':
                    title = generatePuzzlesTitle(hobbyId);
                    duration = 15;
                    break;
                default:
                    title = 'New Task';
                    duration = 15;
            }
        }

        return {
            user_id: userId,
            title,
            type,
            status: 'pending',
            hobby_id: hobbyId,
            scheduled_date: dateString,
            duration_minutes: duration,
            is_ai_generated: false,
            is_manual: true // Mark as manually added
        };
    },

    getAvailableTaskTemplates: (hobbyId: string | undefined, type: TaskType): TaskTemplate[] => {
        const hobbyKey = hobbyId && TASK_TEMPLATES_DATA[hobbyId] ? hobbyId : 'default';
        return TASK_TEMPLATES_DATA[hobbyKey]?.[type] || TASK_TEMPLATES_DATA['default'][type] || [];
    },
};

// --- 4. Task Templates & Helpers ---

export interface TaskTemplate {
    title: string;
    duration: number; // default duration
    minDifficulty?: 'beginner' | 'advanced' | 'recovery';
}

const TASK_TEMPLATES_DATA: Record<string, Record<TaskType, TaskTemplate[]>> = {
    chess: {
        theory: [
            { title: 'Изучить дебют', duration: 15 },
            { title: 'Разбор партии гроссмейстера', duration: 20 },
            { title: 'Теория эндшпиля', duration: 15 },
            { title: 'Изучить Королевский Гамбит', duration: 20 },
            { title: 'Основы стратегии', duration: 15 }
        ],
        practice: [
            { title: 'Сыграть 2 партии', duration: 30 },
            { title: 'Сыграть турнир', duration: 60 },
            { title: 'Блиц-марафон (3 партии)', duration: 15 },
            { title: 'Игра с компьютером (уровень 5)', duration: 20 }
        ],
        analysis: [
            { title: 'Рассмотреть партию', duration: 20 },
            { title: 'Анализ своих ошибок', duration: 15 },
            { title: 'Разбор партии Carlsen vs Nakamura', duration: 25 },
            { title: 'Анализ дебюта', duration: 15 }
        ],
        puzzles: [
            { title: 'Решить 15 тактических задач', duration: 15 },
            { title: 'Решить этюд', duration: 20 },
            { title: 'Задачи на мат в 2 хода', duration: 10 },
            { title: 'Пазл шторм (5 мин)', duration: 5 }
        ]
    },
    video_editing: {
        theory: [
            { title: 'Изучить основы цветокоррекции', duration: 15 },
            { title: 'Теория монтажа: темп и ритм', duration: 20 },
            { title: 'Разобрать урок по переходам', duration: 15 },
            { title: 'Изучить работу со звуком', duration: 20 },
            { title: 'Основы композиции кадра', duration: 15 }
        ],
        practice: [
            { title: 'Смонтировать 1-минутный ролик', duration: 30 },
            { title: 'Создать короткий реел', duration: 45 },
            { title: 'Наложить цветокоррекцию на клип', duration: 20 },
            { title: 'Смонтировать таймлапс', duration: 30 }
        ],
        analysis: [
            { title: 'Разобрать монтаж любимого ролика', duration: 20 },
            { title: 'Найти 3 ошибки в своём проекте', duration: 15 },
            { title: 'Сравнить 2 стиля монтажа', duration: 20 }
        ],
        puzzles: [
            { title: 'Подобрать идеальную музыку к клипу', duration: 15 },
            { title: 'Создать переход без туториала', duration: 20 },
            { title: 'Воссоздать эффект из ролика', duration: 25 }
        ]
    },
    drawing: {
        theory: [
            { title: 'Изучить теорию цвета', duration: 15 },
            { title: 'Основы анатомии для художников', duration: 20 },
            { title: 'Разобрать правила перспективы', duration: 15 },
            { title: 'Изучить техники штриховки', duration: 15 },
            { title: 'Теория композиции', duration: 20 }
        ],
        practice: [
            { title: 'Нарисовать портрет по референсу', duration: 30 },
            { title: 'Зарисовка предметов вокруг (10 мин)', duration: 10 },
            { title: 'Практика линий и форм', duration: 20 },
            { title: 'Нарисовать кисти рук', duration: 25 }
        ],
        analysis: [
            { title: 'Разобрать работы любимого художника', duration: 20 },
            { title: 'Найти ошибки в пропорциях своего рисунка', duration: 15 },
            { title: 'Сравнить свой рисунок с референсом', duration: 15 }
        ],
        puzzles: [
            { title: 'Нарисовать по памяти без референса', duration: 20 },
            { title: 'Задача: передать настроение одним цветом', duration: 15 },
            { title: 'Скетч за 5 минут', duration: 5 }
        ]
    },
    music: {
        theory: [
            { title: 'Изучить основы музыкальной теории', duration: 15 },
            { title: 'Разобрать строение аккордов', duration: 20 },
            { title: 'Изучить гаммы', duration: 15 },
            { title: 'Основы сольфеджио', duration: 20 }
        ],
        practice: [
            { title: 'Сыграть гаммы (10 мин)', duration: 10 },
            { title: 'Разучить новый аккорд', duration: 20 },
            { title: 'Играть под метроном 15 минут', duration: 15 },
            { title: 'Повторить выученный кусок', duration: 25 }
        ],
        analysis: [
            { title: 'Разобрать структуру любимой песни', duration: 20 },
            { title: 'Найти ошибки в своём исполнении', duration: 15 }
        ],
        puzzles: [
            { title: 'Подобрать мелодию на слух', duration: 20 },
            { title: 'Сыграть пьесу в другой тональности', duration: 15 }
        ]
    },
    coding: {
        theory: [
            { title: 'Изучить новую концепцию программирования', duration: 20 },
            { title: 'Прочитать документацию по теме', duration: 15 },
            { title: 'Разобрать алгоритм', duration: 20 }
        ],
        practice: [
            { title: 'Написать небольшой проект (30 мин)', duration: 30 },
            { title: 'Реализовать функцию с нуля', duration: 25 },
            { title: 'Рефакторинг старого кода', duration: 20 }
        ],
        analysis: [
            { title: 'Ревью своего кода', duration: 15 },
            { title: 'Разобрать чужой открытый проект', duration: 20 }
        ],
        puzzles: [
            { title: 'Решить задачу на LeetCode', duration: 20 },
            { title: 'Задача на алгоритмы', duration: 25 }
        ]
    },
    // Fallback/Default
    default: {
        theory: [
            { title: 'Изучить теорию', duration: 15 },
            { title: 'Прочитать статью', duration: 15 },
            { title: 'Посмотреть урок', duration: 20 }
        ],
        practice: [
            { title: 'Практическое упражнение', duration: 30 },
            { title: 'Тренировка навыка', duration: 20 },
            { title: 'Закрепление материала', duration: 25 }
        ],
        analysis: [
            { title: 'Анализ проделанной работы', duration: 15 },
            { title: 'Работа над ошибками', duration: 20 }
        ],
        puzzles: [
            { title: 'Решить головоломки', duration: 15 },
            { title: 'Задачи на логику', duration: 15 }
        ]
    }
};

// Helper Functions that now use the constant data/logic (can stay or be refactored)
// For backward compatibility and specific logic (like 'recovery'), we keep them but can make them pick from the templates.

function generateTheoryTitle(hobbyId: string | undefined, difficulty: string): string {
    if (!hobbyId && !TASK_TEMPLATES_DATA['default']) return 'Изучить что-то новое';

    if (difficulty === 'recovery') {
        const recovery = ['Повторить основы', 'Пересмотреть базовый урок', 'Легкое чтение по теме'];
        return recovery[Math.floor(Math.random() * recovery.length)];
    }

    const templates = taskEngine.getAvailableTaskTemplates(hobbyId, 'theory');
    const random = templates[Math.floor(Math.random() * templates.length)];
    return random ? random.title : 'Изучить теорию';
}

function generatePracticeTitle(hobbyId: string | undefined, difficulty: string): string {
    if (difficulty === 'recovery') return 'Легкая разминка (5 мин)';
    const templates = taskEngine.getAvailableTaskTemplates(hobbyId, 'practice');
    const random = templates[Math.floor(Math.random() * templates.length)];
    return random ? random.title : 'Практика';
}

function generateAnalysisTitle(hobbyId: string | undefined): string {
    const templates = taskEngine.getAvailableTaskTemplates(hobbyId, 'analysis');
    const random = templates[Math.floor(Math.random() * templates.length)];
    return random ? random.title : 'Анализ';
}

function generatePuzzlesTitle(hobbyId: string | undefined): string {
    const templates = taskEngine.getAvailableTaskTemplates(hobbyId, 'puzzles');
    const random = templates[Math.floor(Math.random() * templates.length)];
    return random ? random.title : 'Задачи';
}


