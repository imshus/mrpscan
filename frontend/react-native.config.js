/**
 * Native linking per platform. Razorpay is the Android app's checkout; the
 * iPhone app sells nothing (App Store rule 3.1.1, utils/platformCommerce.ts),
 * so its native SDK is left out of the iOS build.
 */
module.exports = {
  dependencies: {
    'react-native-razorpay': {
      platforms: {
        ios: null,
      },
    },
  },
};
