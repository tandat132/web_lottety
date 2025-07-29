const crypto = require('crypto');

class SGD666Utils {
  constructor() {
    this.secretPhrase = 'Ofc54FTdEPtuEzmGmMyvYn27la9I8DdaEIMfnd';
  }

  // Hàm tạo hash chung cho SGD666 (login, betting, etc.)
  createHash(data) {
    try {
      // Convert to compact JSON string
      const jsonString = JSON.stringify(data).replace(/\s/g, '');
      
      const key = crypto.createHash('sha256').update(this.secretPhrase, 'utf8').digest();

      // Generate random IV (16 bytes)
      const iv = crypto.randomBytes(16);

      // Pad data
      const pad = (s) => {
        const padLength = 16 - (s.length % 16);
        return s + String.fromCharCode(padLength).repeat(padLength);
      };

      const paddedData = pad(jsonString);
      
      // Encrypt using AES-256-CBC
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      cipher.setAutoPadding(false);
      
      let encrypted = cipher.update(paddedData, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Tạo hash object 
      const hashObj = {
        iv: iv.toString('hex'),
        hash: encrypted
      };

      // Convert to JSON và base64 encode 
      const hashJson = JSON.stringify(hashObj).replace(/\s/g, '');
      const hashBase64 = Buffer.from(hashJson, 'utf8').toString('base64');
      
      return hashBase64;
    } catch (error) {
      console.error('Error creating SGD666 hash:', error);
      throw new Error('Failed to create hash');
    }
  }

  // Tạo hash cho login
  createLoginHash(username, password) {
    const data = {
      userName: username,
      password: password,
      origin: 'member'
    };
    
    return this.createHash(data);
  }

  // Tạo hash cho betting
  createBetHash(betData) {
    const data = [{
      stake: betData.totalStake,
      region: betData.region,
      channels: betData.channels,
      betType: [betData.betType],
      betTypeChild: "TWO_NUMBERS",
      numbers: betData.numbers,
      stakePerBet: betData.stakePerBet.toString(),
      date: this.getCurrentDateVN(),
      confirm: false,
      site: "member"
    }];
    console.log(data)
    return this.createHash(data);
  }

  // Lấy ngày hiện tại theo múi giờ VN (UTC+7)
  getCurrentDateVN() {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // UTC+7
    
    const day = vnTime.getUTCDate().toString().padStart(2, '0');
    const month = (vnTime.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = vnTime.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  }

  // Mapping betType từ frontend sang backend
  mapBetType(frontendBetType) {
    const betTypeMapping = {
      'bao-lo': 'ALL_LOT',
      'dau-duoi': 'FIRST_LAST',
      'duoi': 'LAST',
      'dau': 'FIRST', 
      'da': 'KICK_STRAIGHT',
      '7-lo': 'SEVEN_LOT',
      '7-lo-dau': 'SEVEN_LOT_FIRST',
      '7-lo-duoi': 'SEVEN_LOT_LAST',
      '7-lo-giua': 'SEVEN_LOT_BETWEEN',
      'giai-7': 'PRIZE_SEVEN',
      'giai-6': 'PRIZE_SIX',
      'giai-5': 'PRIZE_FIVE',
      'giai-4': 'PRIZE_FOUR',
      'giai-3': 'PRIZE_THREE',
      'giai-2': 'PRIZE_TWO',
      'giai-1': 'PRIZE_ONE',
    };
    
    return betTypeMapping[frontendBetType] || 'LAST';
  }
  
  // Mapping stations từ frontend sang backend SGD666
  mapStations(frontendStations) {
    const stationMapping = {
      // Miền Bắc
      'mb1': 'mb1',
      'mb2': 'mb2',
      'ha-noi': 'hanoi',
      'quang-ninh': 'quangninh',
      'bac-ninh': 'bacninh',
      'hai-phong': 'haiphong',
      'nam-dinh': 'namdinh',
      'thai-binh': 'thaibinh',
      
      // Miền Nam
      'tp-hcm': 'thanhpho',
      'dong-thap': 'dongthap', 
      'ca-mau': 'camau',
      'ben-tre': 'bentre',
      'vung-tau': 'vungtau',
      'bac-lieu': 'baclieu',
      'can-tho': 'cantho',
      'soc-trang': 'soctrang',
      'tay-ninh': 'tayninh',
      'an-giang': 'angiang',
      'binh-thuan': 'binhthuan',
      'vinh-long': 'vinhlong',
      'tra-vinh': 'travinh',
      'long-an': 'longan',
      'binh-phuoc': 'binhphuoc',
      'hau-giang': 'haugiang',
      'tien-giang': 'tiengiang',
      'kien-giang': 'kiengiang',
      'da-lat': 'dalat',
      
      // Miền Trung
      'thua-thien-hue': 'thuathienhue',
      'phu-yen': 'phuyen',
      'dak-lak': 'daklak',
      'quang-nam': 'quangnam',
      'da-nang': 'danang',
      'khanh-hoa': 'khanhhoa',
      'binh-dinh': 'binhdinh',
      'quang-tri': 'quangtri',
      'ninh-thuan': 'ninhthuan',
      'quang-binh': 'quangbinh',
      'gia-lai': 'gialai',
      'quang-ngai': 'quangngai',
      'dak-nong': 'daknong',
      'kon-tum': 'kontum'
    };

    if (!frontendStations || !Array.isArray(frontendStations)) {
      return [];
    }

    return frontendStations.map(station => {
      const mappedStation = stationMapping[station];
      if (!mappedStation) {
        console.warn(`Unknown station: ${station}, using original value`);
        return station.toLowerCase();
      }
      return mappedStation;
    });
  }

  // Mapping region từ frontend sang backend
  mapRegion(frontendRegion) {
    const regionMapping = {
      'north': 'NORTH',
      'central': 'CENTRAL',
      'south': 'SOUTH'
    };
    
    return regionMapping[frontendRegion] || 'CENTRAL';
  }

  // Thêm hàm tính hệ số nhân cho từng loại đánh SGD666
  getBetTypeMultiplier(betType, numberCount) {
    switch (betType) {
      case 'ALL_LOT': // Bao lô
        return 18;
      
      case 'FIRST_LAST': // Đầu đuôi
        return 2;
      
      case 'KICK_STRAIGHT': // Đá
        return 18 * (numberCount - 1);
      
      case 'SEVEN_LOT': // 7 lô
      case 'SEVEN_LOT_FIRST': // 7 lô đầu
      case 'SEVEN_LOT_LAST': // 7 lô đuôi
      case 'SEVEN_LOT_BETWEEN': // 7 lô giữa
        return 7;
      
      // Các loại còn lại
      case 'LAST': // Đuôi
      case 'FIRST': // Đầu
      case 'PRIZE_SEVEN': // Giải 7
      case 'PRIZE_SIX': // Giải 6
      case 'PRIZE_FIVE': // Giải 5
      case 'PRIZE_FOUR': // Giải 4
      case 'PRIZE_THREE': // Giải 3
      case 'PRIZE_TWO': // Giải 2
      case 'PRIZE_ONE': // Giải 1
      default:
        return 1;
    }
  }

  // Tính tổng điểm dựa trên loại đánh
  calculateTotalStake(betType, numberCount, stakePerBet, channelCount = 1) {
    const multiplier = this.getBetTypeMultiplier(betType, numberCount);

    return numberCount * stakePerBet * multiplier * channelCount;
  }
  
  // Validate bet data
  validateBetData(betData) {
    console.log(betData)
    const errors = [];

    if (!betData.numbers || !Array.isArray(betData.numbers) || betData.numbers.length === 0) {
      errors.push('Danh sách số không hợp lệ');
    }

    if (!betData.totalStake || betData.totalStake <= 0) {
      errors.push('Tổng điểm phải lớn hơn 0');
    }

    if (!betData.stakePerBet || betData.stakePerBet <= 0) {
      errors.push('Điểm đánh mỗi số phải lớn hơn 0');
    }

    if (!betData.channels || !Array.isArray(betData.channels) || betData.channels.length === 0) {
      errors.push('Phải chọn ít nhất một đài');
    }

    // Kiểm tra tổng điểm có khớp không
    const expectedTotal = this.calculateTotalStake(betData.betType, betData.numbers.length, betData.stakePerBet, betData.channels.length);
    if (betData.totalStake !== expectedTotal) {
      errors.push(`Tổng điểm không khớp. Mong đợi: ${expectedTotal}, thực tế: ${betData.totalStake}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = new SGD666Utils();