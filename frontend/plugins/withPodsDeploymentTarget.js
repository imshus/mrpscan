// Raises every CocoaPods target to the app's own iOS minimum (15.1, Expo SDK
// 54's floor). Xcode 27 (iOS 27.1 SDK, what EAS's "latest" image builds with)
// refuses to archive when a pod or one of its resource bundles still declares
// an older target (SDWebImage 9.0, react-native-blob-util 11.0, RNSVG 12.4,
// async-storage 13.4); Xcode 16 only warned about them.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARK = '# MRPscan: no pod below the app\'s iOS minimum';

module.exports = function withPodsDeploymentTarget(config, { minimum = '15.1' } = {}) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let source = fs.readFileSync(podfile, 'utf8');
      if (!source.includes(MARK)) {
        const hook = /post_install do \|installer\|\n/;
        if (!hook.test(source)) throw new Error('withPodsDeploymentTarget: no post_install block in the Podfile');
        source = source.replace(
          hook,
          (start) =>
            start +
            `    ${MARK}\n` +
            '    installer.pods_project.targets.each do |pod_target|\n' +
            '      pod_target.build_configurations.each do |build|\n' +
            `        if build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${minimum}\n` +
            `          build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${minimum}'\n` +
            '        end\n' +
            '      end\n' +
            '    end\n',
        );
        fs.writeFileSync(podfile, source);
      }
      return cfg;
    },
  ]);
};
