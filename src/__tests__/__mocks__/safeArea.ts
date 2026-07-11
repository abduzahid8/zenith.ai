import React from 'react';

export const SafeAreaView = ({ children, style }: any) =>
    React.createElement('View', { style }, children);

export const SafeAreaProvider = ({ children }: any) =>
    React.createElement('View', null, children);

export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });

export const initialWindowMetrics = {
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    frame: { x: 0, y: 0, width: 390, height: 844 },
};
