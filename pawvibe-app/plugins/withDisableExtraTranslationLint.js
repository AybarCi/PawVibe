const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Expo config plugin to disable Android lint's ExtraTranslation check.
 * 
 * Reason: Expo's locales config serializes iOS-only infoPlist objects
 * into Android strings.xml as "[object Object]", causing ExtraTranslation
 * lint errors on release builds. This is an Expo limitation, not a real issue.
 */
module.exports = function withDisableExtraTranslationLint(config) {
    return withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;

        // Check if already added
        if (buildGradle.includes("disable 'ExtraTranslation'")) {
            return config;
        }

        // Add lint disable inside android { } block
        const lintBlock = `
    lint {
        disable 'ExtraTranslation'
    }`;

        // Insert after the first occurrence of "android {"
        config.modResults.contents = buildGradle.replace(
            /android\s*\{/,
            `android {\n${lintBlock}`
        );

        return config;
    });
};
