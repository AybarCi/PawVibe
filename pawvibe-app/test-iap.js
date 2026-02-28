const rniap = require('react-native-iap');
console.log(Object.keys(rniap).filter(k => k.toLowerCase().includes('product') || k.toLowerCase().includes('sub')));
