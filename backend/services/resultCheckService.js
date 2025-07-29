const axios = require('axios');
const BetHistory = require('../models/BetHistory');
const Account = require('../models/Account');
const sgd666Auth = require('./sgd666Auth');
const proxyService = require('./proxyService');
const { HttpsProxyAgent } = require('https-proxy-agent');

class ResultCheckService {
  constructor() {
    // Thời gian kiểm tra kết quả cho từng miền
    this.checkTimes = {
      north: { hour: 18, minute: 30 }, // Miền Bắc: sau 18h30
      central: { hour: 17, minute: 30 }, // Miền Trung: sau 17h30  
      south: { hour: 16, minute: 30 } // Miền Nam: sau 16h30
    };
  }

  // Hàm wrapper chung cho tất cả SGD666 API calls với auto retry (tương tự bettingService)
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

  // Lấy access token (tương tự bettingService)
  async getAccessToken(account, forceRefresh = false) {
    try {
      // Kiểm tra token còn hạn không (trừ khi force refresh)
      if (!forceRefresh && account.isTokenValid()) {
        return { success: true, token: account.accessToken };
      }

      // Parse và kiểm tra proxy nếu có
      let parsedProxy = null;
      if (account.proxy) {
        try {
          parsedProxy = proxyService.parseProxyString(account.proxy);
          
          // Kiểm tra proxy trước khi sử dụng
          const proxyCheck = await proxyService.checkProxy(parsedProxy);
          if (!proxyCheck.isWorking) {
            console.error(`[${account.username}] Proxy không hoạt động: ${proxyCheck.message}`);
            throw new Error(`Proxy lỗi: ${proxyCheck.message}`);
          }
          console.log(`[${account.username}] Proxy check passed`);
        } catch (proxyError) {
          console.error(`[${account.username}] Proxy error:`, proxyError.message);
          throw new Error(`Proxy lỗi: ${proxyError.message}`);
        }
      }

      // Login để lấy token mới
      if (account.websiteType === 'sgd666') {
        console.log(`[${account.username}] Đang thực hiện fresh login cho result check...`);
        const loginResult = await sgd666Auth.performFreshLogin(
          account, 
          parsedProxy
        );
        
        if (loginResult && loginResult.token) {
          console.log(`[${account.username}] Fresh login thành công cho result check`);
          return { success: true, token: loginResult.token };
        } else {
          console.error(`[${account.username}] Fresh login không trả về token:`, loginResult);
          throw new Error('No token received from fresh login');
        }
      } else {
        throw new Error(`Website type ${account.websiteType} not supported for result check`);
      }
      
    } catch (error) {
      console.error(`[${account.username}] getAccessToken failed:`, error.message);
      return { 
        success: false, 
        error: error.message || 'Failed to get access token' 
      };
    }
  }

  // Kiểm tra xem có cần check kết quả cho miền này không
  shouldCheckResults(region, betDate) {
    const now = new Date();
    const betDateTime = new Date(betDate);
    
    // Chỉ check kết quả cho ngày hôm nay hoặc trước đó
    if (betDateTime.toDateString() > now.toDateString()) {
      return false;
    }
    
    const checkTime = this.checkTimes[region];
    if (!checkTime) return false;
    
    // Tạo thời điểm check cho ngày đặt cược
    const checkDateTime = new Date(betDateTime);
    checkDateTime.setHours(checkTime.hour, checkTime.minute, 0, 0);
    
    // Nếu là ngày hôm nay, check xem đã qua giờ check chưa
    if (betDateTime.toDateString() === now.toDateString()) {
      return now >= checkDateTime;
    }
    
    // Nếu là ngày trước đó thì luôn cần check
    return true;
  }

  // Lấy kết quả từ SGD666 cho một account cụ thể (sử dụng wrapper)
  async fetchSGD666ResultsForAccount(account, betDate) {
    const requestFunction = async (authToken) => {
      const url = 'https://api.sgd6666.asia/api/v1/app/statement/details';
      
      // Sử dụng betDate
      const dateStr = this.formatDateForAPI(betDate);
      
      const params = {
        start: dateStr,
        end: dateStr,
        page: 0,
        limit: 50
      };

      const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'vi',
        'access-control-allow-methods': 'GET,HEAD,POST,PUT',
        'dnt': '1',
        'origin': 'https://sgd6666.asia',
        'priority': 'u=1, i',
        'referer': 'https://sgd6666.asia/',
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'token': `Bearer ${authToken}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      };

      // Cấu hình axios với proxy nếu account có proxy
      const axiosConfig = {
        params,
        headers,
        timeout: 30000
      };

      // Kiểm tra và cấu hình proxy
      if (account.proxy) {
        try {
          const parsedProxy = proxyService.parseProxyString(account.proxy);
          
          // Kiểm tra proxy trước khi sử dụng
          const proxyCheck = await proxyService.checkProxy(parsedProxy);
          if (!proxyCheck.isWorking) {
            console.error(`[${account.username}] Proxy không hoạt động khi fetch results: ${proxyCheck.message}`);
            throw new Error(`Proxy lỗi: ${proxyCheck.message}`);
          }
          
          // Cấu hình proxy cho axios
          let proxyUrl;
          if (parsedProxy.auth) {
            proxyUrl = `http://${parsedProxy.auth.username}:${parsedProxy.auth.password}@${parsedProxy.host}:${parsedProxy.port}`;
          } else {
            proxyUrl = `http://${parsedProxy.host}:${parsedProxy.port}`;
          }
          axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
          console.log(`[${account.username}] Using proxy: ${parsedProxy.host}:${parsedProxy.port}`);
          
        } catch (proxyError) {
          console.error(`[${account.username}] Proxy error:`, proxyError.message);
          throw new Error(`Proxy lỗi: ${proxyError.message}`);
        }
      }

      try {
        const response = await axios.get(url, axiosConfig);
        console.log(`[${account.username}] API response status: ${response.status}`);
        return response.data;
      } catch (requestError) {
        // Xử lý các lỗi HTTP cụ thể
        if (requestError.response) {
          const status = requestError.response.status;
          const statusText = requestError.response.statusText;
          const errorData = requestError.response.data;
          
          console.error(`[${account.username}] HTTP Error ${status}: ${statusText}`, errorData);
          
          if (status === 502) {
            throw new Error(`Lỗi 502 Bad Gateway - Server không phản hồi. Có thể do proxy hoặc server SGD666 gặp sự cố.`);
          } else if (status === 503) {
            throw new Error(`Lỗi 503 Service Unavailable - Server SGD666 tạm thời không khả dụng.`);
          } else if (status === 504) {
            throw new Error(`Lỗi 504 Gateway Timeout - Request timeout qua proxy hoặc server.`);
          } else {
            throw new Error(`HTTP ${status}: ${statusText} - ${JSON.stringify(errorData)}`);
          }
        } else if (requestError.code === 'ECONNRESET') {
          throw new Error(`Kết nối bị reset - có thể do proxy hoặc network issue.`);
        } else if (requestError.code === 'ETIMEDOUT') {
          throw new Error(`Request timeout - proxy hoặc server phản hồi chậm.`);
        } else {
          throw new Error(`Network error: ${requestError.message}`);
        }
      }
    };

    try {
      const result = await this.makeSGD666Request(account, requestFunction);
      console.log(`[${account.username}] SGD666 Results fetched successfully`);
      
      return {
        accountId: account._id,
        username: account.username,
        data: result
      };
    } catch (error) {
      console.error(`[${account.username}] Error fetching SGD666 results:`, {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Format ngày cho API (DD/MM/YYYY)
  formatDateForAPI(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Tìm các bet cần kiểm tra kết quả
  async findBetsNeedingResultCheck() {
    try {
      const bets = await BetHistory.find({
        'result.isChecked': false,
        overallStatus: { $in: ['completed', 'partial_success'] },
        websiteType: 'sgd666' // Chỉ xử lý SGD666 trước
      })
      .populate('accountsUsed.accountId')
      .sort({ betDate: -1 });

      const betsToCheck = [];
      
      for (const bet of bets) {
        if (this.shouldCheckResults(bet.region, bet.betDate)) {
          betsToCheck.push(bet);
        }
      }

      return betsToCheck;
    } catch (error) {
      console.error('Error finding bets needing result check:', error);
      throw error;
    }
  }

  // Kiểm tra kết quả cho tất cả bets cần thiết
  async checkAllPendingResults() {
    try {
      const betsToCheck = await this.findBetsNeedingResultCheck();
      
      if (betsToCheck.length === 0) {
        console.log('No bets need result checking');
        return { checked: 0, updated: 0 };
      }

      console.log(`Found ${betsToCheck.length} bets needing result check`);

      let updatedCount = 0;

      // Process SGD666 bets
      updatedCount += await this.processSGD666Bets(betsToCheck);

      return {
        checked: betsToCheck.length,
        updated: updatedCount
      };
    } catch (error) {
      console.error('Error checking pending results:', error);
      throw error;
    }
  }

  // Xử lý bets SGD666
  async processSGD666Bets(bets) {
    try {
      let updatedCount = 0;

      // Xử lý từng bet một cách độc lập
      for (const bet of bets) {
        try {
          console.log(`[${bet.orderCode}] Processing bet with ${bet.accountsUsed.length} accounts`);
          
          // Thu thập kết quả từ tất cả accounts trong bet này
          const updated = await this.updateCompleteBetResult(bet);
          if (updated) updatedCount++;
          
        } catch (error) {
          console.error(`[${bet.orderCode}] Error processing bet:`, error.message);
          // Tiếp tục với bet khác nếu có lỗi
        }
      }

      return updatedCount;
    } catch (error) {
      console.error('Error processing SGD666 bets:', error);
      throw error;
    }
  }

  // Cập nhật kết quả tổng hợp cho toàn bộ bet (tất cả accounts)
  async updateCompleteBetResult(bet) {
    try {
      // Kiểm tra xem bet đã được check chưa
      if (bet.result.isChecked) {
        console.log(`[${bet.orderCode}] Bet already checked`);
        return false;
      }

      console.log(`[${bet.orderCode}] Starting complete result check for ${bet.accountsUsed.length} accounts`);

      let totalWinLoss = 0;
      let totalStake = 0;
      let allWinDetails = [];
      let allChannelResults = {};
      let accountResults = [];
      let hasAnyWin = false;
      let processedAccounts = 0;
      let allWinningNumbers = []; // Thêm array để lưu tất cả số thắng
      let winningNumbersByChannel = {}; // Lưu số thắng theo từng đài

      // Xử lý từng account trong bet
      for (const accountUsed of bet.accountsUsed) {
        if (accountUsed.betStatus !== 'success' || !accountUsed.accountId) {
          console.log(`[${bet.orderCode}] Skipping account ${accountUsed.username} - not successful`);
          continue;
        }

        try {
          console.log(`[${bet.orderCode}] Processing account: ${accountUsed.username}`);
          
          // Fetch kết quả cho account này
          const results = await this.fetchSGD666ResultsForAccount(
            accountUsed.accountId, 
            bet.betDate
          );

          // Xử lý kết quả cho account này
          const accountResult = await this.getAccountResult(accountUsed, results.data);
          
          if (accountResult.found) {
            // Cộng dồn vào tổng
            totalWinLoss += accountResult.totalWinLoss;
            totalStake += accountResult.totalStake;
            
            // Thu thập số thắng từ account này
            if (accountResult.winningNumbers && accountResult.winningNumbers.length > 0) {
              allWinningNumbers = [...allWinningNumbers, ...accountResult.winningNumbers];
              
              // Lưu số thắng theo từng đài
              Object.keys(accountResult.winningNumbersByChannel).forEach(channel => {
                if (!winningNumbersByChannel[channel]) {
                  winningNumbersByChannel[channel] = [];
                }
                winningNumbersByChannel[channel] = [
                  ...winningNumbersByChannel[channel], 
                  ...accountResult.winningNumbersByChannel[channel]
                ];
              });
            }
            
            // Thêm vào danh sách chi tiết
            accountResults.push({
              accountUsername: accountUsed.username,
              accountId: accountUsed.accountId._id,
              orderCode: accountResult.orderCode,
              totalWinLoss: accountResult.totalWinLoss,
              totalStake: accountResult.totalStake,
              status: accountResult.status,
              recordCount: accountResult.recordCount,
              winDetails: accountResult.winDetails,
              winningNumbers: accountResult.winningNumbers || [], // Thêm số thắng của account
              winningNumbersByChannel: accountResult.winningNumbersByChannel || {}
            });

            // Merge channel results
            Object.keys(accountResult.channelResults).forEach(channel => {
              if (!allChannelResults[channel]) {
                allChannelResults[channel] = {
                  stake: 0,
                  winLoss: 0,
                  numbers: [],
                  status: 'LOSS',
                  accounts: [],
                  winningNumbers: [] // Thêm số thắng cho từng đài
                };
              }
              
              allChannelResults[channel].stake += accountResult.channelResults[channel].stake;
              allChannelResults[channel].winLoss += accountResult.channelResults[channel].winLoss;
              allChannelResults[channel].numbers = [...new Set([
                ...allChannelResults[channel].numbers, 
                ...accountResult.channelResults[channel].numbers
              ])];
              
              if (accountResult.channelResults[channel].status === 'WIN') {
                allChannelResults[channel].status = 'WIN';
                hasAnyWin = true;
                
                // Thêm số thắng cho đài này
                if (accountResult.channelResults[channel].winningNumbers) {
                  allChannelResults[channel].winningNumbers = [...new Set([
                    ...allChannelResults[channel].winningNumbers,
                    ...accountResult.channelResults[channel].winningNumbers
                  ])];
                }
              }
              
              allChannelResults[channel].accounts.push(accountUsed.username);
            });

            // Merge win details
            allWinDetails = [...allWinDetails, ...accountResult.winDetails];
            
            if (accountResult.status === 'WIN') {
              hasAnyWin = true;
            }
            
            processedAccounts++;
          } else {
            console.log(`[${bet.orderCode}] No results found for account ${accountUsed.username}`);
            
            // Thêm account không tìm thấy kết quả
            accountResults.push({
              accountUsername: accountUsed.username,
              accountId: accountUsed.accountId._id,
              orderCode: accountResult.orderCode || 'NOT_FOUND',
              totalWinLoss: 0,
              totalStake: 0,
              status: 'NOT_FOUND',
              recordCount: 0,
              winDetails: [],
              winningNumbers: [],
              winningNumbersByChannel: {}
            });
          }
          
        } catch (error) {
          console.error(`[${bet.orderCode}] Error processing account ${accountUsed.username}:`, error.message);
          
          // Thêm account có lỗi
          accountResults.push({
            accountUsername: accountUsed.username,
            accountId: accountUsed.accountId._id,
            orderCode: 'ERROR',
            totalWinLoss: 0,
            totalStake: 0,
            status: 'ERROR',
            recordCount: 0,
            winDetails: [],
            winningNumbers: [],
            winningNumbersByChannel: {},
            error: error.message
          });
        }
      }

      // Loại bỏ số trùng lặp trong allWinningNumbers
      allWinningNumbers = [...new Set(allWinningNumbers)];
      
      // Loại bỏ số trùng lặp trong winningNumbersByChannel
      Object.keys(winningNumbersByChannel).forEach(channel => {
        winningNumbersByChannel[channel] = [...new Set(winningNumbersByChannel[channel])];
      });

      // Xác định trạng thái tổng thể
      let overallStatus = 'LOSS';
      if (hasAnyWin && totalWinLoss > 0) {
        overallStatus = 'WIN';
      } else if (totalWinLoss === 0) {
        overallStatus = 'DRAW';
      }

      // Cập nhật kết quả vào database
      bet.result.isChecked = true;
      bet.result.checkedAt = new Date();
      bet.result.status = overallStatus;
      bet.result.totalWinAmount = totalWinLoss;
      bet.result.totalStake = totalStake;
      bet.result.winningNumbers = allWinningNumbers; // Lưu tất cả số thắng
      bet.result.winningNumbersByChannel = winningNumbersByChannel; // Lưu số thắng theo đài
      bet.result.winDetails = allWinDetails;
      bet.result.channelResults = allChannelResults;
      bet.result.accountResults = accountResults;
      bet.result.processedAccounts = processedAccounts;
      bet.result.totalAccounts = bet.accountsUsed.filter(acc => acc.betStatus === 'success').length;

      await bet.save();
      
      console.log(`[${bet.orderCode}] ✅ Updated complete bet result:`, {
        status: overallStatus,
        totalWinLoss: totalWinLoss,
        totalStake: totalStake,
        winningNumbers: allWinningNumbers,
        winningNumbersByChannel: winningNumbersByChannel,
        processedAccounts: processedAccounts,
        totalAccounts: bet.result.totalAccounts,
        channelCount: Object.keys(allChannelResults).length
      });
      
      return true;
      
    } catch (error) {
      console.error(`[${bet.orderCode}] Error updating complete bet result:`, error);
      return false;
    }
  }

  // Helper function để lấy kết quả của 1 account - CẬP NHẬT
  async getAccountResult(accountUsed, apiResults) {
    try {
      // Tìm orderCode trong betResponse của account này
      const orderCode = accountUsed.betResponse?.orderCode || 
                       accountUsed.betResponse?.data?.orderCode ||
                       accountUsed.betResponse?.order_code;
      
      if (!orderCode) {
        return { found: false, orderCode: null };
      }

      // Xử lý dữ liệu API trả về
      const apiData = apiResults?.data?.data || apiResults?.data || [];

      if (!Array.isArray(apiData)) {
        return { found: false, orderCode };
      }

      // Tìm các records khớp với orderCode
      const normalizedTargetOrderCode = String(orderCode).trim().toUpperCase();
      const matchingRecords = apiData.filter(record => {
        if (!record.orderCode) return false;
        const apiOrderCode = String(record.orderCode).trim().toUpperCase();
        return record.orderCode === orderCode || apiOrderCode === normalizedTargetOrderCode;
      });
      
      if (matchingRecords.length === 0) {
        return { found: false, orderCode };
      }

      // Tính tổng kết quả từ tất cả records của account này
      let totalWinLoss = 0;
      let totalStake = 0;
      let winDetails = [];
      let channelResults = {};
      let hasWin = false;
      let winningNumbers = []; // Thêm array để lưu số thắng
      let winningNumbersByChannel = {}; // Lưu số thắng theo đài

      matchingRecords.forEach((record, index) => {
        // Cộng dồn kết quả
        const winLoss = parseFloat(record.memberWinLoss) || 0;
        const stake = parseFloat(record.stake) || 0;
        
        totalWinLoss += winLoss;
        totalStake += stake;

        // Thu thập số thắng
        if (record.status === 'WIN' && record.numbers && Array.isArray(record.numbers)) {
          winningNumbers = [...winningNumbers, ...record.numbers];
          
          // Lưu số thắng theo từng đài
          if (record.channels && Array.isArray(record.channels)) {
            record.channels.forEach(channel => {
              if (!winningNumbersByChannel[channel]) {
                winningNumbersByChannel[channel] = [];
              }
              winningNumbersByChannel[channel] = [
                ...winningNumbersByChannel[channel], 
                ...record.numbers
              ];
            });
          }
        }

        // Xử lý kết quả theo từng đài
        if (record.channels && Array.isArray(record.channels)) {
          record.channels.forEach(channel => {
            if (!channelResults[channel]) {
              channelResults[channel] = {
                stake: 0,
                winLoss: 0,
                numbers: [],
                status: 'LOSS',
                winningNumbers: [] // Thêm số thắng cho từng đài
              };
            }
            
            channelResults[channel].stake += stake;
            channelResults[channel].winLoss += winLoss;
            
            // Kiểm tra xem đài này có thắng không
            if (record.channelWin && record.channelWin.includes(channel)) {
              channelResults[channel].status = 'WIN';
              hasWin = true;
              
              // Thêm số thắng cho đài này
              if (record.numbers && Array.isArray(record.numbers)) {
                channelResults[channel].winningNumbers = [...new Set([
                  ...channelResults[channel].winningNumbers,
                  ...record.numbers
                ])];
              }
            }
            
            // Thêm số vào danh sách
            if (record.numbers && Array.isArray(record.numbers)) {
              channelResults[channel].numbers = [...new Set([...channelResults[channel].numbers, ...record.numbers])];
            }
          });
        }

        // Thêm chi tiết vào winDetails
        winDetails.push({
          numbers: record.numbers || [],
          channels: record.channels || [],
          channelWin: record.channelWin || [],
          status: record.status || 'UNKNOWN',
          stake: stake,
          winLoss: winLoss,
          betType: record.betType || '',
          betTypeChild: record.betTypeChild || '',
          isWinning: record.status === 'WIN' // Thêm flag để dễ identify
        });

        // Cập nhật trạng thái
        if (record.status === 'WIN' || winLoss > 0) {
          hasWin = true;
        }
      });

      // Loại bỏ số trùng lặp
      winningNumbers = [...new Set(winningNumbers)];
      Object.keys(winningNumbersByChannel).forEach(channel => {
        winningNumbersByChannel[channel] = [...new Set(winningNumbersByChannel[channel])];
      });

      // Xác định trạng thái của account này
      let status = 'LOSS';
      if (hasWin && totalWinLoss > 0) {
        status = 'WIN';
      } else if (totalWinLoss === 0) {
        status = 'DRAW';
      }

      return {
        found: true,
        orderCode,
        totalWinLoss,
        totalStake,
        status,
        recordCount: matchingRecords.length,
        winDetails,
        channelResults,
        winningNumbers, // Thêm số thắng
        winningNumbersByChannel // Thêm số thắng theo đài
      };
      
    } catch (error) {
      console.error(`Error getting account result for ${accountUsed.username}:`, error);
      return { found: false, orderCode: null, error: error.message };
    }
  }

  // Thêm helper function để format kết quả cho display
  formatResultSummary(bet) {
    if (!bet.result.isChecked) {
      return 'Chưa kiểm tra';
    }

    const { status, totalWinAmount, totalStake, channelResults } = bet.result;
    
    let summary = `${status === 'WIN' ? '🎉 THẮNG' : status === 'LOSS' ? '❌ THUA' : '⚖️ HÒA'}`;
    summary += ` | Cược: ${totalStake?.toLocaleString() || 0}đ`;
    summary += ` | Kết quả: ${totalWinAmount?.toLocaleString() || 0}đ`;
    
    if (channelResults && Object.keys(channelResults).length > 0) {
      const channelSummary = Object.entries(channelResults)
        .map(([channel, result]) => `${channel}: ${result.status}`)
        .join(', ');
      summary += ` | Đài: ${channelSummary}`;
    }
    
    return summary;
  }

  // Kiểm tra kết quả khi user vào trang thống kê
  async checkResultsOnStatsView() {
    try {
      console.log('Checking results on stats view...');
      const result = await this.checkAllPendingResults();
      console.log(`Result check completed: ${result.checked} checked, ${result.updated} updated`);
      return result;
    } catch (error) {
      console.error('Error in checkResultsOnStatsView:', error);
      throw error;
    }
  }
}

module.exports = new ResultCheckService();