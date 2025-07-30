const crypto = require('crypto');
const axios = require('axios');
const Account = require('../models/Account');
const proxyService = require('./proxyService');
const { HttpsProxyAgent } = require('https-proxy-agent');
const one789Utils = require('./one789Utils');

class One789AuthService {
  constructor() {
    this.apiUrl = 'https://id.lotusapi.com/auth/sign-in';
    this.profileUrl = 'https://id.lotusapi.com/users/profile'; // URL lấy profile
    this.userPoolId = 'ap-southeast-1_rz3gbsuS3';
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

  // Decode JWT token để lấy thông tin
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

      // Tạo EncodedData và VisitorId
      const encodedData = one789Utils.createEncodedData(username, this.userPoolId);
      const visitorId = one789Utils.generateVisitorId();
      
      const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
        'content-type': 'application/json',
        'dnt': '1',
        'origin': 'https://b2one789.net',
        'priority': 'u=1, i',
        'referer': 'https://b2one789.net/',
        'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
      };

      const payload = {
        Username: username,
        Password: password,
        EncodedData: encodedData,
        VisitorId: visitorId
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

      const response = await axios.post(this.apiUrl, payload, axiosConfig);
      
      return response.data;
    } catch (error) {
      console.error('ONE789 API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`ONE789 Login failed: ${error.message}`);
    }
  }

  async refreshToken(account) {
    try {
      let parsedProxy = null;
      if (account.proxy) {
        parsedProxy = proxyService.parseProxyString(account.proxy);
      }

      const loginResult = await this.login(
        account.username, 
        account.password, 
        parsedProxy
      );

      // Kiểm tra các field có thể chứa token
      const token = loginResult.IdToken || 
                    loginResult.idToken || 
                    loginResult.idtoken || 
                    loginResult.id_token ||
                    loginResult.data?.IdToken;
      
      if (token) {
        // Sử dụng thời gian hết hạn thực tế từ JWT token
        const tokenExpiry = this.getTokenExpiry(token);
        
        // Cập nhật token mới vào database
        account.accessToken = token;
        account.tokenExpiry = tokenExpiry;
        account.lastLogin = new Date();
        account.status = 'active';
        await account.save();

        return token;
      }
      
      console.error('No token found in ONE789 response:', loginResult);
      throw new Error('No AccessToken received from ONE789 API');
    } catch (error) {
      console.error(`ONE789 Token refresh failed for ${account.username}:`, error);
      
      // Cập nhật status account nếu login thất bại
      if (account) {
        account.status = 'login_failed';
        await account.save();
      }
      
      throw error;
    }
  }

  async getValidToken(accountId) {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      if (account.websiteType !== 'one789') {
        throw new Error('Account is not ONE789 type');
      }

      // Kiểm tra token còn hạn không
      if (this.isTokenValid(account)) {
        return account.accessToken;
      }

      // Token hết hạn, refresh
      return await this.refreshToken(account);
    } catch (error) {
      throw new Error(`Get valid ONE789 token failed: ${error.message}`);
    }
  }

  // Lấy thông tin profile ONE789 (Balance)
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
        'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
        'authorization': `Bearer ${token}`,
        'dnt': '1',
        'origin': 'https://b2one789.net',
        'priority': 'u=1, i',
        'referer': 'https://b2one789.net/',
        'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
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

      const response = await axios.get(this.profileUrl, axiosConfig);
      
      return response.data;
    } catch (error) {
      console.error('ONE789 Profile Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Get ONE789 profile failed: ${error.message}`);
    }
  }

  // Kiểm tra account và lấy thông tin (tương tự SGD666)
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

      let fromExistingToken = false;
      let token = null;

      // Thử sử dụng token hiện tại trước
      if (this.isTokenValid(account)) {
        token = account.accessToken;
        fromExistingToken = true;
        console.log(`[${account.username}] Using existing valid token`);
      } else {
        // Token hết hạn hoặc không có, refresh
        console.log(`[${account.username}] Token expired or missing, refreshing...`);
        token = await this.refreshToken(account);
        fromExistingToken = false;
      }

      // Lấy thông tin profile để có Balance
      const profileData = await this.getAccountDetails(token, proxy);
      
      // Tìm Balance trong response
      const balance = profileData.Balance || 
                     profileData.balance || 
                     profileData.data?.Balance ||
                     profileData.data?.balance ||
                     0;

      // Cập nhật points trong database
      account.points = balance;
      account.status = 'active';
      await account.save();

      console.log(`[${account.username}] ONE789 Balance: ${balance}`);

      return {
        points: balance,
        fromExistingToken: fromExistingToken,
        profileData: profileData
      };

    } catch (error) {
      console.error(`[${account.username}] ONE789 Check account error:`, error);
      
      // Cập nhật status dựa trên loại lỗi
      if (error.message.includes('Proxy lỗi')) {
        account.status = 'proxy_error';
      } else {
        account.status = 'login_failed';
      }
      await account.save();
      
      throw error;
    }
  }

  // Helper function để thực hiện login mới và lấy thông tin
  async performFreshLogin(account, proxy = null) {
    try {
      // Đăng nhập để lấy token
      const loginResult = await this.login(account.username, account.password, proxy);
      
      // Lấy token từ kết quả login
      const token = loginResult.AccessToken || 
                   loginResult.accessToken || 
                   loginResult.access_token || 
                   loginResult.token ||
                   loginResult.data?.AccessToken;
      
      if (!token) {
        throw new Error('No AccessToken received from login');
      }

      // Lấy thông tin profile để có Balance
      const profileData = await this.getAccountDetails(token, proxy);
      const balance = profileData.Balance || 
                     profileData.balance || 
                     profileData.data?.Balance ||
                     profileData.data?.balance ||
                     0;
      
      // Cập nhật account
      const tokenExpiry = this.getTokenExpiry(token);
      account.accessToken = token;
      account.tokenExpiry = tokenExpiry;
      account.points = balance;
      account.lastLogin = new Date();
      account.status = 'active';
      await account.save();

      console.log(`[${account.username}] Fresh login successful, Balance: ${balance}`);

      return {
        token: token,
        balance: balance,
        profileData: profileData
      };

    } catch (error) {
      console.error(`[${account.username}] Fresh login failed:`, error);
      account.status = 'login_failed';
      await account.save();
      throw error;
    }
  }
}

module.exports = new One789AuthService();