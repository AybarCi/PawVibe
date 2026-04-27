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

      // Force platform version to 16.0
      podfileContent = podfileContent.replace(
        /platform :ios, podfile_properties\['ios\.deploymentTarget'\] \|\| '[0-9.]+'/,
        "platform :ios, '16.0'"
      );

      const postInstallSnippet = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Force all targets to iOS 16.0 deployment target
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'

        if ['NitroModules', 'NitroIap'].include?(target.name)
          config.build_settings['SWIFT_VERSION'] = '5.10'
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
      }
      fs.writeFileSync(podfilePath, podfileContent);

      return config;
    },
  ]);
};
