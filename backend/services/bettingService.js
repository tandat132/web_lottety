const Account = require('../models/Account');
const BetHistory = require('../models/BetHistory');
const sgd666AuthService = require('./sgd666Auth');
const sgd666Utils = require('./sgd666Utils'); // Import utils
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const proxyService = require('../services/proxyService');

class BettingService {
  constructor() {
    this.sgd666Utils = sgd666Utils; // Thêm reference để sử dụng trong class
  }
  // Hàm wrapper chung cho tất cả SGD666 API calls với auto retry
  async makeSGD666Request(account, requestFunction, isRetry = false) {
    try {
      // Lấy token (có thể force refresh nếu đang retry)
      const tokenResult = await this.getAccessToken(account, isRetry);
      if (!tokenResult.success) {
        throw new Error(tokenResult.error);
      }

      // Thực hiện request với token
      const result = await requestFunction(tokenResult.token);
      return result;

    } catch (error) {
      // Kiểm tra nếu là lỗi token bị vô hiệu hóa
      const errorMessage = error.response?.data?.message || error.message || '';
      const isTokenInvalidError = 
        errorMessage.includes('Tài khoản đã đăng nhập từ nơi khác') ||
        errorMessage.includes('vui lòng đăng nhập lại') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        error.response?.status === 401 ||
        error.response?.status === 403;

      // Nếu là lỗi token và chưa retry, thử đăng nhập lại
      if (isTokenInvalidError && !isRetry) {
        console.log(`[${account.username}] Token bị vô hiệu hóa, đang đăng nhập lại...`);
        
        // Xóa token cũ
        account.accessToken = null;
        account.tokenExpiry = null;
        await account.save();
        
        // Retry với token mới
        return await this.makeSGD666Request(account, requestFunction, true);
      }

      // Nếu không phải lỗi token hoặc đã retry, throw lỗi
      throw error;
    }
  }

  // Cập nhật getAccessToken để xử lý lỗi tốt hơn
  async getAccessToken(account, forceRefresh = false) {
    try {
      // Kiểm tra token còn hạn không (trừ khi force refresh)
      if (!forceRefresh && account.isTokenValid()) {
        return { success: true, token: account.accessToken };
      }

      // Parse proxy nếu có
      let parsedProxy = null;
      if (account.proxy) {
        parsedProxy = proxyService.parseProxyString(account.proxy);
      }

      // Login để lấy token mới
      let loginResult;
      if (account.websiteType === 'sgd666') {
        console.log(`[${account.username}] Đang thực hiện fresh login...`);
        loginResult = await sgd666AuthService.performFreshLogin(
          account, 
          parsedProxy
        );
        
        // performFreshLogin trả về object với token field
        if (loginResult && loginResult.token) {
          console.log(`[${account.username}] Fresh login thành công`);
          return { success: true, token: loginResult.token };
        } else {
          console.error(`[${account.username}] Fresh login không trả về token:`, loginResult);
          throw new Error('No token received from fresh login');
        }
      } else if (account.websiteType === 'one789') {
        throw new Error('ONE789 login service chưa được implement');
      }
      
    } catch (error) {
      console.error(`[${account.username}] getAccessToken failed:`, error.message);
      return { 
        success: false, 
        error: error.message || 'Failed to get access token' 
      };
    }
  }

  // Hàm phân phối số theo loại chia số
  distributeNumbers(numbers, accounts, distributionType = 'equal') {
    const numbersArray = Array.isArray(numbers) ? numbers : 
      (typeof numbers === 'string' ? numbers.split(/[,\s]+/).filter(n => n.trim()) : []);
    
    switch (distributionType) {
      case 'equal': // Chia đều
        return this.distributeNumbersEvenly(numbersArray, accounts);
      
      case 'random': // Ngẫu nhiên
        return this.distributeNumbersRandomly(numbersArray, accounts);
      
      case 'all': // Tất cả giống nhau (mặc định)
      default:
        return this.distributeNumbersSame(numbersArray, accounts);
    }
  }

  // Chia tất cả số giống nhau cho tất cả tài khoản
  distributeNumbersSame(numbersArray, accounts) {
    const distribution = {};
    accounts.forEach(account => {
      distribution[account._id.toString()] = [...numbersArray];
    });
    return distribution;
  }

  // Chia số đều cho các tài khoản
  distributeNumbersEvenly(numbersArray, accounts) {
    const distribution = {};
    const numberCount = numbersArray.length;
    const accountCount = accounts.length;
    
    // Nếu số lượng số ít hơn số tài khoản, chỉ sử dụng số tài khoản cần thiết
    const accountsToUse = numberCount < accountCount ? accounts.slice(0, numberCount) : accounts;
    const numbersPerAccount = Math.ceil(numberCount / accountsToUse.length);
    
    accountsToUse.forEach((account, index) => {
      const startIndex = index * numbersPerAccount;
      const endIndex = Math.min(startIndex + numbersPerAccount, numberCount);
      const assignedNumbers = numbersArray.slice(startIndex, endIndex);
      
      // Chỉ thêm vào distribution nếu có số được phân
      if (assignedNumbers.length > 0) {
        distribution[account._id.toString()] = assignedNumbers;
      }
    });
    
    return distribution;
  }

  // Chia số ngẫu nhiên cho các tài khoản
  distributeNumbersRandomly(numbersArray, accounts) {
    const distribution = {};
    const numberCount = numbersArray.length;
    const accountCount = accounts.length;
    
    // Nếu số lượng số ít hơn số tài khoản, chỉ sử dụng số tài khoản cần thiết
    const accountsToUse = numberCount < accountCount ? accounts.slice(0, numberCount) : accounts;
    
    const shuffledNumbers = [...numbersArray];
    
    // Shuffle array using Fisher-Yates algorithm
    for (let i = shuffledNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledNumbers[i], shuffledNumbers[j]] = [shuffledNumbers[j], shuffledNumbers[i]];
    }
    
    const numbersPerAccount = Math.ceil(numberCount / accountsToUse.length);
    
    accountsToUse.forEach((account, index) => {
      const startIndex = index * numbersPerAccount;
      const endIndex = Math.min(startIndex + numbersPerAccount, numberCount);
      const assignedNumbers = shuffledNumbers.slice(startIndex, endIndex);
      
      // Chỉ thêm vào distribution nếu có số được phân
      if (assignedNumbers.length > 0) {
        distribution[account._id.toString()] = assignedNumbers;
      }
    });
    
    return distribution;
  }

  // Cập nhật executeSGD666Betting để sử dụng wrapper
  async executeSGD666Betting(account, betData) {
    const requestFunction = async (authToken) => {
      // Transform dữ liệu từ frontend format sang SGD666 format
      const numbersArray = betData.numbersArray || (betData.numbers ? betData.numbers.split(/[,\s]+/).filter(n => n.trim()) : []);
      const actualNumberCount = numbersArray.length;
      const mappedBetType = sgd666Utils.mapBetType(betData.betType);
      const mappedChannels = sgd666Utils.mapStations(betData.stations) || [];
      
      // Tính totalStake dựa trên loại đánh và hệ số nhân
      const calculatedTotalStake = sgd666Utils.calculateTotalStake(mappedBetType, actualNumberCount, betData.points, mappedChannels.length);

      const processedBetData = {
        numbers: numbersArray,
        totalStake: calculatedTotalStake,
        stakePerBet: betData.points,
        region: sgd666Utils.mapRegion(betData.region) || "CENTRAL",
        channels: mappedChannels,
        betType: mappedBetType
      };

      // Validate dữ liệu bet
      const validation = sgd666Utils.validateBetData(processedBetData);
      if (!validation.isValid) {
        throw new Error(`Dữ liệu bet không hợp lệ: ${validation.errors.join(', ')}`);
      }
      // Cấu hình axios
      const axiosConfig = {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'origin': 'https://sgd6666.asia',
          'token': `Bearer ${authToken}`,
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
          'content-type': 'application/json'
        },
        timeout: 30000
      };

      // Thêm proxy nếu có
      if (account.proxy) {
        const parsedProxy = proxyService.parseProxyString(account.proxy);
        let proxyUrl;
        if (parsedProxy.auth) {
          proxyUrl = `http://${parsedProxy.auth.username}:${parsedProxy.auth.password}@${parsedProxy.host}:${parsedProxy.port}`;
        } else {
          proxyUrl = `http://${parsedProxy.host}:${parsedProxy.port}`;
        }
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      }

      // Bước 1: Tạo order
      const hashData = sgd666Utils.createBetHash(processedBetData);

      const orderResponse = await axios.post(
        'https://api.sgd6666.asia/api/v1/app/loto/order',
        { hash: hashData },
        axiosConfig
      );
      if (!orderResponse.data || !orderResponse.data.orderCode) {
        throw new Error('Order response invalid - no orderCode received');
      }

      // Bước 2: Confirm order
      const orderCode = orderResponse.data.orderCode

      const confirmData = {
        confirm: true,
        orderCode: orderCode
      };

      console.log(`[${account.username}] Confirming order: ${orderCode}`);
      
      const confirmResponse = await axios.patch(
        `https://api.sgd6666.asia/api/v1/app/loto/order/${orderCode}`,
        confirmData,
        axiosConfig
      );

      if (!confirmResponse.data || confirmResponse.data.data?.code !== 200) {
        throw new Error('Order confirmation failed');
      }

      console.log(`[${account.username}] Order confirmed successfully: ${orderCode}`);

      return {
        success: true,
        message: 'SGD666 order created successfully',
        orderCode: orderCode,
        betDetails: processedBetData
      };
    };

    try {
      return await this.makeSGD666Request(account, requestFunction);
    } catch (error) {
      console.error(`[${account.username}] SGD666 betting failed:`, error.message);
      return {
        success: false,
        error: 'SGD666 betting failed',
        details: error.response?.data || error.message
      };
    }
  }

  // Thêm hàm lấy thông tin tài khoản SGD666 với auto retry
  async getSGD666AccountInfo(account) {
    const requestFunction = async (authToken) => {
      const axiosConfig = {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'origin': 'https://sgd6666.asia',
          'token': `Bearer ${authToken}`,
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      };

      // Thêm proxy nếu có
      if (account.proxy) {
        const parsedProxy = proxyService.parseProxyString(account.proxy);
        let proxyUrl;
        if (parsedProxy.auth) {
          proxyUrl = `http://${parsedProxy.auth.username}:${parsedProxy.auth.password}@${parsedProxy.host}:${parsedProxy.port}`;
        } else {
          proxyUrl = `http://${parsedProxy.host}:${parsedProxy.port}`;
        }
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      }

      const response = await axios.get(
        'https://api.sgd6666.asia/api/v1/app/account/details',
        axiosConfig
      );

      return response.data;
    };

    try {
      return await this.makeSGD666Request(account, requestFunction);
    } catch (error) {
      console.error(`[${account.username}] Get account info failed:`, error.message);
      throw error;
    }
  }

  // Cập nhật placeBet để sử dụng executeBetting thay vì executeSGD666Betting trực tiếp
  async placeBet(account, betData) {
    try {
      // Parse và kiểm tra proxy trước
      let parsedProxy = null;
      if (account.proxy) {
        try {
          parsedProxy = proxyService.parseProxyString(account.proxy);
          const proxyCheck = await proxyService.checkProxy(parsedProxy);
          if (!proxyCheck.isWorking) {
            account.status = 'proxy_error';
            await account.save();
            
            return {
              success: false,
              error: 'Proxy error',
              details: proxyCheck.message
            };
          }
        } catch (error) {
          account.status = 'proxy_error';
          await account.save();
          
          return {
            success: false,
            error: 'Proxy format error',
            details: error.message
          };
        }
      }

      const bettingResult = await this.executeBetting(account, betData);
      return bettingResult;

    } catch (error) {
      if (error.message.includes('Proxy lỗi')) {
        account.status = 'proxy_error';
        await account.save();
      }
      
      return {
        success: false,
        error: 'Betting failed',
        details: error.message
      };
    }
  }

  // Cập nhật executeBetting để không cần token parameter
  async executeBetting(account, betData) {
    try {
      if (account.websiteType === 'sgd666') {
        return await this.executeSGD666Betting(account, betData);
      }
      
      return {
        success: false,
        error: 'Website type not supported yet',
        details: `${account.websiteType} betting not implemented`
      };
    } catch (error) {
      return {
        success: false,
        error: 'Betting execution failed',
        details: error.message
      };
    }
  }

  // Xử lý betting cho nhiều tài khoản với đa luồng
  async processBetting(userId, bettingData) {
    try {
      const { runningAccountsCount, websiteType, distributionType, numbers, numbersArray  } = bettingData;

      // Lấy danh sách tài khoản active
      const accounts = await Account.find({
        userId: userId,
        websiteType: websiteType,
        status: 'active' // Chỉ lấy account active, bỏ qua proxy_error
      }).limit(runningAccountsCount);

      if (accounts.length === 0) {
        return {
          success: false,
          error: 'Không có tài khoản đang hoạt động'
        };
      }

      // Phân phối số theo loại được chọn
      const originalNumbers = numbersArray || numbers;
      const numberDistribution = this.distributeNumbers(originalNumbers, accounts, distributionType);
      
      // Chỉ lấy những tài khoản có số được phân phối
      const accountsWithNumbers = accounts.filter(account => 
        numberDistribution[account._id.toString()] && 
        numberDistribution[account._id.toString()].length > 0
      );
      
      if (accountsWithNumbers.length === 0) {
        return {
          success: false,
          error: 'Không có tài khoản nào được phân phối số'
        };
      }

      const BATCH_SIZE = 5; // Xử lý 5 tài khoản cùng lúc
      const results = [];

      // Xử lý theo batch - CHỈ XỬ LÝ CÁC TÀI KHOẢN CÓ SỐ
      for (let i = 0; i < accountsWithNumbers.length; i += BATCH_SIZE) {
        const batch = accountsWithNumbers.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (account) => {
          // Tạo betData riêng cho từng account với số được phân phối
          const accountBetData = {
            ...bettingData,
            numbersArray: numberDistribution[account._id.toString()],
            numbers: numberDistribution[account._id.toString()].join(', ')
          };
          
          const result = await this.placeBet(account, accountBetData);
          return {
            accountId: account._id,
            username: account.username,
            assignedNumbers: numberDistribution[account._id.toString()],
            ...result
          };
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              status: 'failed',
              error: 'Promise rejected',
              details: result.reason?.message || 'Unknown error'
            });
          }
        });

        // Delay giữa các batch
        if (i + BATCH_SIZE < accountsWithNumbers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      const proxyErrorCount = results.filter(r => r.error === 'Proxy error').length;

      // Chỉ lưu BetHistory nếu có ít nhất 1 bet thành công
      let betHistory = null;
      if (successCount > 0) {
        try {
          // Lọc chỉ lấy những tài khoản bet thành công
          const successfulResults = results.filter(r => r.success);
          
          // Tạo orderCode từ bet thành công đầu tiên hoặc tạo mới
          const mainOrderCode = successfulResults.length > 0 && successfulResults[0].orderCode 
            ? successfulResults[0].orderCode 
            : BetHistory.generateOrderCode();

          // Tính tổng số ban đầu từ tất cả tài khoản thành công
          const allSuccessfulNumbers = new Set();
          successfulResults.forEach(result => {
            result.assignedNumbers.forEach(num => allSuccessfulNumbers.add(num));
          });

          // Xử lý stations data để đúng format
          let processedStations = [];
          if (bettingData.stations) {
            if (Array.isArray(bettingData.stations)) {
              processedStations = bettingData.stations.map(station => {
                if (typeof station === 'string') {
                  return { value: station, label: station };
                } else if (station && typeof station === 'object') {
                  return {
                    value: station.value || station.label || station,
                    label: station.label || station.value || station
                  };
                }
                return { value: station, label: station };
              });
            } else if (typeof bettingData.stations === 'string') {
              processedStations = [{ value: bettingData.stations, label: bettingData.stations }];
            }
          }

          betHistory = new BetHistory({
            orderCode: mainOrderCode,
            websiteType: bettingData.websiteType,
            betType: sgd666Utils.mapBetType(bettingData.betType),
            betTypeDisplay: bettingData.betType,
            region: bettingData.region,
            stations: processedStations, // Sử dụng stations đã được xử lý
            numbers: Array.from(allSuccessfulNumbers), // Chỉ lưu số từ các bet thành công
            points: bettingData.points,
            totalStake: successfulResults.reduce((total, result) => {
              return total + sgd666Utils.calculateTotalStake(
                sgd666Utils.mapBetType(bettingData.betType), 
                result.assignedNumbers.length, 
                bettingData.points,
                processedStations.length || 1
              );
            }, 0),
            distributionType: distributionType,
            userId: userId,
            // CHỈ LƯU CÁC TÀI KHOẢN BET THÀNH CÔNG
            accountsUsed: successfulResults.map(result => ({
              accountId: result.accountId,
              username: result.username,
              numbersAssigned: result.assignedNumbers, // Số được phân phối cho tài khoản này
              stakeAmount: sgd666Utils.calculateTotalStake(
                sgd666Utils.mapBetType(bettingData.betType), 
                result.assignedNumbers.length, 
                bettingData.points,
                processedStations.length || 1
              ),
              betStatus: 'success',
              betResponse: {
                orderCode: result.orderCode,
                betDetails: result.betDetails
              },
              errorMessage: null
            }))
          });

          // Cập nhật thống kê
          betHistory.updateStatistics();

          // Lưu vào database
          await betHistory.save();

        } catch (saveError) {
          console.error('Lỗi khi lưu BetHistory:', saveError.message);
          console.error('Chi tiết lỗi:', saveError);
          // Không throw error để không ảnh hưởng đến kết quả betting
        }
      } else {
        console.log('Không có bet thành công nào, không lưu BetHistory');
      }

      return {
        success: true,
        distributionType: distributionType,
        numberDistribution: Object.keys(numberDistribution).map(accountId => {
          const account = accounts.find(acc => acc._id.toString() === accountId);
          return {
            accountId,
            username: account?.username,
            numbers: numberDistribution[accountId]
          };
        }),
        summary: {
          total: results.length, // Số tài khoản thực sự được sử dụng
          success: successCount,
          failed: failCount,
          proxyError: proxyErrorCount,
          totalAccountsAvailable: accounts.length, // Tổng số tài khoản có sẵn
          accountsUsed: accountsWithNumbers.length // Số tài khoản thực sự được sử dụng
        },
        details: results,
        betHistoryId: betHistory?._id,
        orderCode: betHistory?.orderCode,
        savedAccountsCount: betHistory?.accountsUsed?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: 'Processing failed',
        details: error.message
      };
    }
  }
}

module.exports = new BettingService();
