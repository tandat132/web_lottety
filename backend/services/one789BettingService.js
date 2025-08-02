const axios = require('axios');
const Account = require('../models/Account');
const proxyService = require('./proxyService');
const one789AuthService = require('./one789Auth');
const { HttpsProxyAgent } = require('https-proxy-agent');

class One789BettingService {
  constructor() {
    this.bettingUrl = 'https://lotto.lotusapi.com/game-play/player/play';
    this.authService = one789AuthService;
  }

  // Mapping station từ frontend sang GameType cho ONE789
  mapStationToGameType(station, region) {
    // Miền Bắc có GameType cố định
    if (region === 'north1') return 0;
    if (region === 'north2') return 1;
    
    // Miền Nam: GameType dựa trên thứ tự đài trong ngày
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ...
    
    // Cấu hình đài miền Nam theo ngày (giống frontend)
    const southStationsByDay = {
      1: ['tp-hcm', 'dong-thap', 'ca-mau'], // Thứ 2
      2: ['ben-tre', 'vung-tau', 'bac-lieu'], // Thứ 3
      3: ['dong-nai', 'can-tho', 'soc-trang'], // Thứ 4
      4: ['tay-ninh', 'an-giang', 'binh-thuan'], // Thứ 5
      5: ['vinh-long', 'binh-duong', 'tra-vinh'], // Thứ 6
      6: ['tp-hcm', 'long-an', 'binh-phuoc', 'hau-giang'], // Thứ 7
      0: ['tien-giang', 'kien-giang', 'da-lat'] // Chủ nhật
    };
    
    const todayStations = southStationsByDay[dayOfWeek] || [];
    const stationIndex = todayStations.indexOf(station);
    
    // GameType = 2 + index (2, 3, 4, ...)
    return stationIndex >= 0 ? 2 + stationIndex : 2;
  }

  // Mapping betType từ frontend sang ONE789 format
  mapBetType(frontendBetType) {
    const betTypeMapping = {
      // Miền Bắc 1
      'de': 0,                    // Đề
      'de-dau': 21,              // Đề đầu
      'de-giai1': 22,            // Đề giải 1
      'de-dau-giai1': 23,        // Đề đầu giải 1
      'de-thanh-tai': 24,        // Đề thần tài
      'de-dau-than-tai': 25,     // Đề đầu thần tài
      'lo-xien': 1,              // Lô xiên (Lô)
      'lo-truot': 6,             // Lô trượt
      'lo-dau': 29,              // Lô đầu

      // Miền Bắc 2 và Miền Nam
      '2d-dau': 7,               // 2D đầu
      '2d-duoi': 8,              // 2D đuôi
      '2d-18lo': 15,             // 2D 18 lô
      '2d-18lo-dau': 30,         // 2D 18 lô đầu
      '2d-dau-mb2': 7,           // 2D đầu MB2

      // 3D (nếu cần)
      '3d-dau': 10,              // 3D đầu
      '3d-duoi': 11,             // 3D đuôi
      '3d-17lo': 17,             // 3D 17 lô
      '3d-7lo': 18,              // 3D 7 lô
      '3d-23lo-mb2': 12,         // 3D 23 lô MB2

      // 4D (nếu cần)
      '4d-duoi': 13,             // 4D đuôi
      '4d-16lo': 19,             // 4D 16 lô
    };
    
    return betTypeMapping[frontendBetType] || 0;
  }

  // Tính Alias cho Additional field
  calculateAlias(betType) {
    const aliasMapping = {
      7: 128,    // 2D Đầu (bit 7)
      8: 256,    // 2D Đuôi (bit 8)
      9: 512,    // 2D Đầu-Đuôi (bit 9)
      10: 1024,  // 2D 27 Lô (bit 10)
      15: 2048,  // 2D 18 Lô (bit 11)
      16: 4096,  // 2D 7 Lô (bit 12)
      30: 2048,  // 2D 18 Lô Đầu (bit 11)
    };
    
    return aliasMapping[betType] || 128; // Default 128
  }

  // Tạo payload ONE789
  createOne789Payload(betData) {
    const { region, betType, numbersArray, points, stations } = betData;
    
    const mappedBetType = this.mapBetType(betType);
    
    // Lấy ngày hiện tại theo format YYYY-MM-DD
    const today = new Date();
    const term = today.toISOString().split('T')[0];
    
    const payload = {
      Term: term,
      IgnorePrice: true,
      Tickets: []
    };

    // Xử lý theo stations được chọn
    if (stations && stations.length > 0) {
      // Tạo ticket cho từng đài được chọn
      stations.forEach(station => {
        const gameType = this.mapStationToGameType(station, region);
        
        const ticket = {
          GameType: gameType,
          BetType: mappedBetType,
          Items: numbersArray.map(number => ({
            Numbers: [number],
            Point: points,
            Price: 0
          }))
        };

        // Thêm Additional nếu cần
        if ([7, 8, 9, 10, 15, 16, 30].includes(mappedBetType)) {
          ticket.Additional = {
            Row: 0,
            Alias: this.calculateAlias(mappedBetType),
            Reverse: false
          };
        }

        payload.Tickets.push(ticket);
      });
    } else {
      // Fallback: sử dụng GameType mặc định theo region
      let gameType = 2; // Mặc định miền Nam
      if (region === 'north1') gameType = 0;
      else if (region === 'north2') gameType = 1;
      
      const ticket = {
        GameType: gameType,
        BetType: mappedBetType,
        Items: numbersArray.map(number => ({
          Numbers: [number],
          Point: points,
          Price: 0
        }))
      };

      // Thêm Additional nếu cần
      if ([7, 8, 9, 10, 15, 16, 30].includes(mappedBetType)) {
        ticket.Additional = {
          Row: 0,
          Alias: this.calculateAlias(mappedBetType),
          Reverse: false
        };
      }

      payload.Tickets.push(ticket);
    }

    return payload;
  }

  // Thực hiện betting ONE789
  async executeOne789Betting(account, betData) {
    try {
      // Lấy token hợp lệ
      const token = await this.authService.getValidToken(account._id);
      
      // Tạo payload
      const payload = this.createOne789Payload(betData);
      
      console.log(`[${account.username}] ONE789 Betting payload:`, JSON.stringify(payload, null, 2));
      
      // Chuẩn bị headers
      const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'dnt': '1',
        'origin': 'https://b2one789.net',
        'priority': 'u=1, i',
        'referer': 'https://b2one789.net/',
        'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
      };

      // Cấu hình axios
      const axiosConfig = {
        headers,
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

      // Gửi request
      const response = await axios.post(this.bettingUrl, payload, axiosConfig);
      
      console.log(`[${account.username}] ONE789 Betting response:`, response.data);

      // Kiểm tra response
      if (response.data && response.status === 200) {
        // Tạo orderCode từ response hoặc timestamp
        const orderCode = response.data[0].Tx || 
                         response.data[0].orderId || 
                         response.data[0].id ||
                         `ONE789_${Date.now()}_${account.username}`;

        return {
          success: true,
          message: 'ONE789 betting successful',
          orderCode: orderCode,
          betDetails: {
            payload: payload,
            response: response.data
          }
        };
      } else {
        throw new Error('Invalid response from ONE789 API');
      }

    } catch (error) {
      console.error(`[${account.username}] ONE789 Betting failed:`, error.message);
      
      // Xử lý lỗi cụ thể
      if (error.response) {
        const errorData = error.response.data;
        console.error(`[${account.username}] ONE789 API Error:`, errorData);
        
        return {
          success: false,
          error: 'ONE789 betting failed',
          details: errorData?.message || errorData?.error || error.message
        };
      }
      
      return {
        success: false,
        error: 'ONE789 betting failed',
        details: error.message
      };
    }
  }

  // Validate bet data cho ONE789
  validateOne789BetData(betData) {
    const errors = [];

    if (!betData.numbersArray || !Array.isArray(betData.numbersArray) || betData.numbersArray.length === 0) {
      errors.push('Danh sách số không hợp lệ');
    }

    if (!betData.points || betData.points <= 0) {
      errors.push('Điểm đánh phải lớn hơn 0');
    }

    if (!betData.region || !['north1', 'north2', 'south'].includes(betData.region)) {
      errors.push('Miền không hợp lệ');
    }

    if (!betData.betType) {
      errors.push('Loại đánh không hợp lệ');
    }

    // Validate số theo loại đánh
    const is3D = betData.betType.includes('3d');
    const is4D = betData.betType.includes('4d');
    
    betData.numbersArray.forEach(number => {
      if (is4D) {
        if (!/^\d{4}$/.test(number) || parseInt(number) < 0 || parseInt(number) > 9999) {
          errors.push(`Số ${number} không hợp lệ cho 4D (0000-9999)`);
        }
      } else if (is3D) {
        if (!/^\d{3}$/.test(number) || parseInt(number) < 0 || parseInt(number) > 999) {
          errors.push(`Số ${number} không hợp lệ cho 3D (000-999)`);
        }
      } else {
        if (!/^\d{2}$/.test(number) || parseInt(number) < 0 || parseInt(number) > 99) {
          errors.push(`Số ${number} không hợp lệ cho 2D (00-99)`);
        }
      }
    });

    return errors;
  }
}

module.exports = new One789BettingService();