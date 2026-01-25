// Hobby Database with Profile "Passports"
// Each hobby has scores for 4 axes (8 dimensions)

export interface HobbyProfile {
    // Axis A - Energy Type
    mental: number;      // 🧠 Thinking, analyzing
    creative: number;    // 🎨 Creating
    physical: number;    // 🏃 Movement, body

    // Axis B - Engagement Style  
    structure: number;   // 📏 Plan, rules
    freedom: number;     // 🎮 Experiments, improvisation

    // Axis C - Sociality
    individual: number;  // 👤 Solo
    social: number;      // 👥 With people

    // Axis D - Patience for Complexity
    quick: number;       // ⚡ Quick result
    long: number;        // 🧗 Long path
}

export interface Hobby {
    id: string;
    title: string;
    titleRu: string;
    emoji: string;
    category: string;
    description: string;
    whyFitsYou: string[];
    timePerDay: string;
    thirtyDayResult: string;
    profile: HobbyProfile;
}

// 25 Hobbies with Full Profiles
export const HOBBIES_DATABASE: Hobby[] = [
    // 🧠 Intellectual / Cognitive Development
    {
        id: 'chess',
        title: 'Chess',
        titleRu: 'Шахматы',
        emoji: '♟',
        category: 'intellectual',
        description: 'Развивай стратегическое мышление',
        whyFitsYou: [
            'Тренирует концентрацию и логику',
            'Видимый прогресс в рейтинге',
            'Можно играть в любое время'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: 'Улучшение логического мышления на 40%',
        profile: { mental: 9, creative: 2, physical: 1, structure: 7, freedom: 4, individual: 8, social: 3, quick: 4, long: 8 }
    },
    {
        id: 'english',
        title: 'English Language',
        titleRu: 'Английский язык',
        emoji: '🇬🇧',
        category: 'intellectual',
        description: 'Изучай язык международного общения',
        whyFitsYou: [
            'Открывает новые возможности',
            'Чёткий прогресс по уровням',
            'Полезно для карьеры'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: 'Освоение 500+ новых слов',
        profile: { mental: 6, creative: 3, physical: 1, structure: 6, freedom: 5, individual: 6, social: 6, quick: 4, long: 7 }
    },
    {
        id: 'languages',
        title: 'Language Learning',
        titleRu: 'Изучение языков',
        emoji: '🌍',
        category: 'intellectual',
        description: 'Испанский, корейский, французский и другие',
        whyFitsYou: [
            'Развивает память и мозг',
            'Открывает новые культуры',
            'Чёткая система прогресса'
        ],
        timePerDay: '30-45 минут',
        thirtyDayResult: 'Базовые разговорные навыки',
        profile: { mental: 6, creative: 3, physical: 1, structure: 6, freedom: 5, individual: 5, social: 6, quick: 4, long: 7 }
    },
    {
        id: 'logic_puzzles',
        title: 'Logic & Puzzles',
        titleRu: 'Логика и головоломки',
        emoji: '🧩',
        category: 'intellectual',
        description: 'Тренируй мозг через задачи',
        whyFitsYou: [
            'Быстрый результат каждой задачи',
            'Повышает IQ и концентрацию',
            'Можно заниматься где угодно'
        ],
        timePerDay: '20-40 минут',
        thirtyDayResult: 'Улучшение скорости мышления на 30%',
        profile: { mental: 9, creative: 2, physical: 1, structure: 7, freedom: 4, individual: 9, social: 1, quick: 6, long: 5 }
    },
    {
        id: 'speed_reading',
        title: 'Speed Reading',
        titleRu: 'Скорочтение',
        emoji: '📚',
        category: 'intellectual',
        description: 'Читай в 3-5 раз быстрее',
        whyFitsYou: [
            'Экономит время на обучение',
            'Видимый прогресс в скорости',
            'Полезно для любой сферы'
        ],
        timePerDay: '20-30 минут',
        thirtyDayResult: 'Увеличение скорости чтения в 2 раза',
        profile: { mental: 7, creative: 2, physical: 1, structure: 8, freedom: 3, individual: 9, social: 1, quick: 7, long: 4 }
    },
    {
        id: 'public_speaking',
        title: 'Public Speaking',
        titleRu: 'Ораторское искусство',
        emoji: '🎤',
        category: 'intellectual',
        description: 'Учись выступать уверенно',
        whyFitsYou: [
            'Повышает уверенность в себе',
            'Полезно для карьеры',
            'Видимый прогресс'
        ],
        timePerDay: '30-45 минут',
        thirtyDayResult: 'Уверенное выступление на 5 минут',
        profile: { mental: 6, creative: 5, physical: 2, structure: 6, freedom: 5, individual: 4, social: 8, quick: 5, long: 6 }
    },

    // 💻 Technology / Digital Skills
    {
        id: 'programming',
        title: 'Programming',
        titleRu: 'Программирование',
        emoji: '💻',
        category: 'technology',
        description: 'Python, JavaScript и No-Code',
        whyFitsYou: [
            'Высокооплачиваемый навык',
            'Логика + творчество',
            'Видимый результат в коде'
        ],
        timePerDay: '1-2 часа',
        thirtyDayResult: 'Первое работающее приложение',
        profile: { mental: 9, creative: 4, physical: 1, structure: 8, freedom: 4, individual: 8, social: 3, quick: 4, long: 9 }
    },
    {
        id: 'web_design',
        title: 'Web Design / UI',
        titleRu: 'Веб-дизайн / UI',
        emoji: '🎨',
        category: 'technology',
        description: 'Создавай красивые интерфейсы',
        whyFitsYou: [
            'Творчество + технологии',
            'Быстрый визуальный результат',
            'Востребованный навык'
        ],
        timePerDay: '1-2 часа',
        thirtyDayResult: 'Портфолио из 3 дизайнов',
        profile: { mental: 5, creative: 9, physical: 1, structure: 5, freedom: 7, individual: 7, social: 4, quick: 7, long: 5 }
    },
    {
        id: 'mobile_design',
        title: 'Mobile Design',
        titleRu: 'Мобильный дизайн',
        emoji: '📱',
        category: 'technology',
        description: 'Дизайн приложений в Figma',
        whyFitsYou: [
            'Создавай реальные продукты',
            'Быстрый визуальный результат',
            'Можно работать удалённо'
        ],
        timePerDay: '1-2 часа',
        thirtyDayResult: 'Дизайн своего приложения',
        profile: { mental: 5, creative: 8, physical: 1, structure: 5, freedom: 7, individual: 6, social: 4, quick: 6, long: 5 }
    },
    {
        id: 'video_editing',
        title: 'Video Editing',
        titleRu: 'Видео монтаж',
        emoji: '🎬',
        category: 'technology',
        description: 'Монтируй Reels, TikTok, YouTube',
        whyFitsYou: [
            'Творческий + технический навык',
            'Быстрый видимый результат',
            'Можно монетизировать'
        ],
        timePerDay: '1-2 часа',
        thirtyDayResult: 'Навык профессионального монтажа',
        profile: { mental: 4, creative: 8, physical: 1, structure: 4, freedom: 8, individual: 7, social: 4, quick: 7, long: 4 }
    },
    {
        id: '3d_motion',
        title: '3D / Motion Design',
        titleRu: '3D / Моушн дизайн',
        emoji: '🎥',
        category: 'technology',
        description: 'Blender, After Effects',
        whyFitsYou: [
            'Впечатляющие визуальные результаты',
            'Высокий спрос на рынке',
            'Сочетание искусства и технологий'
        ],
        timePerDay: '1-2 часа',
        thirtyDayResult: 'Первая 3D анимация',
        profile: { mental: 6, creative: 9, physical: 1, structure: 5, freedom: 7, individual: 8, social: 2, quick: 4, long: 8 }
    },

    // 🎨 Creativity
    {
        id: 'drawing',
        title: 'Drawing',
        titleRu: 'Рисование',
        emoji: '✏️',
        category: 'creativity',
        description: 'Цифровое и традиционное',
        whyFitsYou: [
            'Развивает креативность',
            'Снимает стресс',
            'Видимый прогресс'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: 'Портфолио из 15+ работ',
        profile: { mental: 3, creative: 9, physical: 2, structure: 3, freedom: 9, individual: 8, social: 2, quick: 5, long: 6 }
    },
    {
        id: 'music',
        title: 'Music',
        titleRu: 'Музыка',
        emoji: '🎵',
        category: 'creativity',
        description: 'Гитара, пианино, битмейкинг',
        whyFitsYou: [
            'Самовыражение через творчество',
            'Развивает слух и координацию',
            'Отличное хобби на всю жизнь'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: 'Исполнение 3-5 песен',
        profile: { mental: 4, creative: 9, physical: 3, structure: 5, freedom: 7, individual: 6, social: 5, quick: 4, long: 7 }
    },
    {
        id: 'photography',
        title: 'Photography',
        titleRu: 'Фотография',
        emoji: '📷',
        category: 'creativity',
        description: 'Снимай на смартфон или камеру',
        whyFitsYou: [
            'Учит видеть красоту вокруг',
            'Быстрый результат каждого снимка',
            'Можно начать с телефона'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: 'Портфолио из 50+ фото',
        profile: { mental: 4, creative: 8, physical: 3, structure: 4, freedom: 8, individual: 6, social: 5, quick: 8, long: 3 }
    },
    {
        id: 'writing',
        title: 'Creative Writing',
        titleRu: 'Писательство',
        emoji: '✍️',
        category: 'creativity',
        description: 'Блоги, эссе, сторителлинг',
        whyFitsYou: [
            'Разгружает голову',
            'Развивает мышление',
            'Можно вести личный блог'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: '15+ опубликованных текстов',
        profile: { mental: 7, creative: 8, physical: 1, structure: 4, freedom: 8, individual: 8, social: 3, quick: 5, long: 6 }
    },
    {
        id: 'content_creation',
        title: 'Content Creation',
        titleRu: 'Создание контента',
        emoji: '📲',
        category: 'creativity',
        description: 'Shorts, Reels как СОЗДАТЕЛЬ',
        whyFitsYou: [
            'Креативное самовыражение',
            'Можно монетизировать',
            'Быстрая обратная связь'
        ],
        timePerDay: '1-2 часа',
        thirtyDayResult: '30 опубликованных видео',
        profile: { mental: 4, creative: 8, physical: 2, structure: 4, freedom: 8, individual: 5, social: 7, quick: 8, long: 3 }
    },

    // 🏃 Physical / Lifestyle
    {
        id: 'home_workout',
        title: 'Home Workouts',
        titleRu: 'Домашние тренировки',
        emoji: '💪',
        category: 'physical',
        description: 'Калистеника и фитнес дома',
        whyFitsYou: [
            'Не нужен зал',
            'Быстрый результат',
            'Энергия на весь день'
        ],
        timePerDay: '30-45 минут',
        thirtyDayResult: 'Видимые изменения в теле',
        profile: { mental: 2, creative: 2, physical: 9, structure: 6, freedom: 5, individual: 8, social: 3, quick: 7, long: 4 }
    },
    {
        id: 'running',
        title: 'Running',
        titleRu: 'Бег',
        emoji: '🏃',
        category: 'physical',
        description: 'Бег и выносливость',
        whyFitsYou: [
            'Очищает голову',
            'Улучшает здоровье',
            'Видимый прогресс в дистанции'
        ],
        timePerDay: '30-45 минут',
        thirtyDayResult: '5 км без остановки',
        profile: { mental: 2, creative: 1, physical: 9, structure: 5, freedom: 6, individual: 8, social: 3, quick: 6, long: 5 }
    },
    {
        id: 'yoga',
        title: 'Yoga & Stretching',
        titleRu: 'Йога и растяжка',
        emoji: '🧘',
        category: 'physical',
        description: 'Гибкость и осознанность',
        whyFitsYou: [
            'Снимает стресс',
            'Улучшает гибкость',
            'Можно практиковать дома'
        ],
        timePerDay: '20-40 минут',
        thirtyDayResult: 'Заметное улучшение гибкости',
        profile: { mental: 4, creative: 2, physical: 7, structure: 5, freedom: 6, individual: 8, social: 3, quick: 5, long: 5 }
    },
    {
        id: 'dancing',
        title: 'Dancing',
        titleRu: 'Танцы',
        emoji: '💃',
        category: 'physical',
        description: 'Любой стиль танцев',
        whyFitsYou: [
            'Физическая активность + творчество',
            'Повышает уверенность',
            'Можно учиться по видео'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: 'Освоение базовых движений',
        profile: { mental: 2, creative: 7, physical: 8, structure: 4, freedom: 8, individual: 5, social: 6, quick: 6, long: 4 }
    },
    {
        id: 'martial_arts',
        title: 'Martial Arts',
        titleRu: 'Боевые искусства',
        emoji: '🥋',
        category: 'physical',
        description: 'Основы единоборств',
        whyFitsYou: [
            'Дисциплина и самооборона',
            'Уверенность в себе',
            'Физическая форма'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: 'Базовые техники',
        profile: { mental: 4, creative: 2, physical: 9, structure: 7, freedom: 4, individual: 6, social: 5, quick: 4, long: 7 }
    },

    // 🧘 Mindfulness / Self-Control
    {
        id: 'meditation',
        title: 'Meditation',
        titleRu: 'Медитация',
        emoji: '🧘‍♂️',
        category: 'mindfulness',
        description: 'Осознанность без эзотерики',
        whyFitsYou: [
            'Снижает тревогу',
            'Улучшает концентрацию',
            'Всего 10-20 минут в день'
        ],
        timePerDay: '10-20 минут',
        thirtyDayResult: 'Снижение стресса на 50%',
        profile: { mental: 5, creative: 2, physical: 2, structure: 4, freedom: 7, individual: 9, social: 1, quick: 4, long: 6 }
    },
    {
        id: 'journaling',
        title: 'Journaling',
        titleRu: 'Дневник мыслей',
        emoji: '📝',
        category: 'mindfulness',
        description: 'Рефлексия и самоанализ',
        whyFitsYou: [
            'Разгружает голову',
            'Помогает понять себя',
            'Занимает 10-15 минут'
        ],
        timePerDay: '10-20 минут',
        thirtyDayResult: 'Ясность мышления',
        profile: { mental: 6, creative: 5, physical: 1, structure: 4, freedom: 7, individual: 9, social: 1, quick: 5, long: 5 }
    },
    {
        id: 'planning',
        title: 'Personal Planning',
        titleRu: 'Планирование',
        emoji: '📋',
        category: 'mindfulness',
        description: 'Личная эффективность',
        whyFitsYou: [
            'Контроль над временем',
            'Чёткие цели',
            'Видимые результаты'
        ],
        timePerDay: '15-30 минут',
        thirtyDayResult: 'Система личной продуктивности',
        profile: { mental: 6, creative: 2, physical: 1, structure: 9, freedom: 2, individual: 8, social: 2, quick: 6, long: 5 }
    },

    // 🍳 Practical Skills
    {
        id: 'cooking',
        title: 'Cooking',
        titleRu: 'Кулинария',
        emoji: '🍳',
        category: 'practical',
        description: 'Готовь вкусно и полезно',
        whyFitsYou: [
            'Практичный навык на всю жизнь',
            'Быстрый вкусный результат',
            'Экономия на еде'
        ],
        timePerDay: '30-60 минут',
        thirtyDayResult: '15+ новых рецептов',
        profile: { mental: 3, creative: 6, physical: 4, structure: 5, freedom: 6, individual: 6, social: 5, quick: 8, long: 3 }
    },
    {
        id: 'finance',
        title: 'Financial Literacy',
        titleRu: 'Финансовая грамотность',
        emoji: '💰',
        category: 'practical',
        description: 'Основы управления деньгами',
        whyFitsYou: [
            'Важно для взрослой жизни',
            'Чёткая структура знаний',
            'Практическая польза'
        ],
        timePerDay: '20-40 минут',
        thirtyDayResult: 'Личный финансовый план',
        profile: { mental: 7, creative: 2, physical: 1, structure: 8, freedom: 3, individual: 8, social: 2, quick: 5, long: 6 }
    },
];

// Category labels in Russian
export const HOBBY_CATEGORIES = {
    intellectual: { label: '🧠 Интеллектуальное развитие', color: '#6366F1' },
    technology: { label: '💻 Технологии', color: '#8B5CF6' },
    creativity: { label: '🎨 Творчество', color: '#EC4899' },
    physical: { label: '🏃 Физическое развитие', color: '#10B981' },
    mindfulness: { label: '🧘 Осознанность', color: '#06B6D4' },
    practical: { label: '🍳 Практические навыки', color: '#F59E0B' },
};

export default HOBBIES_DATABASE;
