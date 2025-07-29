const crypto = require('crypto');
const axios = require('axios');
const Account = require('../models/Account');
const proxyService = require('./proxyService');
const { HttpsProxyAgent } = require('https-proxy-agent');
const sgd666Utils = require('./sgd666Utils'); 

class SGD666AuthService {
  constructor() {
    this.apiUrl = 'https://api.sgd6666.asia/api/v1/authentication/sign-in';
    this.accountDetailsUrl = 'https://api.sgd6666.asia/api/v1/app/account/details';
  }

  // Kiểm tra token còn hạn không
  isTokenValid(account) {
    if (!account.accessToken || !account.tokenExpiry) {
      return false;
    }
    
    // Thêm buffer 5 phút để tránh token hết hạn giữa chừng
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const expiryWithBuffer = new Date(account.tokenExpiry.getTime() - bufferTime);
    
    return now < expiryWithBuffer;
  }

  // Thêm function decode JWT token
  decodeToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT token format');
      }

      const [header, payload, signature] = parts;
      
      // Decode payload
      const decodedPayload = Buffer.from(payload + '==', 'base64url').toString('utf-8');
      const parsedPayload = JSON.parse(decodedPayload);
      
      return parsedPayload;
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      throw new Error('Failed to decode JWT token');
    }
  }

  // Lấy thời gian hết hạn từ JWT token
  getTokenExpiry(token) {
    try {
      const payload = this.decodeToken(token);
      
      // JWT exp field là timestamp (seconds), cần convert sang milliseconds
      if (payload.exp) {
        return new Date(payload.exp * 1000);
      }
      
      // Nếu không có exp field, fallback về 24h
      console.warn('No exp field in JWT token, using 24h fallback');
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    } catch (error) {
      console.error('Error getting token expiry:', error);
      // Fallback về 24h nếu có lỗi
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }

  async login(username, password, proxy = null) {
    try {
      // Kiểm tra proxy trước khi thực hiện login
      if (proxy) {
        const proxyCheck = await proxyService.checkProxy(proxy);
        if (!proxyCheck.isWorking) {
          throw new Error(`Proxy lỗi: ${proxyCheck.message}`);
        }
      }
      const hashValue = sgd666Utils.createLoginHash(username, password);
      
      const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'vi',
        'access-control-allow-methods': 'GET,HEAD,POST,PUT',
        'content-type': 'application/json',
        'dnt': '1',
        'origin': 'https://sgd6666.asia',
        'referer': 'https://sgd6666.asia/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const payload = { hash: hashValue };

      // Cấu hình axios với proxy nếu có
      const axiosConfig = {
        headers,
        timeout: 30000
      };

      if (proxy) {
        const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
        }

      const response = await axios.post(this.apiUrl, payload, axiosConfig);
      
      return response.data;
    } catch (error) {
      console.error('SGD666 API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`SGD666 Login failed: ${error.message}`);
    }
  }

  async refreshToken(account) {
    try {
      const loginResult = await this.login(
        account.username, 
        account.password, 
        account.proxy
      );

      // Kiểm tra các field có thể chứa token
      const token = loginResult.token || loginResult.accessToken || loginResult.access_token || loginResult.data?.token;
      
      if (token) {
        // Sử dụng thời gian hết hạn thực tế từ JWT token
        const tokenExpiry = this.getTokenExpiry(token);
        
        // Cập nhật token mới vào database
        account.accessToken = token;
        account.tokenExpiry = tokenExpiry;
        account.lastLogin = new Date();
        await account.save();

        console.log(`Token for ${account.username} expires at: ${tokenExpiry.toISOString()}`);
        return token;
      }
      
      console.error('No token found in response:', loginResult);
      throw new Error('No token received from SGD666 API');
    } catch (error) {
      console.error(`Token refresh failed for ${account.username}:`, error);
      throw error;
    }
  }

  async getValidToken(accountId) {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Kiểm tra token còn hạn không
      if (account.accessToken && account.tokenExpiry && account.tokenExpiry > new Date()) {
        return account.accessToken;
      }

      // Token hết hạn, refresh
      return await this.refreshToken(account);
    } catch (error) {
      throw new Error(`Get valid token failed: ${error.message}`);
    }
  }

  // Thêm function lấy thông tin tài khoản (điểm số)
  async getAccountDetails(token, proxy = null) {
    try {
      // Kiểm tra proxy trước khi thực hiện request
      if (proxy) {
        const proxyCheck = await proxyService.checkProxy(proxy);
        if (!proxyCheck.isWorking) {
          throw new Error(`Proxy lỗi: ${proxyCheck.message}`);
        }
      }

      const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'vi',
        'access-control-allow-methods': 'GET,HEAD,POST,PUT',
        'dnt': '1',
        'origin': 'https://sgd6666.asia',
        'referer': 'https://sgd6666.asia/',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'token': `Bearer ${token}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      };

      // Cấu hình axios với proxy nếu có
      const axiosConfig = {
        headers,
        timeout: 30000
      };

      if (proxy) {
        const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      }

      const response = await axios.get(this.accountDetailsUrl, axiosConfig);
      return response.data;
    } catch (error) {
      console.error('SGD666 Account Details Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`SGD666 Get account details failed: ${error.message}`);
    }
  }

  async checkAccount(account, proxy = null) {
    try {
      // Kiểm tra proxy trước
      if (proxy) {
        const proxyCheck = await proxyService.checkProxy(proxy);
        if (!proxyCheck.isWorking) {
          // Cập nhật status proxy error
          account.status = 'proxy_error';
          await account.save();
          
          throw new Error(`Proxy lỗi: ${proxyCheck.message}`);
        }
      }

      let result;
      
      // Kiểm tra token hiện có trước
      if (this.isTokenValid(account)) {
        console.log(`Using existing valid token for ${account.username}`);
        
        try {
          // Lấy thông tin với token hiện có
          const accountDetails = await this.getAccountDetails(account.accessToken, proxy);
          const points = accountDetails.data?.plInfo?.credit || 0;
          
          // Cập nhật thông tin vào DB
          account.points = points;
          account.lastLogin = new Date();
          account.status = 'active';
          await account.save();
          
          result = {
            token: account.accessToken,
            points: points,
            accountDetails: accountDetails,
            fromExistingToken: true,
            tokenExpiry: account.tokenExpiry
          };
        } catch (error) {
          console.log(`Existing token failed for ${account.username}, performing fresh login`);
          // Token không hoạt động, thực hiện login mới
          result = await this.performFreshLogin(account, proxy);
        }
      } else {
        console.log(`Token expired or invalid for ${account.username}, performing fresh login`);
        // Token hết hạn hoặc không có, thực hiện login mới
        result = await this.performFreshLogin(account, proxy);
      }

      return result;
    } catch (error) {
      // Xử lý lỗi và cập nhật status
      if (error.message.includes('Proxy lỗi')) {
        account.status = 'proxy_error';
      } else {
        account.status = 'inactive';
      }
      await account.save();
      throw error;
    }
  }
  // Helper function để thực hiện login mới
  async performFreshLogin(account, proxy = null) {
    try {
      // Đăng nhập để lấy token
      const loginResult = await this.login(account.username, account.password, proxy);
      // Lấy token từ kết quả login
      const token = loginResult.token || loginResult.accessToken || loginResult.access_token || loginResult.data?.token;
      
      if (!token) {
        throw new Error('No token received from login');
      }

      // Lấy thông tin tài khoản để có điểm số
      const accountDetails = await this.getAccountDetails(token, proxy);
      const points = accountDetails.data?.plInfo?.credit || 0;
      
      // Cập nhật toàn bộ thông tin vào DB
      const tokenExpiry = this.getTokenExpiry(token);
      account.accessToken = token;
      account.tokenExpiry = tokenExpiry;
      account.lastLogin = new Date();
      account.points = points;
      account.status = 'active';
      await account.save();
      
      return {
        token: token,
        points: points,
        accountDetails: accountDetails,
        fromExistingToken: false,
        tokenExpiry: tokenExpiry
      };
    } catch (error) {
      console.error(`Fresh login failed for ${account.username}:`, error);
      throw error;
    }
  }
  
}

module.exports = new SGD666AuthService();