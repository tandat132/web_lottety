export interface BetRecord {
  id: string;
  accountId: string;
  username: string;
  websiteType: 'sgd666' | 'one789';
  betType: string; // bao-lo, dau-duoi, de, lo-xien, 2d-dau, 3d-dau, etc.
  gameType: 'lottery'; // Chỉ có xổ số
  region: 'south' | 'central' | 'north';
  stations: string[]; // Các đài đã chọn
  numbers: string[]; // Các số đã đánh
  pointsPerNumber: number; // Điểm cho mỗi số
  totalPoints: number; // Tổng điểm
  distributionType: 'equal' | 'random' | 'all';
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  betTime: string;
  settleTime?: string;
  winAmount?: number;
  lossAmount?: number;
  description: string;
}

// Cập nhật interface cho dữ liệu từ database
export interface BetHistoryItem {
  _id: string;
  orderCode: string;
  websiteType: 'sgd666' | 'one789';
  betType: string;
  betTypeDisplay: string;
  region: 'south' | 'central' | 'north';
  stations: Array<{
    value: string;
    label: string;
  }>;
  numbers: string[];
  points: number;
  totalStake: number;
  distributionType: 'equal' | 'random' | 'all';
  accountsUsed: Array<{
    accountId: string;
    username: string;
    numbersAssigned: string[];
    stakeAmount: number;
    betStatus: 'pending' | 'success' | 'failed';
    betResponse?: {
      orderCode: string;
      betDetails: any;
    };
    errorMessage?: string;
  }>;
  userId: string;
  overallStatus: 'pending' | 'completed' | 'partial_success' | 'failed';
  totalAccountsUsed: number;
  successfulBets: number;
  failedBets: number;
  result: {
    isChecked: boolean;
    status: 'WIN' | 'LOSS' | 'DRAW' | 'not_found';
    winningNumbers: string[]; // Tất cả số thắng
    winningNumbersByChannel: Record<string, string[]>; // Số thắng theo từng đài
    totalWinAmount: number;
    totalStake: number;
    winDetails: Array<{
      accountUsername: string;
      numbers: string[];
      winAmount: number;
      prize: string;
    }>;
    channelResults: Record<string, any>;
    accountResults: Array<{
      accountUsername: string;
      accountId: string;
      orderCode: string;
      totalWinLoss: number;
      totalStake: number;
      status: string;
      recordCount: number;
      winDetails: any[];
      winningNumbers: string[];
      winningNumbersByChannel: Record<string, string[]>;
      error?: string;
    }>;
    processedAccounts: number;
    totalAccounts: number;
    checkedAt?: string;
    searchedOrderCode?: string;
    availableOrderCodes?: string[];
  };
  betDate: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface BettingStats {
  totalBets: number;
  totalPoints: number;
  totalWin: number;
  totalLoss: number;
  profit: number;
  winRate: number;
  avgPointsPerBet: number;
  totalNumbers: number;
}

export interface DateFilter {
  startDate: string;
  endDate: string;
}