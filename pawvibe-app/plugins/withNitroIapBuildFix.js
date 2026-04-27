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

      // Remove any previously injected instances of this block to avoid double injection
      podfileContent = podfileContent.replace(
        /installer\.pods_project\.targets\.each do \|target\|[\s\S]*?# Force all targets to iOS 16\.0 deployment target[\s\S]*?end\s*end/g,
        ""
      );

      // Inject the snippet at the start of post_install
      podfileContent = podfileContent.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${postInstallSnippet}`
      );
      fs.writeFileSync(podfilePath, podfileContent);

      // Force IPHONEOS_DEPLOYMENT_TARGET in project.pbxproj to 16.0
      const pbxprojPath = path.join(config.modRequest.platformProjectRoot, 'PawVibe.xcodeproj', 'project.pbxproj');
      if (fs.existsSync(pbxprojPath)) {
        let pbxprojContent = fs.readFileSync(pbxprojPath, 'utf-8');
        pbxprojContent = pbxprojContent.replace(
          /IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/g,
          "IPHONEOS_DEPLOYMENT_TARGET = 16.0;"
        );
        fs.writeFileSync(pbxprojPath, pbxprojContent);
      }

      return config;
    },
  ]);
};
