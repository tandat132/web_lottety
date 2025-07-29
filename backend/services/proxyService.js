const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class ProxyService {
  // Parse proxy string thành object
  parseProxyString(proxyStr) {
    if (!proxyStr || typeof proxyStr !== 'string') {
      throw new Error('Proxy string is required and must be a string');
    }

    const parts = proxyStr.split(':');
  
    if (parts.length === 2) {
      // Format: host:port (không có authentication)
      return {
        host: parts[0],
        port: parseInt(parts[1]),
        auth: null
      };
    } else if (parts.length === 4) {
      // Format: host:port:username:password
      return {
        host: parts[0],
        port: parseInt(parts[1]),
        auth: {
          username: parts[2],
          password: parts[3]
        }
      };
    } else {
      throw new Error('Invalid proxy format. Expected: host:port or host:port:username:password');
    }
  }
  
  // Kiểm tra proxy hoạt động
  async checkProxy(proxy) {
    if (!proxy) return { isWorking: true, message: 'No proxy configured' };
    
    try {
      let proxyUrl;
      if (proxy.auth) {
        proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
      } else {
        proxyUrl = `http://${proxy.host}:${proxy.port}`;
      }
      
      const axiosConfig = {
        httpsAgent: new HttpsProxyAgent(proxyUrl),
        timeout: 10000 // 10 seconds timeout
      };

      // Test proxy bằng cách gọi một API đơn giản
      await axios.get('https://icanhazip.com/', axiosConfig);
      
      return { isWorking: true, message: 'Proxy is working' };
    } catch (error) {
      console.error('Proxy check failed:', error.message);
      return { 
        isWorking: false, 
        message: `Proxy không hoạt động: ${error.message}` 
      };
    }
  }

  // Tạo axios config với proxy
  createProxyConfig(proxy, additionalConfig = {}) {
    const config = { ...additionalConfig };
    
    if (proxy) {
      let proxyUrl;
      if (proxy.auth) {
        proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
      } else {
        proxyUrl = `http://${proxy.host}:${proxy.port}`;
      }
      config.httpsAgent = new HttpsProxyAgent(proxyUrl);
    }
    
    return config;
  }
}

module.exports = new ProxyService();