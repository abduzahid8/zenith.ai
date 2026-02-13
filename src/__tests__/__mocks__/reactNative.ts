// Minimal React Native mock for store tests
export const Dimensions = {
    get: () => ({ width: 402, height: 874 }),
};

export const Platform = {
    OS: 'ios',
    select: (obj: any) => obj.ios,
};
