import React, { useState, useEffect } from 'react';
import { betHistoryAPI } from '../services/api';
import type { BetHistoryItem, BettingStats, DateFilter, AccountDetailData } from '../types/betting';

const BettingStatsPage: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 ngày trước
    endDate: new Date().toISOString().split('T')[0] // hôm nay
  });
  
  const [selectedWebsite, setSelectedWebsite] = useState<'all' | 'sgd666' | 'one789'>('all');
  const [selectedResult, setSelectedResult] = useState<'all' | 'win' | 'lose' | 'pending'>('all');
  const [selectedRegion, setSelectedRegion] = useState<'all' | 'south' | 'central' | 'north'>('all');
  const [selectedBetType, setSelectedBetType] = useState<'all' | string>('all');
  const [selectedAccount, setSelectedAccount] = useState<'all' | string>('all');

  const [betHistories, setBetHistories] = useState<BetHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20
  });
  
  // Helper functions để kiểm tra số và kênh thắng
  const isWinningNumber = (number: string, bet: BetHistoryItem): boolean => {
    return bet.result?.winningNumbers?.includes(number) || false;
  };

  // Map station từ frontend format sang backend format để so sánh với channelResults
  const mapStationToBackend = (frontendStation: string): string => {
    const stationMapping: Record<string, string> = {
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

    return stationMapping[frontendStation] || frontendStation.toLowerCase();
  };

  const isWinningChannel = (station: { value: string; label: string }, bet: BetHistoryItem): boolean => {
    if (!bet.result?.channelResults) return false;
    const backendStationKey = mapStationToBackend(station.value);
    return bet.result.channelResults[backendStationKey]?.status === 'WIN';
  };

  // Fetch dữ liệu từ API
  const fetchBetHistory = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        websiteType: selectedWebsite !== 'all' ? selectedWebsite : undefined,
        region: selectedRegion !== 'all' ? selectedRegion : undefined,
        betType: selectedBetType !== 'all' ? selectedBetType : undefined,
        page,
        limit: 20
      };

      const response = await betHistoryAPI.getHistory(filters);

      if (response.success) {
        setBetHistories(response.data.betHistories);
        setPagination(response.data.pagination);
      } else {
        setError('Không thể tải dữ liệu lịch sử cược');
      }
    } catch (err) {
      console.error('Error fetching bet history:', err);
      setError('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dữ liệu khi component mount hoặc filters thay đổi
  useEffect(() => {
    fetchBetHistory(1);
  }, [dateFilter, selectedWebsite, selectedRegion, selectedBetType]);

  // Reset account filter khi dữ liệu thay đổi
  useEffect(() => {
    setSelectedAccount('all');
  }, [betHistories]);

  // Lấy danh sách tài khoản duy nhất từ dữ liệu thực
  const uniqueAccounts = Array.from(
    new Set(
      betHistories.flatMap(bet => 
        bet.accountsUsed.map(account => `${account.username} (${bet.websiteType.toUpperCase()})`)
      )
    )
  ).sort();

  // Lọc dữ liệu theo kết quả ở frontend (vì backend chưa hỗ trợ)
  const filteredBetHistories = betHistories.filter(bet => {
    if (selectedResult === 'all') return true;
    
    if (selectedResult === 'pending') {
      return !bet.result?.isChecked;
    } else if (selectedResult === 'win') {
      return bet.result?.isChecked && bet.result?.totalWinAmount > 0;
    } else if (selectedResult === 'lose') {
      return bet.result?.isChecked && bet.result?.totalWinAmount <= 0;
    }
    
    return true;
  }).filter(bet => {
    // Thêm filter theo tài khoản với website
    if (selectedAccount === 'all') return true;
    
    // Tách tên tài khoản và website từ selectedAccount
    const accountMatch = selectedAccount.match(/^(.+) \((.+)\)$/);
    if (accountMatch) {
      const [, accountName, website] = accountMatch;
      return bet.websiteType.toUpperCase() === website && 
             bet.accountsUsed.some(account => account.username === accountName);
    }
    
    return false;
  });

  // Tính toán thống kê từ dữ liệu đã lọc - SỬA LẠI LOGIC
  const calculateStats = (): BettingStats => {
    const totalBets = filteredBetHistories.length;
    const totalPoints = filteredBetHistories.reduce((sum, bet) => sum + bet.totalStake, 0);
    
    // Tính tổng thắng và thua dựa trên totalWinAmount
    let totalWin = 0;
    let totalLoss = 0;
    
    filteredBetHistories.forEach(bet => {
      if (bet.result?.isChecked) {
        const winAmount = bet.result.totalWinAmount || 0;
        if (winAmount > 0) {
          totalWin += winAmount;
        } else {
          // Khi thua, totalWinAmount có thể là 0 hoặc âm
          // totalLoss là số tiền đã cược bị mất
          totalLoss += bet.totalStake;
        }
      }
    });
    
    const profit = totalWin - totalLoss;
    const completedBets = filteredBetHistories.filter(bet => bet.result?.isChecked).length;
    const wonBets = filteredBetHistories.filter(bet => bet.result?.isChecked && bet.result?.totalWinAmount > 0).length;
    const winRate = completedBets > 0 ? (wonBets / completedBets) * 100 : 0;
    const avgPointsPerBet = totalBets > 0 ? totalPoints / totalBets : 0;
    const totalNumbers = filteredBetHistories.reduce((sum, bet) => sum + bet.numbers.length, 0);

    return {
      totalBets,
      totalPoints,
      totalWin,
      totalLoss,
      profit,
      winRate,
      avgPointsPerBet,
      totalNumbers
    };
  };

  // Tạo dữ liệu chi tiết theo tài khoản và số
  const getAccountDetailData = () => {
    if (selectedAccount === 'all') {
      // Trả về dữ liệu order với cấu trúc chuẩn
      return filteredBetHistories.map(bet => ({
        ...bet,
        // Đảm bảo có các thuộc tính cần thiết cho hiển thị
        isAccountView: false
      }));
    }

    // Tách tên tài khoản và website từ selectedAccount
    const accountMatch = selectedAccount.match(/^(.+) \((.+)\)$/);
    if (!accountMatch) return [];

    const [, accountName, website] = accountMatch;
    const accountDetails: AccountDetailData[] = [];

    filteredBetHistories.forEach(bet => {
      if (bet.websiteType.toUpperCase() !== website) return;
      
      const account = bet.accountsUsed.find(acc => acc.username === accountName);
      if (!account) return;

      // Lấy kết quả của tài khoản này
      const accountResult = bet.result?.accountResults?.find(
        result => result.accountUsername === accountName
      );

      // Tạo một dòng cho mỗi số mà tài khoản này đã đánh
      account.numbersAssigned?.forEach(number => {
        const isWinning = bet.result?.winningNumbers?.includes(number) || false;
        // SỬA: Sử dụng winLoss thay vì winAmount
        const numberWinAmount = accountResult?.winDetails?.find(
          detail => detail.numbers?.includes(number)
        )?.winLoss || 0;

        accountDetails.push({
          _id: `${bet._id}_${accountName}_${number}`,
          orderCode: bet.orderCode,
          websiteType: bet.websiteType,
          betType: bet.betType,
          betTypeDisplay: bet.betTypeDisplay,
          region: bet.region,
          stations: bet.stations,
          number: number, // Số cụ thể
          numbers: [number], // Để tương thích với hiển thị
          points: bet.points,
          stakeAmount: account.stakeAmount / account.numbersAssigned.length, // Chia đều điểm cho mỗi số
          totalStake: account.stakeAmount / account.numbersAssigned.length, // Để tương thích
          accountUsername: accountName,
          accountsUsed: [account], // Để tương thích
          successfulBets: 1,
          totalAccountsUsed: 1,
          betStatus: account.betStatus,
          isWinning: isWinning,
          winAmount: numberWinAmount, // Sử dụng winLoss từ winDetails
          betDate: bet.betDate,
          createdAt: bet.createdAt,
          result: bet.result,
          isAccountView: true
        });
      });
    });

    return accountDetails;
  };

  const isAccountView = selectedAccount !== 'all';

  const displayData: (BetHistoryItem | AccountDetailData)[] = isAccountView 
    ? getAccountDetailData() 
    : filteredBetHistories;

  // Tính toán thống kê cho view tài khoản - SỬA LẠI LOGIC TÍNH TỔNG
  const calculateAccountStats = () => {
    if (!isAccountView) return calculateStats();

    // Tách tên tài khoản và website từ selectedAccount
    const accountMatch = selectedAccount.match(/^(.+) \((.+)\)$/);
    if (!accountMatch) return calculateStats();

    const [, accountName, website] = accountMatch;
    
    // Lọc các bet của tài khoản cụ thể
    const accountBets = filteredBetHistories.filter(bet => 
      bet.websiteType.toUpperCase() === website && 
      bet.accountsUsed.some(account => account.username === accountName)
    );

    let totalBets = 0; // Tổng số lần đánh (số lượng số)
    let totalPoints = 0; // Tổng điểm cược
    let totalWin = 0; // Tổng tiền thắng
    let totalLoss = 0; // Tổng tiền thua
    let wonNumbers = 0; // Số lượng số thắng
    let completedNumbers = 0; // Số lượng số đã có kết quả

    accountBets.forEach(bet => {
      const account = bet.accountsUsed.find(acc => acc.username === accountName);
      if (!account || !account.numbersAssigned) return;

      // Lấy kết quả của tài khoản này từ accountResults
      const accountResult = bet.result?.accountResults?.find(
        result => result.accountUsername === accountName
      );

      if (!accountResult || !bet.result?.isChecked) {
        // Nếu chưa có kết quả, chỉ tính số lượng và điểm cược
        const numbersCount = account.numbersAssigned.length;
        totalBets += numbersCount;
        const stakePerNumber = account.stakeAmount / numbersCount;
        totalPoints += stakePerNumber * numbersCount;
        return;
      }

      // Sử dụng winDetails từ accountResult để tính toán chính xác
      if (accountResult.winDetails && Array.isArray(accountResult.winDetails)) {
        accountResult.winDetails.forEach(detail => {
          if (detail.numbers && Array.isArray(detail.numbers)) {
            detail.numbers.forEach((number: string) => {
              // Kiểm tra xem số này có trong numbersAssigned của account không
              if (account.numbersAssigned.includes(number)) {
                totalBets++;
                completedNumbers++;
                
                // Tính stake cho số này dựa trên winDetails
                const stakeForThisNumber = detail.stake || (account.stakeAmount / account.numbersAssigned.length);
                totalPoints += stakeForThisNumber;

                if (detail.status === 'WIN' && detail.winLoss > 0) {
                  wonNumbers++;
                  // winLoss đã là số tiền thắng ròng (đã trừ tiền cược)
                  totalWin += detail.winLoss;
                } else {
                  // Khi thua, trừ số tiền đã cược
                  totalLoss += stakeForThisNumber;
                }
              }
            });
          }
        });
      } else {
        // Fallback: nếu không có winDetails, dùng logic cũ
        account.numbersAssigned.forEach(number => {
          totalBets++;
          const stakePerNumber = account.stakeAmount / account.numbersAssigned.length;
          totalPoints += stakePerNumber;

          if (bet.result?.isChecked) {
            completedNumbers++;
            const isWinning = bet.result?.winningNumbers?.includes(number) || false;
            
            if (isWinning) {
              wonNumbers++;
              // Tìm số tiền thắng cho số này từ winDetails
              const numberWinAmount = accountResult?.winDetails?.find(
                detail => detail.numbers?.includes(number)
              )?.winLoss || 0;
              totalWin += numberWinAmount;
            } else {
              totalLoss += stakePerNumber;
            }
          }
        });
      }
    });

    const profit = totalWin - totalLoss;
    const winRate = completedNumbers > 0 ? (wonNumbers / completedNumbers) * 100 : 0;
    const avgPointsPerNumber = totalBets > 0 ? totalPoints / totalBets : 0;

    return {
      totalBets, // Số lượng số đã đánh
      totalPoints, // Tổng điểm cược
      totalWin, // Tổng tiền thắng
      totalLoss, // Tổng tiền thua
      profit, // Lợi nhuận
      winRate, // Tỷ lệ thắng
      avgPointsPerBet: avgPointsPerNumber, // Điểm trung bình mỗi số
      totalNumbers: totalBets // Tổng số đã đánh
    };
  };

  const stats = isAccountView ? calculateAccountStats() : calculateStats();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const getBetTypeLabel = (betType: string) => {
    const betTypeLabels: Record<string, string> = {
      // Backend format (từ SGD666Utils mapping)
      'ALL_LOT': '🎯 Bao lô',
      'FIRST_LAST': '🔄 Đầu đuôi',
      'FIRST': '⬆️ Đầu',
      'LAST': '⬇️ Đuôi',
      'KICK_STRAIGHT': '💎 Đá',
      'SEVEN_LOT': '🎰 7 lô',
      'SEVEN_LOT_FIRST': '🎰⬆️ 7 lô đầu',
      'SEVEN_LOT_LAST': '🎰⬇️ 7 lô đuôi',
      'SEVEN_LOT_BETWEEN': '🎰🔄 7 lô giữa',
      'PRIZE_SEVEN': '🏆 Hạng 7',
      'PRIZE_SIX': '🥇 Hạng 6',
      'PRIZE_FIVE': '🥈 Hạng 5',
      'PRIZE_FOUR': '🥉 Hạng 4',
      'PRIZE_THREE': '🏅 Hạng 3',
      'PRIZE_TWO': '🎖️ Hạng 2',
      'PRIZE_ONE': '👑 Hạng 1',
      
      // Frontend format (từ Dashboard)
      'bao-lo': '🎯 Bao lô',
      'dau-duoi': '🔄 Đầu đuôi',
      'dau': '⬆️ Đầu',
      'duoi': '⬇️ Đuôi',
      'da': '💎 Đá',
      '7-lo': '🎰 7 lô',
      '7-lo-dau': '🎰⬆️ 7 lô đầu',
      '7-lo-duoi': '🎰⬇️ 7 lô đuôi',
      '7-lo-giua': '🎰🔄 7 lô giữa',
      'giai-7': '🏆 Hạng 7',
      'giai-6': '🥇 Hạng 6',
      'giai-5': '🥈 Hạng 5',
      'giai-4': '🥉 Hạng 4',
      'giai-3': '🏅 Hạng 3',
      'giai-2': '🎖️ Hạng 2',
      'giai-1': '👑 Hạng 1'
    };
    return betTypeLabels[betType] || betType;
  };

  const getRegionLabel = (region: string) => {
    const regionLabels: Record<string, string> = {
      'south': '🌴 Miền Nam',
      'central': '🏔️ Miền Trung',
      'north': '🏛️ Miền Bắc'
    };
    return regionLabels[region] || region;
  };

  // Lấy danh sách bet types duy nhất từ dữ liệu thực
  const uniqueBetTypes = Array.from(new Set(betHistories.map(bet => bet.betType)));

  

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-red-600 text-lg">{error}</p>
          <button 
            onClick={() => fetchBetHistory(1)}
            className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">🎰 Lịch sử cược</h1>
        <p className="text-gray-600 mt-2">Theo dõi và phân tích các lệnh cược đã thực hiện</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">🔍 Bộ lọc</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Website Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <select
              value={selectedWebsite}
              onChange={(e) => setSelectedWebsite(e.target.value as 'all' | 'sgd666' | 'one789')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="sgd666">SGD666</option>
              <option value="one789">ONE789</option>
            </select>
          </div>

          {/* Region Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Miền</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value as 'all' | 'south' | 'central' | 'north')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="south">🌴 Miền Nam</option>
              <option value="central">🏔️ Miền Trung</option>
              <option value="north">🏛️ Miền Bắc</option>
            </select>
          </div>

          {/* Bet Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kiểu đánh</label>
            <select
              value={selectedBetType}
              onChange={(e) => setSelectedBetType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              {uniqueBetTypes.map(betType => (
                <option key={betType} value={betType}>
                  {getBetTypeLabel(betType)}
                </option>
              ))}
            </select>
          </div>

          {/* Result Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kết quả</label>
            <select
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value as 'all' | 'win' | 'lose' | 'pending')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="pending">⏳ Chờ kết quả</option>
              <option value="win">🎉 Thắng</option>
              <option value="lose">😞 Thua</option>
            </select>
          </div>
          {/* Account Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tài khoản</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              {uniqueAccounts.map(account => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tổng số lệnh</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalBets}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tổng điểm cược</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPoints)}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <span className="text-2xl">🎯</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lợi nhuận</p>
              <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.profit >= 0 ? '+' : ''}{formatCurrency(stats.profit)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${stats.profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <span className="text-2xl">{stats.profit >= 0 ? '📈' : '📉'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tỷ lệ thắng</p>
              <p className="text-2xl font-bold text-gray-900">{stats.winRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <span className="text-2xl">🏆</span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Thống kê chi tiết</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Tổng tiền thắng:</span>
              <span className="font-semibold text-green-600">{formatCurrency(stats.totalWin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tổng tiền thua:</span>
              <span className="font-semibold text-red-600">{formatCurrency(stats.totalLoss)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Điểm trung bình/lệnh:</span>
              <span className="font-semibold">{formatCurrency(stats.avgPointsPerBet)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tổng số đã đánh:</span>
              <span className="font-semibold">{stats.totalNumbers}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">🎮 Phân bố theo website</h3>
          <div className="space-y-2">
            {['sgd666', 'one789'].map(website => {
              const count = filteredBetHistories.filter(bet => bet.websiteType === website).length;
              const percentage = filteredBetHistories.length > 0 ? (count / filteredBetHistories.length) * 100 : 0;
              
              return (
                <div key={website} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{website.toUpperCase()}:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${website === 'sgd666' ? 'bg-yellow-500' : 'bg-purple-500'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-8">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bet History Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            📋 {isAccountView ? `Chi tiết số đã đánh - ${selectedAccount}` : `Lịch sử cược`} ({displayData.length})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thời gian
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Website
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kiểu đánh
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6">
                  Miền/Đài
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-5/6">
                  {isAccountView ? 'Số đã đánh' : 'Số đã đánh'}
                </th>
                {!isAccountView && (
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Tài khoản
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Điểm cược
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kết quả
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayData.map((item: BetHistoryItem | AccountDetailData) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{formatDateTime(item.createdAt).split(' ')[0]}</div>
                      <div className="text-xs text-gray-500">{formatDateTime(item.createdAt).split(' ')[1]}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.websiteType === 'sgd666' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {item.websiteType.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">
                      {getBetTypeLabel(item.betTypeDisplay || item.betType)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium mb-1">{getRegionLabel(item.region)}</div>
                      <div className="flex flex-wrap gap-1">
                        {item.stations.map((station: { value: string; label: string }, index: number) => {
                          const isWinning = 'isAccountView' in item 
                            ? false // AccountDetailData không có logic winning channel
                            : isWinningChannel(station, item as BetHistoryItem);
                          return (
                            <span 
                              key={index}
                              className={`inline-block px-1.5 py-0.5 rounded text-xs border transition-colors duration-200 ${
                                isWinning 
                                  ? 'bg-yellow-200 text-yellow-900 border-yellow-400 font-bold' 
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                              }`}
                            >
                              {station.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isAccountView ? (
                      // Hiển thị số cụ thể cho view tài khoản
                      <span 
                        className={`inline-block px-2 py-1 rounded text-sm font-mono border transition-colors duration-200 ${
                          (item as AccountDetailData).isWinning 
                            ? 'bg-yellow-200 text-yellow-900 border-yellow-400 font-bold' 
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {'number' in item ? item.number : item.numbers?.[0] || ''}
                      </span>
                    ) : (
                      // Hiển thị tất cả số cho view order
                      <div className="flex flex-wrap gap-1">
                        {item.numbers.map((number: string, index: number) => {
                          const isWinning = 'isAccountView' in item 
                            ? (item as AccountDetailData).isWinning // Sử dụng isWinning từ AccountDetailData
                            : isWinningNumber(number, item as BetHistoryItem);
                          return (
                            <span 
                              key={index}
                              className={`inline-block px-1 py-0.5 rounded text-xs font-mono border transition-colors duration-200 ${
                                isWinning 
                                  ? 'bg-yellow-200 text-yellow-900 border-yellow-400 font-bold' 
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                              }`}
                            >
                              {number}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  {!isAccountView && (
                    <td className="px-2 py-4 text-sm text-gray-900 w-24">
                      <div>
                        <div className="font-medium mb-1 text-xs">
                          <span className="text-green-600">{item.successfulBets}</span>
                          <span className="text-gray-400 mx-0.5">/</span>
                          <span className="text-gray-600">{item.totalAccountsUsed}</span>
                        </div>
                        <div className="text-xs text-gray-500 max-w-20 truncate" title={item.accountsUsed.filter((acc: { betStatus: string; username: string }) => acc.betStatus === 'success').map((acc: { betStatus: string; username: string }) => acc.username).join(', ')}>
                          {item.accountsUsed.filter((acc: { betStatus: string; username: string }) => acc.betStatus === 'success').map((acc: { betStatus: string; username: string }) => acc.username).join(', ')}
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCurrency('stakeAmount' in item ? item.stakeAmount : item.totalStake)}</div>
                      <div className="text-xs text-gray-500">điểm</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="text-right">
                      {item.result?.isChecked ? (
                        isAccountView ? (
                          // Hiển thị kết quả cho số cụ thể
                          item.isWinning ? (
                            <div>
                              <div className="text-green-600 font-bold">
                                +{formatCurrency(item.winAmount)}
                              </div>
                              <div className="text-xs text-green-500">Thắng</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-red-600 font-bold">
                                {formatCurrency(item.winAmount || -item.stakeAmount)}
                              </div>
                              <div className="text-xs text-red-500">Thua</div>
                            </div>
                          )
                        ) : (
                          // Hiển thị kết quả tổng cho order
                          item.result.totalWinAmount > 0 ? (
                            <div>
                              <div className="text-green-600 font-bold">
                                +{formatCurrency(item.result.totalWinAmount)}
                              </div>
                              <div className="text-xs text-green-500">Thắng</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-red-600 font-bold">
                                {formatCurrency(item.result.totalWinAmount)}
                              </div>
                              <div className="text-xs text-red-500">Thua</div>
                            </div>
                          )
                        )
                      ) : (
                        <div>
                          <div className="text-yellow-600 font-bold">---</div>
                          <div className="text-xs text-yellow-500">Chờ KQ</div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredBetHistories.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có lịch sử cược</h3>
              <p className="text-gray-500">Hãy thực hiện một số lệnh cược để xem lịch sử tại đây</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Hiển thị <span className="font-medium">{((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}</span> đến <span className="font-medium">{Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}</span> trong tổng số <span className="font-medium">{pagination.totalItems}</span> kết quả
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Page Selector */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Trang:</span>
                <select
                  value={pagination.currentPage}
                  onChange={(e) => fetchBetHistory(parseInt(e.target.value))}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: pagination.totalPages }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-500">/ {pagination.totalPages}</span>
              </div>

              {/* Navigation Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => fetchBetHistory(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                  className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-200"
                >
                  ← Trước
                </button>
                
                {/* Show page numbers for small pagination */}
                {pagination.totalPages <= 10 ? (
                  Array.from({ length: pagination.totalPages }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => fetchBetHistory(page)}
                        className={`px-3 py-2 text-sm border rounded-lg transition-colors duration-200 ${
                          pagination.currentPage === page 
                            ? 'bg-purple-500 text-white border-purple-500 shadow-md' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })
                ) : (
                  // Show smart pagination for large page counts
                  <>
                    {pagination.currentPage > 3 && (
                      <>
                        <button
                          onClick={() => fetchBetHistory(1)}
                          className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors duration-200"
                        >
                          1
                        </button>
                        {pagination.currentPage > 4 && (
                          <span className="px-2 py-2 text-sm text-gray-500">...</span>
                        )}
                      </>
                    )}
                    
                    {Array.from({ length: 5 }, (_, i) => {
                      const page = pagination.currentPage - 2 + i;
                      if (page < 1 || page > pagination.totalPages) return null;
                      
                      return (
                        <button
                          key={page}
                          onClick={() => fetchBetHistory(page)}
                          className={`px-3 py-2 text-sm border rounded-lg transition-colors duration-200 ${
                            pagination.currentPage === page 
                              ? 'bg-purple-500 text-white border-purple-500 shadow-md' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    
                    {pagination.currentPage < pagination.totalPages - 2 && (
                      <>
                        {pagination.currentPage < pagination.totalPages - 3 && (
                          <span className="px-2 py-2 text-sm text-gray-500">...</span>
                        )}
                        <button
                          onClick={() => fetchBetHistory(pagination.totalPages)}
                          className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors duration-200"
                        >
                          {pagination.totalPages}
                        </button>
                      </>
                    )}
                  </>
                )}
                
                <button
                  onClick={() => fetchBetHistory(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-200"
                >
                  Sau →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default BettingStatsPage;