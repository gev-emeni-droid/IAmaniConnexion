export const applyTheme = (color: string) => {
    document.documentElement.style.setProperty('--brand-color', color);

    // Calculate light version (opacity 10%)
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    document.documentElement.style.setProperty('--brand-light', `rgba(${r}, ${g}, ${b}, 0.1)`);
};
