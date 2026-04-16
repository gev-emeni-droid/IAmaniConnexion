import { useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'amani-theme';

const getInitialTheme = (): ThemeMode => {
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }
    } catch {
        // Ignore localStorage access errors and fallback to dark theme.
    }
    return 'dark';
};

export const useTheme = () => {
    const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        root.classList.toggle('dark', theme === 'dark');
        root.classList.toggle('light', theme === 'light');
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // Ignore localStorage write errors.
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    return { theme, isDark: theme === 'dark', toggleTheme };
};
