import React, { useState, useEffect } from 'react';
import { accountAPI } from '../services/api';
import api from '../services/api';
import type { Account } from '../types/account';
import one789Logo from '../assets/one789-logo.png';
import sgd666Logo from '../assets/sgd666-logo.png';

interface BettingForm {
  points: number;
  numbers: string;
  distributionType: 'equal' | 'random' | 'all';
  betType: string;
  region: 'south' | 'central' | 'north' | 'north1' | 'north2';
  stations: string[];
  websiteType: string;
}


const Dashboard: React.FC = () => {
  const [form, setForm] = useState<BettingForm>({
    points: 0,
    numbers: '',
    distributionType: 'equal',
    betType: 'bao-lo',
    region: 'south',
    stations: [],
    websiteType: 'one789'
  });

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info', 
    message: string,
    details?: Array<{username: string, error: string}>
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const websiteTypes = [
    { value: 'one789', label: 'ONE789', icon: one789Logo },
    { value: 'sgd666', label: 'SGD666', icon: sgd666Logo },
  ];

  // Hàm lấy ngày hiện tại theo múi giờ +7
  const getCurrentDayOfWeek = (): number => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const vietnamTime = new Date(utc + (7 * 3600000));
    return vietnamTime.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
  };

  // Cấu hình kiểu đánh cho từng website và miền
  const getBetTypes = () => {
    if (form.websiteType === 'sgd666') {
      if (form.region === 'north') {
        return [
          { value: 'bao-lo', label: '🎯 Bao lô', description: 'Đánh bao toàn bộ số' },
          { value: 'dau-duoi', label: '🔄 Đầu đuôi', description: 'Đánh cả đầu và đuôi' },
          { value: 'dau', label: '⬆️ Đầu', description: 'Chỉ đánh đầu số' },
          { value: 'duoi', label: '⬇️ Đuôi', description: 'Chỉ đánh đuôi số' },
          { value: 'da', label: '💎 Đá', description: 'Đánh kiểu đá' },
          { value: 'giai-6', label: '🥇 Giải 6', description: 'Đánh giải sáu' },
          { value: 'giai-5', label: '🥈 Giải 5', description: 'Đánh giải năm' },
          { value: 'giai-4', label: '🥉 Giải 4', description: 'Đánh giải bốn' },
          { value: 'giai-3', label: '🏅 Giải 3', description: 'Đánh giải ba' },
          { value: 'giai-2', label: '🎖️ Giải 2', description: 'Đánh giải nhì' },
          { value: 'giai-1', label: '👑 Giải 1', description: 'Đánh giải nhất' }
        ];
      } else {
        return [
          { value: 'bao-lo', label: '🎯 Bao lô', description: 'Đánh bao toàn bộ số' },
          { value: 'dau-duoi', label: '🔄 Đầu đuôi', description: 'Đánh cả đầu và đuôi' },
          { value: 'dau', label: '⬆️ Đầu', description: 'Chỉ đánh đầu số' },
          { value: 'duoi', label: '⬇️ Đuôi', description: 'Chỉ đánh đuôi số' },
          { value: 'da', label: '💎 Đá', description: 'Đánh kiểu đá' },
          { value: '7-lo', label: '🎰 7 lô', description: 'Đánh 7 lô thường' },
          { value: '7-lo-dau', label: '🎰⬆️ 7 lô đầu', description: '7 lô vị trí đầu' },
          { value: '7-lo-duoi', label: '🎰⬇️ 7 lô đuôi', description: '7 lô vị trí đuôi' },
          { value: '7-lo-giua', label: '🎰🔄 7 lô giữa', description: '7 lô vị trí giữa' },
          { value: 'giai-7', label: '🏆 Giải 7', description: 'Đánh giải bảy' },
          { value: 'giai-6', label: '🥇 Giải 6', description: 'Đánh giải sáu' },
          { value: 'giai-5', label: '🥈 Giải 5', description: 'Đánh giải năm' },
          { value: 'giai-4', label: '🥉 Giải 4', description: 'Đánh giải bốn' },
          { value: 'giai-3', label: '🏅 Giải 3', description: 'Đánh giải ba' },
          { value: 'giai-2', label: '🎖️ Giải 2', description: 'Đánh giải nhì' },
          { value: 'giai-1', label: '👑 Giải 1', description: 'Đánh giải nhất' }
        ];
      }
    } else if (form.websiteType === 'one789') {
      if (form.region === 'south') {
        return [
          { value: '2d-dau', label: '🎯 2D đầu', description: '2D vị trí đầu' },
          { value: '2d-duoi', label: '🎯 2D đuôi', description: '2D vị trí đuôi' },
          { value: '2d-18lo', label: '🎰 2D 18 lô', description: '2D 18 lô thường' },
          { value: '2d-18lo-dau', label: '🎰⬆️ 2D 18 lô đầu', description: '2D 18 lô vị trí đầu' },
          // { value: '3d-dau', label: '🎲 3D đầu', description: '3D vị trí đầu' },
          // { value: '3d-duoi', label: '🎲 3D đuôi', description: '3D vị trí đuôi' },
          // { value: '3d-17lo', label: '🎰 3D 17 lô', description: '3D 17 lô thường' },
          // { value: '3d-7lo', label: '🎰 3D 7 lô', description: '3D 7 lô thường' }
        ];
      } else if (form.region === 'north1') {
        return [
          { value: 'de', label: '🎯 Đề', description: 'Đề thường' },
          { value: 'de-dau', label: '🎯 Đề đầu', description: 'Đề đầu' },
          { value: 'de-giai1', label: '🎯 Đề giải 1', description: 'Đề giải 1' },
          { value: 'de-dau-giai1', label: '🎯 Đề đầu giải 1', description: 'Đề đầu giải 1' },
          { value: 'de-thanh-tai', label: '🎯 Đề thành tài', description: 'Đề thành tài' },
          { value: 'de-dau-than-tai', label: '🎯 Đề đầu thần tài', description: 'Đề đầu thần tài' },
          { value: 'lo-xien', label: '🎰 Lô xiên', description: 'Lô xiên' },
          { value: 'lo-truot', label: '🎰 Lô trượt', description: 'Lô trượt' },
          { value: 'lo-dau', label: '🎰 Lô đầu', description: 'Lô đầu' }
        ];
      } else if (form.region === 'north2') {
        return [
          { value: '2d-dau-mb2', label: '🎯 2D đầu', description: '2D đầu MB2' },
          // { value: '3d-dau-mb2', label: '🎲 3D đầu', description: '3D đầu MB2' },
          // { value: '3d-duoi-mb2', label: '🎲 3D đuôi', description: '3D đuôi MB2' },
          // { value: '3d-23lo-mb2', label: '🎰 3D 23 lô', description: '3D 23 lô MB2' }
        ];
      }
    }
    return [];
  };

  // Cấu hình đài theo ngày
  const getStationsByDay = () => {
    const dayOfWeek = getCurrentDayOfWeek();
    
    const stationsByDay: Record<'south' | 'central' | 'north', Record<number, Array<{value: string, label: string, icon: string, disabled?: boolean}>>> = {
      south: {
        1: [ // Thứ 2
          { value: 'tp-hcm', label: 'TP. Hồ Chí Minh', icon: '🏙️' },
          { value: 'dong-thap', label: 'Đồng Tháp', icon: '🌾' },
          { value: 'ca-mau', label: 'Cà Mau', icon: '🦐' }
        ],
        2: [ // Thứ 3
          { value: 'ben-tre', label: 'Bến Tre', icon: '🥥' },
          { value: 'vung-tau', label: 'Vũng Tàu', icon: '🏖️' },
          { value: 'bac-lieu', label: 'Bạc Liêu', icon: '🐟' }
        ],
        3: [ // Thứ 4
          { value: 'dong-nai', label: 'Đồng Nai', icon: '🏭' },
          { value: 'can-tho', label: 'Cần Thơ', icon: '🛶' },
          { value: 'soc-trang', label: 'Sóc Trăng', icon: '🌾' }
        ],
        4: [ // Thứ 5
          { value: 'tay-ninh', label: 'Tây Ninh', icon: '⛰️' },
          { value: 'an-giang', label: 'An Giang', icon: '🌾' },
          { value: 'binh-thuan', label: 'Bình Thuận', icon: '🏖️' }
        ],
        5: [ // Thứ 6
          { value: 'vinh-long', label: 'Vĩnh Long', icon: '🛶' },
          { value: 'binh-duong', label: 'Bình Dương', icon: '🏭' },
          { value: 'tra-vinh', label: 'Trà Vinh', icon: '🌾' }
        ],
        6: [ // Thứ 7
          { value: 'tp-hcm', label: 'TP. Hồ Chí Minh', icon: '🏙️' },
          { value: 'long-an', label: 'Long An', icon: '🌾' },
          { value: 'binh-phuoc', label: 'Bình Phước', icon: '🌳' },
          { value: 'hau-giang', label: 'Hậu Giang', icon: '🛶' }
        ],
        0: [ // Chủ nhật
          { value: 'tien-giang', label: 'Tiền Giang', icon: '🌾' },
          { value: 'kien-giang', label: 'Kiên Giang', icon: '🏖️' },
          { value: 'da-lat', label: 'Đà Lạt', icon: '🌸' }
        ]
      },
      central: {
        1: [ // Thứ 2
          { value: 'phu-yen', label: 'Phú Yên', icon: '🏖️' },
          { value: 'thua-thien-hue', label: 'Thừa Thiên Huế', icon: '🏛️' }
        ],
        2: [ // Thứ 3
          { value: 'dak-lak', label: 'Đắk Lắk', icon: '🐘' },
          { value: 'quang-nam', label: 'Quảng Nam', icon: '🏛️' }
        ],
        3: [ // Thứ 4
          { value: 'da-nang', label: 'Đà Nẵng', icon: '🌉' },
          { value: 'khanh-hoa', label: 'Khánh Hòa', icon: '🏝️' }
        ],
        4: [ // Thứ 5
          { value: 'binh-dinh', label: 'Bình Định', icon: '🏰' },
          { value: 'quang-tri', label: 'Quảng Trị', icon: '🏛️' },
          { value: 'quang-binh', label: 'Quảng Bình', icon: '🏞️' }
        ],
        5: [ // Thứ 6
          { value: 'gia-lai', label: 'Gia Lai', icon: '☕' },
          { value: 'ninh-thuan', label: 'Ninh Thuận', icon: '🍇' }
        ],
        6: [ // Thứ 7
          { value: 'da-nang', label: 'Đà Nẵng', icon: '🌉' },
          { value: 'quang-ngai', label: 'Quảng Ngãi', icon: '🏖️' },
          { value: 'dak-nong', label: 'Đắk Nông', icon: '🌳' }
        ],
        0: [ // Chủ nhật
          { value: 'kon-tum', label: 'Kon Tum', icon: '🏔️' },
          { value: 'khanh-hoa', label: 'Khánh Hòa', icon: '🏝️' },
          { value: 'thua-thien-hue', label: 'Thừa Thiên Huế', icon: '🏛️' }
        ]
      },
      north: {
        1: [ // Thứ 2 (MON)
          { value: 'ha-noi', label: 'Hà Nội', icon: '🏛️' }
        ],
        2: [ // Thứ 3 (TUE)
          { value: 'quang-ninh', label: 'Quảng Ninh', icon: '⛰️' }
        ],
        3: [ // Thứ 4 (WED)
          { value: 'bac-ninh', label: 'Bắc Ninh', icon: '🏭' }
        ],
        4: [ // Thứ 5 (THU)
          { value: 'ha-noi', label: 'Hà Nội', icon: '🏛️' }
        ],
        5: [ // Thứ 6 (FRI)
          { value: 'hai-phong', label: 'Hải Phòng', icon: '⚓' }
        ],
        6: [ // Thứ 7 (SAT)
          { value: 'nam-dinh', label: 'Nam Định', icon: '🌾' }
        ],
        0: [ // Chủ nhật (SUN)
          { value: 'thai-binh', label: 'Thái Bình', icon: '🌾' }
        ]
      }
    };

    // Đối với ONE789 miền Bắc, có cả MB1 và MB2
    if (form.websiteType === 'one789') {
      if (form.region === 'north1') {
        return [
          { value: 'mb1', label: 'MB1', icon: '🏛️' }
        ];
      } else if (form.region === 'north2') {
        return [
          { value: 'mb2', label: 'MB2', icon: '🏮' }
        ];
      }
    }

    return stationsByDay[form.region as 'south' | 'central' | 'north']?.[dayOfWeek] || [];
  };

  // Hàm lấy danh sách miền theo website
  const getRegions = () => {
    if (form.websiteType === 'one789') {
      return [
        { value: 'south', label: 'Miền Nam', color: 'bg-orange-500', icon: '🌴' },
        { value: 'north1', label: 'Miền Bắc 1', color: 'bg-blue-500', icon: '🏛️' },
        { value: 'north2', label: 'Miền Bắc 2', color: 'bg-indigo-500', icon: '🏮' }
      ];
    } else {
      return [
        { value: 'south', label: 'Miền Nam', color: 'bg-orange-500', icon: '🌴' },
        { value: 'central', label: 'Miền Trung', color: 'bg-green-500', icon: '🏔️' },
        { value: 'north', label: 'Miền Bắc', color: 'bg-blue-500', icon: '🏛️' }
      ];
    }
  };

  const getBetTypeMultiplier = (betType: string, numberCount: number): number => {
    switch (betType) {
      case 'bao-lo': // ALL_LOT
        return 18;
      
      case 'dau-duoi': // FIRST_LAST
        return 2;
      
      case 'da': // KICK_STRAIGHT
        return 18 * (numberCount - 1);
      
      case '7-lo': // SEVEN_LOT
      case '7-lo-dau': // SEVEN_LOT_FIRST
      case '7-lo-duoi': // SEVEN_LOT_LAST
      case '7-lo-giua': // SEVEN_LOT_BETWEEN
        return 7;
      
      // Các loại còn lại
      case 'duoi': // LAST
      case 'dau': // FIRST
      case 'giai-7': // PRIZE_SEVEN
      case 'giai-6': // PRIZE_SIX
      case 'giai-5': // PRIZE_FIVE
      case 'giai-4': // PRIZE_FOUR
      case 'giai-3': // PRIZE_THREE
      case 'giai-2': // PRIZE_TWO
      case 'giai-1': // PRIZE_ONE
      default:
        return 1;
    }
  };

  // Hàm tính tổng điểm chính xác
  const calculateTotalStake = (): number => {
    const numberCount = getNumberCount();
    const channelCount = form.stations.length || 1;
    
    if (form.websiteType === 'sgd666') {
      const multiplier = getBetTypeMultiplier(form.betType, numberCount);
      return numberCount * form.points * multiplier * channelCount;
    } else if (form.websiteType === 'one789') {
      // ONE789 có thể có logic khác, hiện tại dùng công thức đơn giản
      return numberCount * form.points * channelCount;
    }
    
    return numberCount * form.points;
  };

  // Thêm state cho số tài khoản active
  const [activeAccountsCount, setActiveAccountsCount] = useState<number>(0);

  // Thêm state cho số tài khoản chạy
  const [runningAccountsCount, setRunningAccountsCount] = useState<number>(0);

  // Hàm lấy số tài khoản active từ database
  const loadActiveAccountsCount = async (websiteType?: string) => {
    try {
      const accounts: Account[] = await accountAPI.getAll();
      const filteredAccounts = websiteType 
        ? accounts.filter(account => account.websiteType === websiteType && account.status === 'active')
        : accounts.filter(account => account.status === 'active');
      setActiveAccountsCount(filteredAccounts.length);
    } catch (error) {
      console.error('Error loading active accounts count:', error);
      setActiveAccountsCount(0);
    }
  };

  // Load dữ liệu khi component mount
  useEffect(() => {
    loadActiveAccountsCount(form.websiteType);
  }, [form.websiteType]);

  // Set giá trị mặc định bằng số tài khoản active tối đa
  useEffect(() => {
    setRunningAccountsCount(activeAccountsCount);
  }, [activeAccountsCount]);

  // Reset stations khi thay đổi website hoặc miền
  useEffect(() => {
    // Nếu chọn ONE789 và đang ở miền trung, chuyển về miền nam
    if (form.websiteType === 'one789' && form.region === 'central') {
      setForm(prev => ({ 
        ...prev, 
        region: 'south',
        stations: [], 
        betType: getBetTypes()[0]?.value || '' 
      }));
    } else if (form.websiteType === 'sgd666' && (form.region === 'north1' || form.region === 'north2')) {
      // Nếu chọn SGD666 và đang ở miền bắc 1 hoặc 2, chuyển về miền nam
      setForm(prev => ({ 
        ...prev, 
        region: 'south',
        stations: [], 
        betType: getBetTypes()[0]?.value || '' 
      }));
    } else {
      setForm(prev => ({ ...prev, stations: [], betType: getBetTypes()[0]?.value || '' }));
    }
  }, [form.websiteType, form.region]);

  // Hàm tự động format số (thêm số 0 phía trước nếu cần) - chỉ dùng khi submit
  const formatNumbers = (input: string): string => {
    if (!input.trim()) {
      return '';
    }
    
    // Tách các số bằng dấu cách, phẩy hoặc xuống dòng
    const numbers = input.split(/[,\s\n]+/).filter(n => n.trim().length > 0);
    
    const formattedNumbers = numbers.map(num => {
      const cleanNum = num.trim();
      
      // Chỉ xử lý nếu là số hợp lệ (chỉ chứa chữ số)
      if (!/^\d+$/.test(cleanNum)) {
        return cleanNum; // Giữ nguyên nếu không phải số thuần
      }
      
      const numValue = parseInt(cleanNum);
      
      // Kiểm tra giá trị hợp lệ trước khi format
      if (isNaN(numValue) || numValue < 0) {
        return cleanNum; // Giữ nguyên nếu không hợp lệ
      }
      
      if (form.websiteType === 'sgd666') {
        // SGD666: 2 chữ số (00-99)
        if (numValue <= 99) {
          return numValue.toString().padStart(2, '0');
        }
      } else if (form.websiteType === 'one789') {
        const is3D = form.betType.includes('3d');
        if (is3D) {
          // ONE789 3D: 3 chữ số (000-999)
          if (numValue <= 999) {
            return numValue.toString().padStart(3, '0');
          }
        } else {
          // ONE789 2D: 2 chữ số (00-99)
          if (numValue <= 99) {
            return numValue.toString().padStart(2, '0');
          }
        }
      } else {
        // Mặc định: 2 chữ số (00-99)
        if (numValue <= 99) {
          return numValue.toString().padStart(2, '0');
        }
      }
      
      return cleanNum; // Giữ nguyên nếu vượt quá giới hạn
    });
    
    return formattedNumbers.join(' ');
  };

  // Hàm validate số theo loại website và bet type
  const validateNumbers = (numbers: string): boolean => {
    const cleanNumbers = numbers.replace(/[,\s]+/g, ' ').trim();
    const numberArray = cleanNumbers.split(' ').filter(n => n.length > 0);
    
    if (numberArray.length === 0) {
      return false;
    }
    
    if (form.websiteType === 'sgd666') {
      // SGD666: cho phép số lượng không giới hạn, chấp nhận 1-2 chữ số (0-99)
      return numberArray.every(num => {
        const numValue = parseInt(num);
        return /^\d{1,2}$/.test(num) && !isNaN(numValue) && numValue >= 0 && numValue <= 99;
      });
    } else if (form.websiteType === 'one789') {
      // ONE789: 2D = 1-2 chữ số, 3D = 1-3 chữ số
      const is3D = form.betType.includes('3d');
      if (is3D) {
        return numberArray.every(num => {
          const numValue = parseInt(num);
          return /^\d{1,3}$/.test(num) && !isNaN(numValue) && numValue >= 0 && numValue <= 999;
        });
      } else {
        return numberArray.every(num => {
          const numValue = parseInt(num);
          return /^\d{1,2}$/.test(num) && !isNaN(numValue) && numValue >= 0 && numValue <= 99;
        });
      }
    }
    
    // Mặc định: chấp nhận 1-2 chữ số (0-99)
    return numberArray.every(num => {
      const numValue = parseInt(num);
      return /^\d{1,2}$/.test(num) && !isNaN(numValue) && numValue >= 0 && numValue <= 99;
    });
  };

  // Đếm số lượng số đã nhập
  const getNumberCount = (): number => {
    const cleanNumbers = form.numbers.replace(/[,\s]+/g, ' ').trim();
    return cleanNumbers ? cleanNumbers.split(' ').filter(n => n.length > 0).length : 0;
  };

  // Hàm lấy placeholder cho input số
  const getNumberPlaceholder = (): string => {
    if (form.websiteType === 'sgd666') {
      return 'Nhập các số 0-99. VD: 4 12 34';
    } else if (form.websiteType === 'one789') {
      const is3D = form.betType.includes('3d');
      if (is3D) {
        return 'Nhập các số 0-999. VD: 4 123 456';
      } else {
        return 'Nhập các số 0-99. VD: 4 12 34';
      }
    }
    return 'Nhập các số 0-99, cách nhau bởi dấu cách hoặc dấu phẩy. VD: 4 12 34, 56 78';
  };
  
  // Hàm lấy mô tả định dạng số
  const getNumberFormatDescription = (): string => {
    if (form.websiteType === 'sgd666') {
      return 'Định dạng: Các số 0-99';
    } else if (form.websiteType === 'one789') {
      const is3D = form.betType.includes('3d');
      if (is3D) {
        return 'Định dạng: Các số 0-999';
      } else {
        return 'Định dạng: Các số 0-99';
      }
    }
    return 'Định dạng: Các số 0-99';
  };

  // Thêm hàm scroll đến element có lỗi
  const scrollToError = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      // Thêm hiệu ứng highlight
      element.classList.add('ring-2', 'ring-red-500', 'ring-opacity-50');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-red-500', 'ring-opacity-50');
      }, 2000);
    }
  };

  // Xử lý submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Validate form
      if (form.points <= 0) {
        setNotification({ type: 'error', message: '❌ Vui lòng nhập điểm cần đánh!' });
        scrollToError('points-input');
        return;
      }
      
      if (!form.numbers.trim()) {
        setNotification({ type: 'error', message: '❌ Vui lòng nhập các đầu số!' });
        scrollToError('numbers-input');
        return;
      }
      
      if (!validateNumbers(form.numbers)) {
        let errorMessage = '❌ Định dạng số không hợp lệ!';
        if (form.websiteType === 'sgd666') {
          errorMessage += ' SGD666 chỉ cho phép nhập các số từ 0-99.';
        } else if (form.websiteType === 'one789') {
          const is3D = form.betType.includes('3d');
          errorMessage += is3D 
            ? ' Vui lòng nhập các số từ 0-999.'
            : ' Vui lòng nhập các số từ 0-99.';
        }
        setNotification({ type: 'error', message: errorMessage });
        scrollToError('numbers-input');
        return;
      }
      
      if (form.stations.length === 0) {
        setNotification({ type: 'error', message: '❌ Vui lòng chọn ít nhất một đài!' });
        scrollToError('station-section');
        return;
      }
      
      if (runningAccountsCount <= 0 || runningAccountsCount > activeAccountsCount) {
        setNotification({ type: 'error', message: '❌ Số tài khoản chạy không hợp lệ!' });
        return;
      }
      
      // Format các số trước khi gửi
      const formattedNumbers = formatNumbers(form.numbers);
      
      // Chuẩn bị dữ liệu gửi đến API
      const submitData = {
        ...form,
        numbers: formattedNumbers, // Sử dụng số đã được format
        runningAccountsCount,
        totalAmount: calculateTotalStake(),
        numbersArray: formattedNumbers.replace(/[,\s]+/g, ' ').trim().split(' ').filter(n => n.length > 0),
        timestamp: new Date().toISOString()
      };
      
      // Gửi request đến API betting
      const response = await api.post('/betting/submit', submitData);
      
      if (response.data.success) {
        const summary = response.data.data?.summary;
        const details = response.data.data?.details;

        if (summary && summary.failed > 0 && details && Array.isArray(details)) {
          const failedAccounts = details.filter(detail => !detail.success);
          const uniqueErrors = [...new Set(failedAccounts.map(detail => detail.details?.error))];
          let errorMessage = `⚠️ Thành công: ${summary.success}/${summary.total}`;
          if (uniqueErrors.length === 1) {
            // Chỉ có 1 loại lỗi
            errorMessage += `. Lỗi: ${uniqueErrors[0]}`;
            if (summary.failed > 1) {
              errorMessage += ` (${summary.failed} tài khoản)`;
            }
          } else {
            // Có nhiều loại lỗi khác nhau
            errorMessage += `. ${summary.failed} tài khoản lỗi - Click để xem chi tiết`;
          }

          setNotification({ 
            type: 'error', 
            message: errorMessage,
            details: failedAccounts.map(detail => ({
              username: detail.username,
              error: detail.details?.error
            }))
          });
        } else {
          setNotification({ 
            type: 'success', 
            message: `✅ ${response.data.message}. Thành công: ${summary?.success || 0}/${summary?.total || 0}` 
          });
        }
        // Reset form
        // setForm({
        //   points: 0,
        //   numbers: '',
        //   distributionType: 'equal',
        //   betType: getBetTypes()[0]?.value || '',
        //   region: 'south',
        //   stations: [],
        //   websiteType: form.websiteType
        // });
        setRunningAccountsCount(activeAccountsCount);
      } else {
        let errorMessage = response.data.message || 'Có lỗi xảy ra';
        let errorDetails: { username: string; error: string }[] | undefined = undefined;
        
        // Kiểm tra nếu có chi tiết lỗi trong data
        if (response.data.data && response.data.data.details) {
          const details = response.data.data.details;
          
          // Nếu có lỗi từ từng tài khoản
          if (Array.isArray(details)) {
            const failedAccounts = details.filter(detail => detail.details?.error);
            if (failedAccounts.length > 0) {
              errorDetails = failedAccounts.map(detail => ({
                username: detail.username,
                error: detail.details.error
              }));
              errorMessage += ` (${failedAccounts.length} tài khoản lỗi)`;
            }
          }
        }
        
        setNotification({ 
          type: 'error', 
          message: `❌ ${errorMessage}`,
          details: errorDetails
        });
      }
      
      // Tự động tắt thông báo sau 6 giây
      setTimeout(() => {
        setNotification(null);
      }, 14000);
      
    } catch (error) {
      console.error('Submit error:', error);
      setNotification({ type: 'error', message: '❌ Có lỗi xảy ra, vui lòng thử lại!' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const betTypes = getBetTypes();
  const availableStations = getStationsByDay();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-[60] max-w-md transition-all duration-300 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-500 text-green-800' 
              : notification.type === 'error'
              ? 'bg-red-50 border-red-500 text-red-800'
              : 'bg-blue-50 border-blue-500 text-blue-800'
          } p-4 rounded-lg shadow-lg border-l-4`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium mb-1">{notification.message}</div>
                
                {/* Chi tiết lỗi có thể mở rộng */}
                {notification.details && notification.details.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                      Chi tiết lỗi ({notification.details.length} tài khoản)
                    </summary>
                    <div className="mt-2 pl-4 border-l-2 border-gray-200">
                      {notification.details.map((detail, index) => (
                        <div key={index} className="text-xs py-1">
                          <span className="font-medium">{detail.username}:</span> {detail.error}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="ml-4 text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form chính */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-6">
              {/* Header form */}
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-1">📝 Thông tin lệnh đánh</h2>
                <p className="text-sm text-gray-600">Điền đầy đủ thông tin để thực hiện lệnh đánh</p>
              </div>

              {/* Chọn loại website */}
              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {websiteTypes.map((website) => (
                    <div 
                      key={website.value}
                      onClick={() => setForm(prev => ({ ...prev, websiteType: website.value, stations: [], betType: '' }))}
                      className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${
                        form.websiteType === website.value 
                          ? (website.value === 'sgd666' 
                              ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 text-white shadow-xl ring-4 ring-yellow-300 ring-opacity-50' 
                              : 'bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 text-white shadow-xl ring-4 ring-purple-300 ring-opacity-50'
                            )
                          : 'bg-white hover:bg-gray-50 shadow-lg border-2 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Hiệu ứng shine khi được chọn */}
                      {form.websiteType === website.value && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-pulse rounded-2xl"></div>
                      )}
                      
                      <div className="relative z-10 flex flex-col items-center text-center">
                        <div className={`mb-3 ${
                          form.websiteType === website.value ? 'animate-bounce' : ''
                        }`}>
                          <img 
                            src={website.icon} 
                            alt={website.label}
                            className="w-16 h-16 mx-auto object-contain"
                          />
                        </div>
                        <div className={`font-bold text-xl mb-2 ${
                          form.websiteType === website.value ? 'text-white' : 'text-gray-800'
                        }`}>
                          {website.label}
                        </div>
                        
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Điểm cần đánh */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg">
                <label className="block text-base font-semibold text-gray-800 mb-2">
                  💰 Điểm cần đánh
                </label>
                <div className="relative">
                  <input
                    id="points-input"
                    type="number"
                    min="1"
                    value={form.points || ''}
                    onChange={(e) => setForm({...form, points: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                    placeholder="Nhập số điểm"
                  />
                  <div className="absolute right-3 top-2 text-gray-400">đ</div>
                </div>
              </div>

              {/* Các đầu số */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                <label className="block text-base font-semibold text-gray-800 mb-2">
                  🔢 Các đầu số ({getNumberCount()} số)
                </label>
                <textarea
                  id="numbers-input"
                  value={form.numbers}
                  onChange={(e) => setForm({...form, numbers: e.target.value})}
                  className="w-full px-3 py-2 text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500 transition-all h-24 resize-none"
                  placeholder={getNumberPlaceholder()}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    {getNumberFormatDescription()}
                  </p>
                  <span className={`text-xs font-medium ${
                    getNumberCount() > 0 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {getNumberCount()} số đã nhập
                  </span>
                </div>
              </div>

              {/* Loại chia */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg">
                <label className="block text-base font-semibold text-gray-800 mb-3">
                  📊 Loại chia số
                </label>
                <div className="grid md:grid-cols-3 gap-3">
                  <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    form.distributionType === 'equal' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="distributionType"
                      value="equal"
                      checked={form.distributionType === 'equal'}
                      onChange={(e) => setForm({...form, distributionType: e.target.value as 'equal' | 'random' | 'all'})}
                      className="sr-only"
                    />
                    <div className="text-center w-full">
                      <div className="text-xl mb-1">⚖️</div>
                      <div className="font-medium text-sm">Chia đều</div>
                      <div className="text-xs text-gray-500">Theo số tài khoản</div>
                    </div>
                  </label>
                  
                  <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    form.distributionType === 'random' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="distributionType"
                      value="random"
                      checked={form.distributionType === 'random'}
                      onChange={(e) => setForm({...form, distributionType: e.target.value as 'equal' | 'random' | 'all'})}
                      className="sr-only"
                    />
                    <div className="text-center w-full">
                      <div className="text-xl mb-1">🎲</div>
                      <div className="font-medium text-sm">Ngẫu nhiên</div>
                      <div className="text-xs text-gray-500">Chia tự động</div>
                    </div>
                  </label>
                  
                  <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    form.distributionType === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="distributionType"
                      value="all"
                      checked={form.distributionType === 'all'}
                      onChange={(e) => setForm({...form, distributionType: e.target.value as 'equal' | 'random' | 'all'})}
                      className="sr-only"
                    />
                    <div className="text-center w-full">
                      <div className="text-xl mb-1">👥</div>
                      <div className="font-medium text-sm">Tất cả</div>
                      <div className="text-xs text-gray-500">Giống nhau</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Miền */}
              <div className="bg-gradient-to-r from-teal-50 to-green-50 p-4 rounded-lg">
                <label className="block text-base font-semibold text-gray-800 mb-3">
                  🗺️ Chọn miền
                </label>
                <div className="grid md:grid-cols-3 gap-3">
                  {getRegions().map(region => {
                    const isDisabled = form.websiteType === 'one789' && region.value === 'central';
                    return (
                      <label key={region.value} className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isDisabled 
                          ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                          : form.region === region.value 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="region"
                          value={region.value}
                          checked={form.region === region.value}
                          disabled={isDisabled}
                          onChange={(e) => {
                            setForm({...form, region: e.target.value as 'south' | 'central' | 'north', stations: []});
                          }}
                          className="sr-only"
                        />
                        <div className="text-center w-full">
                          <div className="text-xl mb-1">{region.icon}</div>
                          <div className={`font-medium text-sm ${
                            isDisabled ? 'text-gray-400' : ''
                          }`}>{region.label}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Kiểu đánh */}
              {betTypes.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-lg">
                  <label className="block text-base font-semibold text-gray-800 mb-2">
                    🎲 Kiểu đánh
                  </label>
                  <select
                    value={form.betType}
                    onChange={(e) => setForm({...form, betType: e.target.value})}
                    className="w-full px-3 py-2 text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-all"
                  >
                    <option value="">Chọn kiểu đánh</option>
                    {betTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Đài */}
              {availableStations.length > 0 && (
                <div id="station-section" className="bg-gradient-to-r from-rose-50 to-pink-50 p-4 rounded-lg">
                  <label className="block text-base font-semibold text-gray-800 mb-3">
                    📻 Chọn đài ({form.stations.length} đài)
                  </label>
                  <div className="grid md:grid-cols-2 gap-2">
                    {availableStations.map(station => (
                      <label key={station.value} className={`flex items-center p-2 rounded-lg border-2 cursor-pointer transition-all ${
                        station.disabled 
                          ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                          : form.stations.includes(station.value) 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          value={station.value}
                          checked={form.stations.includes(station.value)}
                          disabled={station.disabled}
                          onChange={(e) => {
                            const stationValue = e.target.value;
                            if (e.target.checked) {
                              // Thêm đài vào danh sách
                              setForm({...form, stations: [...form.stations, stationValue]});
                            } else {
                              // Xóa đài khỏi danh sách
                              setForm({...form, stations: form.stations.filter(s => s !== stationValue)});
                            }
                          }}
                          className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex items-center w-full">
                          <span className="text-lg mr-2">{station.icon}</span>
                          <span className={`font-medium text-sm ${
                            station.disabled ? 'text-gray-400' : ''
                          }`}>{station.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3 px-6 rounded-lg font-bold text-base transition-all transform ${
                    isSubmitting 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:scale-105 shadow-lg hover:shadow-xl'
                  } text-white`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </div>
                  ) : (
                    '🚀 Thực hiện lệnh đánh'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar thông tin */}
          <div className="space-y-4 sticky top-8 self-start">
            {/* Thống kê nhanh */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                📊 Thống kê nhanh
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-orange-50 rounded-lg">
                  <span className="text-gray-700 text-sm">Website:</span>
                  <span className="font-bold text-orange-600">
                    {websiteTypes.find(w => w.value === form.websiteType)?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-indigo-50 rounded-lg">
                  <span className="text-gray-700 text-sm">Kiểu đánh:</span>
                  <span className="font-bold text-indigo-600">
                    {betTypes.find(bt => bt.value === form.betType)?.label || 'Chưa chọn'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg">
                  <span className="text-gray-700 text-sm">Số lượng số:</span>
                  <span className="font-bold text-blue-600">{getNumberCount()}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                  <span className="text-gray-700 text-sm">Tổng điểm:</span>
                  <span className="font-bold text-green-600">{calculateTotalStake().toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between items-start p-2 bg-purple-50 rounded-lg">
                  <span className="text-gray-700 text-sm">Đài:</span>
                  <div className="font-bold text-purple-600 flex-1 ml-2">
                    {form.stations.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {form.stations.map((stationValue, index) => (
                          <span 
                            key={index}
                            className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full"
                          >
                            {availableStations.find(s => s.value === stationValue)?.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-right block">Chưa chọn</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Cấu hình tài khoản */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                🔧 Cấu hình tài khoản
              </h3>
              <div className="space-y-3">
                {/* Số tài khoản chạy */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 text-sm font-medium">Số tài khoản chạy:</span>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      min="1"
                      max={activeAccountsCount}
                      value={runningAccountsCount}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 1 && value <= activeAccountsCount) {
                          setRunningAccountsCount(value);
                        }
                      }}
                      className="w-12 h-7 px-1 text-xs text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-gray-50 hover:bg-white transition-colors"
                    />
                    <span className="text-gray-400 text-xs">/</span>
                    <span className="text-gray-600 text-xs font-medium">{activeAccountsCount}</span>
                    <button
                      type="button"
                      onClick={() => setRunningAccountsCount(activeAccountsCount)}
                      className="ml-1.5 px-2.5 py-1 text-xs font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95"
                      title="Sử dụng tất cả tài khoản"
                    >
                      Tối đa
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hướng dẫn */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                💡 Hướng dẫn nhanh
              </h3>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span><strong>Điểm:</strong> Số điểm đánh cho mỗi số</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span><strong>Số:</strong> 
                    {form.websiteType === 'sgd666' && ' SGD666: Đúng 2 số 2 chữ số'}
                    {form.websiteType === 'one789' && ' ONE789: 2D (2 số) hoặc 3D (3 số)'}
                  </span>
                </div>
                <div className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  <span><strong>Chia đều:</strong> Số được chia đều cho tài khoản</span>
                </div>
                <div className="flex items-start">
                  <span className="text-orange-500 mr-2">•</span>
                  <span><strong>Ngẫu nhiên:</strong> Chia số ngẫu nhiên</span>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  <span><strong>Tất cả:</strong> Mọi tài khoản đánh giống nhau</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;