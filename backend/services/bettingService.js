const Account = require('../models/Account');
const BetHistory = require('../models/BetHistory');
const sgd666AuthService = require('./sgd666Auth');
const sgd666Utils = require('./sgd666Utils');
const one789BettingService = require('./one789BettingService');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const proxyService = require('../services/proxyService');

class BettingService {
  constructor() {
    this.sgd666Utils = sgd666Utils; // Thêm reference để sử dụng trong class
    this.one789BettingService = one789BettingService;
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

  // Thêm method executeOne789Betting
  async executeOne789Betting(account, betData) {
    try {
      // Validate dữ liệu ONE789
      const validationErrors = this.one789BettingService.validateOne789BetData(betData);
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: 'Validation failed',
          details: validationErrors.join(', ')
        };
      }

      // Thực hiện betting ONE789
      return await this.one789BettingService.executeOne789Betting(account, betData);
    } catch (error) {
      console.error(`[${account.username}] ONE789 betting failed:`, error.message);
      return {
        success: false,
        error: 'ONE789 betting failed',
        details: error.message
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
      }else if (account.websiteType === 'one789') {
        return await this.executeOne789Betting(account, betData);
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

      // Lấy TẤT CẢ tài khoản active (không giới hạn bởi runningAccountsCount)
      const allActiveAccounts = await Account.find({
        userId: userId,
        websiteType: websiteType,
        status: 'active'
      });

      if (allActiveAccounts.length === 0) {
        return {
          success: false,
          error: 'Không có tài khoản đang hoạt động'
        };
      }

      // Lấy danh sách tài khoản theo runningAccountsCount
      const initialAccounts = allActiveAccounts.slice(0, runningAccountsCount);
      const originalNumbers = numbersArray || numbers;

      // Kiểm tra xem có cần retry logic hay không
      const needsRetryLogic = distributionType === 'equal' || distributionType === 'random';
      
      if (needsRetryLogic) {
        // LOGIC RETRY CHO 'equal' VÀ 'random' - Mỗi tài khoản đánh số khác nhau
        let remainingNumbers = [...originalNumbers]; // Số còn lại cần đánh
        let availableAccounts = [...initialAccounts]; // Tài khoản còn khả dụng
        let usedAccountIds = new Set(); // Theo dõi tài khoản đã sử dụng
        let allResults = []; // Tất cả kết quả thành công
        let retryCount = 0;
        const maxRetries = 5; // Tối đa 5 lần retry

        console.log(`🎯 Bắt đầu betting (${distributionType}): ${remainingNumbers.length} số, ${availableAccounts.length} tài khoản ban đầu`);

        // Vòng lặp retry
        while (remainingNumbers.length > 0 && retryCount < maxRetries) {
          retryCount++;
          console.log(`\n🔄 Lần ${retryCount}: ${remainingNumbers.length} số còn lại, ${availableAccounts.length} tài khoản khả dụng`);

          // Nếu không còn tài khoản khả dụng, thử lấy thêm từ danh sách tổng
          if (availableAccounts.length === 0) {
            const additionalAccounts = allActiveAccounts.filter(acc => 
              !usedAccountIds.has(acc._id.toString())
            );
            
            if (additionalAccounts.length === 0) {
              console.log('❌ Đã hết tài khoản active để thử');
              break;
            }
            
            availableAccounts = additionalAccounts;
            console.log(`🔄 Lấy thêm ${additionalAccounts.length} tài khoản từ danh sách tổng`);
          }

          // Phân phối số cho tài khoản khả dụng
          const numberDistribution = this.distributeNumbers(remainingNumbers, availableAccounts, distributionType);
          
          // Chỉ lấy những tài khoản có số được phân phối
          const accountsWithNumbers = availableAccounts.filter(account => 
            numberDistribution[account._id.toString()] && 
            numberDistribution[account._id.toString()].length > 0
          );
          
          if (accountsWithNumbers.length === 0) {
            console.log('❌ Không có tài khoản nào được phân phối số');
            break;
          }

          const BATCH_SIZE = 5; // Xử lý 5 tài khoản cùng lúc
          const roundResults = [];

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
                roundResults.push(result.value);
              } else {
                roundResults.push({
                  accountId: null,
                  username: 'Unknown',
                  assignedNumbers: [],
                  success: false,
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

          // Phân tích kết quả round này
          const successfulResults = roundResults.filter(r => r.success);
          const failedResults = roundResults.filter(r => !r.success);

          console.log(`✅ Thành công: ${successfulResults.length}, ❌ Thất bại: ${failedResults.length}`);

          // Thêm kết quả thành công vào danh sách tổng
          allResults.push(...successfulResults);

          // Đánh dấu tài khoản đã sử dụng (cả thành công và thất bại)
          roundResults.forEach(result => {
            if (result.accountId) {
              usedAccountIds.add(result.accountId.toString());
            }
          });

          // Cập nhật số còn lại (loại bỏ số đã đánh thành công)
          const successfulNumbers = new Set();
          successfulResults.forEach(result => {
            result.assignedNumbers.forEach(num => successfulNumbers.add(num));
          });

          remainingNumbers = remainingNumbers.filter(num => !successfulNumbers.has(num));
          console.log(`📊 Đã đánh thành công ${successfulNumbers.size} số, còn lại ${remainingNumbers.length} số`);

          // Cập nhật danh sách tài khoản khả dụng (loại bỏ tài khoản đã sử dụng)
          availableAccounts = availableAccounts.filter(account => 
            !usedAccountIds.has(account._id.toString())
          );

          console.log(`🔧 Còn lại ${availableAccounts.length} tài khoản khả dụng trong batch hiện tại`);

          // Nếu không còn số thì dừng
          if (remainingNumbers.length === 0) {
            console.log('🎉 Đã đánh hết tất cả số!');
            break;
          }

          // Delay trước khi retry
          if (retryCount < maxRetries && remainingNumbers.length > 0) {
            console.log('⏳ Chờ 2 giây trước khi retry...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        const successCount = allResults.length;

        // Tạo numberDistribution để hiển thị (chỉ từ kết quả thành công)
        const finalNumberDistribution = {};
        allResults.forEach(result => {
          finalNumberDistribution[result.accountId.toString()] = result.assignedNumbers;
        });

        return await this.saveBetHistoryAndReturnResult(
          bettingData, 
          distributionType, 
          userId, 
          allResults, 
          originalNumbers, 
          remainingNumbers, 
          retryCount, 
          finalNumberDistribution,
          allActiveAccounts.length
        );

      } else {
        // LOGIC THÔNG THƯỜNG CHO 'all' - Tất cả tài khoản đánh cùng số
        console.log(`🎯 Bắt đầu betting (${distributionType}): Tất cả tài khoản đánh cùng số`);
        
        // Phân phối số cho tài khoản
        const numberDistribution = this.distributeNumbers(originalNumbers, initialAccounts, distributionType);
        
        // Chỉ lấy những tài khoản có số được phân phối
        const accountsWithNumbers = initialAccounts.filter(account => 
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
                accountId: null,
                username: 'Unknown',
                assignedNumbers: [],
                success: false,
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

        const successfulResults = results.filter(r => r.success);
        
        console.log(`✅ Thành công: ${successfulResults.length}, ❌ Thất bại: ${results.length - successfulResults.length}`);

        // Tạo numberDistribution để hiển thị (chỉ từ kết quả thành công)
        const finalNumberDistribution = {};
        successfulResults.forEach(result => {
          finalNumberDistribution[result.accountId.toString()] = result.assignedNumbers;
        });

        return await this.saveBetHistoryAndReturnResult(
          bettingData, 
          distributionType, 
          userId, 
          successfulResults, 
          originalNumbers, 
          [], // Không có remainingNumbers cho 'all'
          1, // Chỉ 1 lần thực hiện
          finalNumberDistribution,
          allActiveAccounts.length
        );
      }

    } catch (error) {
      return {
        success: false,
        error: 'Processing failed',
        details: error.message
      };
    }
  }

  // Hàm helper để lưu BetHistory và trả về kết quả
  async saveBetHistoryAndReturnResult(bettingData, distributionType, userId, allResults, originalNumbers, remainingNumbers, retryCount, finalNumberDistribution, totalActiveAccounts) {
    const { websiteType } = bettingData;
    const successCount = allResults.length;

    // Chỉ lưu BetHistory nếu có ít nhất 1 bet thành công
    let betHistory = null;
    if (successCount > 0) {
      try {
        // Lọc chỉ lấy những tài khoản bet thành công
        const successfulResults = allResults.filter(r => r.success);
        
        // Tạo orderCode từ bet thành công đầu tiên hoặc tạo mới
        const mainOrderCode = successfulResults.length > 0 && successfulResults[0].orderCode 
          ? successfulResults[0].orderCode 
          : BetHistory.generateOrderCode();

        // Tính tổng số từ tất cả tài khoản thành công
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

        // Tính tổng stake
        const totalStake = successfulResults.reduce((total, result) => {
          if (websiteType === 'sgd666') {
            return total + sgd666Utils.calculateTotalStake(
              sgd666Utils.mapBetType(bettingData.betType), 
              result.assignedNumbers.length, 
              bettingData.points,
              processedStations.length || 1
            );
          } else {
            // ONE789 logic
            return total + (result.assignedNumbers.length * bettingData.points * (processedStations.length || 1));
          }
        }, 0);

        betHistory = new BetHistory({
          orderCode: mainOrderCode,
          websiteType: bettingData.websiteType,
          betType: websiteType === 'sgd666' ? sgd666Utils.mapBetType(bettingData.betType) : bettingData.betType,
          betTypeDisplay: bettingData.betType,
          region: bettingData.region,
          stations: processedStations,
          numbers: Array.from(allSuccessfulNumbers), // Chỉ lưu số từ các bet thành công
          points: bettingData.points,
          totalStake: totalStake,
          distributionType: distributionType,
          userId: userId,
          // CHỈ LƯU CÁC TÀI KHOẢN BET THÀNH CÔNG
          accountsUsed: successfulResults.map(result => ({
            accountId: result.accountId,
            username: result.username,
            numbersAssigned: result.assignedNumbers,
            stakeAmount: websiteType === 'sgd666' 
              ? sgd666Utils.calculateTotalStake(
                  sgd666Utils.mapBetType(bettingData.betType), 
                  result.assignedNumbers.length, 
                  bettingData.points,
                  processedStations.length || 1
                )
              : result.assignedNumbers.length * bettingData.points * (processedStations.length || 1),
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
      }
    } else {
      console.log('Không có bet thành công nào, không lưu BetHistory');
    }

    return {
      success: true,
      distributionType: distributionType,
      numberDistribution: Object.keys(finalNumberDistribution).map(accountId => {
        const result = allResults.find(r => r.accountId.toString() === accountId);
        return {
          accountId,
          username: result?.username,
          numbers: finalNumberDistribution[accountId]
        };
      }),
      summary: {
        total: allResults.length,
        success: successCount,
        failed: 0,
        proxyError: 0,
        totalAccountsAvailable: totalActiveAccounts,
        accountsUsed: allResults.length,
        retryInfo: distributionType === 'all' ? null : {
          totalRetries: retryCount,
          originalNumbers: originalNumbers.length,
          successfulNumbers: allResults.reduce((total, r) => total + r.assignedNumbers.length, 0),
          numbersNotBet: remainingNumbers.length,
          successRate: ((allResults.reduce((total, r) => total + r.assignedNumbers.length, 0) / originalNumbers.length) * 100).toFixed(2) + '%'
        }
      },
      details: allResults,
      betHistoryId: betHistory?._id,
      orderCode: betHistory?.orderCode,
      savedAccountsCount: betHistory?.accountsUsed?.length || 0
    };
  }
}

module.exports = new BettingService();
