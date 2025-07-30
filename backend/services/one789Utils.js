const crypto = require('crypto');
const base64 = require('base-64');

class One789Utils {
  constructor() {
    // Secret key giả định cho Cognito signature (cần reverse engineer từ JS thực tế)
    this.secretKey = Buffer.from("AmazonCognitoAdvancedSecurityDataKey", 'utf-8');
  }

  // Tạo device fingerprint giả
  generateDeviceFingerprint() {
    const randomId = () => Math.random().toString(36).substring(2, 15);
    
    return {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      language: "vi-VN",
      colorDepth: 24,
      deviceMemory: 8,
      pixelRatio: 1,
      hardwareConcurrency: 8,
      screenResolution: [1920, 1080],
      availableScreenResolution: [1920, 1040],
      timezoneOffset: -420, // GMT+7
      timezone: "Asia/Ho_Chi_Minh",
      sessionStorage: true,
      localStorage: true,
      indexedDb: true,
      addBehavior: false,
      openDatabase: false,
      cpuClass: "unknown",
      platform: "Win32",
      plugins: [],
      canvas: `canvas_fp_${randomId()}`,
      webgl: `webgl_fp_${randomId()}`,
      webglVendorAndRenderer: "Google Inc. (Intel)~ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11-27.20.100.8681)",
      adBlock: false,
      hasLiedLanguages: false,
      hasLiedResolution: false,
      hasLiedOs: false,
      hasLiedBrowser: false,
      touchSupport: [0, false, false],
      fonts: ["Arial", "Times New Roman", "Courier New"],
      audio: `audio_fp_${randomId()}`
    };
  }

  // Tạo device ID giống format trong request
  generateDeviceId() {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `019b66lnkt9owa5ticfz:${timestamp}`;
  }

  // Tạo visitor ID
  generateVisitorId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Tạo context data cho Cognito
  createContextData(username) {
    const timestamp = Date.now();
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
    const deviceId = this.generateDeviceId();
    
    return {
      UserAgent: userAgent,
      DeviceId: deviceId,
      DeviceLanguage: "vi-VN",
      DeviceFingerprint: `${userAgent}PDF Viewer:Chrome PDF Viewer:Chromium PDF Viewer:Microsoft Edge PDF Viewer:WebKit built-in PDF:vi-VN`,
      DevicePlatform: "Win32",
      ClientTimezone: "07:00"
    };
  }

  // Tạo payload cho EncodedData
  createPayload(username, userPoolId = "ap-southeast-1_rz3gbsuS3") {
    const timestamp = Date.now();
    const contextData = this.createContextData(username);
    
    return {
      contextData,
      username,
      userPoolId,
      timestamp
    };
  }

  // Tạo signature cho payload
  createSignature(payload) {
    try {
      // Tạo message để sign
      const message = [
        payload.username,
        payload.userPoolId,
        payload.timestamp.toString(),
        JSON.stringify(payload.contextData, null, 0)
      ].join('|');

      // Tạo HMAC-SHA256 signature
      const messageBytes = Buffer.from(message, 'utf-8');
      const signature = crypto.createHmac('sha256', this.secretKey)
        .update(messageBytes)
        .digest();

      // Encode thành Base64
      return signature.toString('base64');
    } catch (error) {
      console.error('Error creating signature:', error);
      // Fallback signature nếu có lỗi
      return "tdClrCTlkTYqYVY4abXS4ursRY/6M5aW/5PiTsHiP1Q=";
    }
  }

  // Tạo EncodedData hoàn chỉnh
  createEncodedData(username, userPoolId = "ap-southeast-1_rz3gbsuS3") {
    try {
      const payload = this.createPayload(username, userPoolId);
      const signature = this.createSignature(payload);
      
      const encodedDataPayload = {
        payload: JSON.stringify(payload),
        signature: signature,
        version: "JS20171115"
      };

      // Encode thành Base64
      const encodedDataJson = JSON.stringify(encodedDataPayload);
      return Buffer.from(encodedDataJson, 'utf-8').toString('base64');
    } catch (error) {
      console.error('Error creating encoded data:', error);
      throw new Error('Failed to create encoded data');
    }
  }
}

module.exports = new One789Utils();