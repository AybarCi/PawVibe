const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix react-native-iap v14+ (NitroIap) Swift compilation issues.
 * Pins SWIFT_VERSION to 5.10 for NitroModules & NitroIap and adds required compiler flags.
 */
module.exports = function withNitroIapBuildFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      const postInstallSnippet = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        if ['NitroModules', 'NitroIap'].include?(target.name)
          config.build_settings['SWIFT_VERSION'] = '5.10'
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
          if target.name == 'NitroIap'
            config.build_settings['SWIFT_OPTIMIZATION_LEVEL'] = '-O'
            config.build_settings['SWIFT_COMPILATION_MODE'] = 'wholemodule'
            config.build_settings['OTHER_SWIFT_FLAGS'] ||= '$(inherited)'
            config.build_settings['OTHER_SWIFT_FLAGS'] += ' -disable-batch-mode'
          end
        end
      end
    end
`;

      if (!podfileContent.includes('NitroModules') && !podfileContent.includes('NitroIap')) {
        podfileContent = podfileContent.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${postInstallSnippet}`
        );
        fs.writeFileSync(podfilePath, podfileContent);
      }

      return config;
    },
  ]);
};
