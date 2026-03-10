module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Replace import.meta with a plain object so it works in non-module scripts (web)
            [
                function () {
                    return {
                        visitor: {
                            MetaProperty(path) {
                                const t = path.hub.file.opts?.caller?.platform;
                                if (t && t !== 'web') return;
                                path.replaceWithSourceString(
                                    '({ env: { MODE: "production" } })'
                                );
                            },
                        },
                    };
                },
            ],
            'react-native-reanimated/plugin',
        ],
    };
};
