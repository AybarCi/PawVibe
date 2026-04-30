const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to stabilize PawVibe native builds (Midpot style).
 * Enforces Swift 5.10 and iOS 16.0 across ALL pod targets via post_install.
 */
module.exports = function withNitroIapBuildFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;
      
      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Force platform version to 16.0
      podfileContent = podfileContent.replace(
        /platform :ios, podfile_properties\['ios\.deploymentTarget'\] \|\| '[0-9.]+'/,
        "platform :ios, '16.0'"
      );

      const postInstallSnippet = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
        config.build_settings['SWIFT_VERSION'] = '5.10'
      end
    end
`;

      // Remove any previously injected instances of this block to avoid double injection
      podfileContent = podfileContent.replace(
        /installer\.pods_project\.targets\.each do \|target\|[\s\S]*?config\.build_settings\['SWIFT_VERSION'\] = '5\.10'[\s\S]*?end\s*end/g,
        ""
      );

      // Inject the snippet at the start of post_install
      podfileContent = podfileContent.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${postInstallSnippet}`
      );
      fs.writeFileSync(podfilePath, podfileContent);

      return config;
    },
  ]);
};
