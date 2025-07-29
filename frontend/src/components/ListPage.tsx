import React, { useState, useEffect, useCallback } from 'react';
import { accountAPI } from '../services/api';
import type { Account } from '../types/account';

interface CheckAccountResult {
  accountId: string;
  points: number;
  status: 'success' | 'failed' | 'proxy_error';
}

interface CheckMultipleAccountsResponse {
  success: boolean;
  message: string;
  results: CheckAccountResult[];
}

const ListPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  // Cập nhật state cho activeFilter
  const [activeFilter, setActiveFilter] = useState<'all' | 'sgd666' | 'one789'>('all');
  
  // Hàm định dạng điểm: số chẵn không hiển thị ,00, sử dụng dấu phẩy thay vì dấu chấm
  const formatPoints = (points: number): string => {
    if (points % 1 === 0) {
      // Số nguyên, không hiển thị phần thập phân
      return points.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    } else {
      // Số thập phân, hiển thị với dấu phẩy
      return points.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
  };

  // Cập nhật logic lọc accounts
  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'proxy' && account.proxy) ||
      (filterStatus === 'no-proxy' && !account.proxy) ||
      account.status === filterStatus;
    const matchesActiveFilter = activeFilter === 'all' || account.websiteType === activeFilter;
    
    return matchesSearch && matchesStatus && matchesActiveFilter;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newAccountData, setNewAccountData] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{show: boolean, title: string, message: string, onConfirm: () => void} | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedWebsiteType, setSelectedWebsiteType] = useState<'sgd666' | 'one789'>('sgd666');

  const [checkingAll, setCheckingAll] = useState(false);
  
  // Hiển thị confirm dialog
  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ show: true, title, message, onConfirm });
  };

  // Đóng confirm dialog
  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  // Xử lý confirm
  const handleConfirm = () => {
    if (confirmDialog?.onConfirm) {
      confirmDialog.onConfirm();
    }
    closeConfirmDialog();
  };

  // Hiển thị thông báo
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Tải danh sách accounts
  const loadAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await accountAPI.getAll();
      setAccounts(data);
    } catch {
      showNotification('error', '❌ Không thể tải danh sách tài khoản');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Kiểm tra tất cả tài khoản
  const handleCheckAllAccounts = async () => {
    if (filteredAccounts.length === 0) {
      showNotification('info', '⚠️ Không có tài khoản nào để kiểm tra');
      return;
    }

    try {
      setCheckingAll(true);
      
      const accountIds = filteredAccounts.map(acc => acc._id);
      const result: CheckMultipleAccountsResponse = await accountAPI.checkMultipleAccounts(accountIds);
      if (result.success) {
        // Cập nhật thông tin tài khoản trong state
        setAccounts(prev => prev.map(acc => {
          const updatedAccount = result.results.find((r: CheckAccountResult) => r.accountId === acc._id);
          if (updatedAccount) {
            let newStatus: 'active' | 'inactive' | 'proxy_error' = 'active';
            if (updatedAccount.status === 'success') {
              newStatus = 'active';
            } else if (updatedAccount.status === 'proxy_error') {
              newStatus = 'proxy_error';
            } else {
              newStatus = 'inactive';
            }
            
            return {
              ...acc,
              points: updatedAccount.points,
              status: newStatus
            };
          }
          return acc;
        }));
        
        showNotification('success', `✅ ${result.message}`);
      } else {
        showNotification('error', `❌ Kiểm tra thất bại: ${result.message}`);
      }
    } catch (error: unknown) {
      console.error('Check all accounts error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không xác định';
      showNotification('error', `❌ Lỗi kiểm tra tài khoản: ${errorMessage}`);
    } finally {
      setCheckingAll(false);
    }
  };

  // Thêm account mới
  const handleAddAccount = async () => {
    try {
      const lines = newAccountData.trim().split('\n').filter(line => line.trim());
      const newAccounts = [];
      const duplicateUsernames = [];
      const invalidProxies = []; // Thêm mảng để lưu proxy không hợp lệ
      
      // Lấy danh sách username từ input
      const inputUsernames = [];
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        const parts = trimmedLine.split(':');

        if (parts.length >= 3) {
          const username = parts[0].trim();
          const password = parts[1].trim();
          const proxy = parts.slice(2).join(':').trim();

          // Kiểm tra proxy
          if (!proxy) {
            invalidProxies.push(`${username} (thiếu proxy)`);
            continue;
          }
          
          // Kiểm tra proxy hợp lệ
          if (proxy && !validateProxy(proxy)) {
            invalidProxies.push(`${username} (proxy không hợp lệ: ${proxy})`);
            continue;
          }
          
          inputUsernames.push(username);

          const accountData = {
            username,
            password,
            proxy,
            points: 0,
            status: 'inactive' as const
          };
          newAccounts.push(accountData);
        }
      }
      
      // Hiển thị thông báo về proxy không hợp lệ
      if (invalidProxies.length > 0) {
        showNotification('error', `❌ Proxy không hợp lệ hoặc thiếu: ${invalidProxies.slice(0, 3).join(', ')}${invalidProxies.length > 3 ? ` và ${invalidProxies.length - 3} tài khoản khác` : ''}`);
      }
      
      if (newAccounts.length === 0) {
        if (invalidProxies.length > 0) {
          return; // Đã hiển thị thông báo lỗi proxy ở trên
        }
        showNotification('error', '❌ Không có tài khoản hợp lệ để thêm!');
        return;
      }
      
      // Kiểm tra username đã tồn tại trong database
      const { existingUsernames } = await accountAPI.checkUsernames(inputUsernames, selectedWebsiteType);
      const existingUsernamesLower = existingUsernames.map((u: string) => u.toLowerCase());
      
      // Lọc ra các tài khoản không trùng lặp
      const validAccounts = [];
      const seenUsernames = new Set();
      
      for (const accountData of newAccounts) {
        const usernameLower = accountData.username.toLowerCase();
        
        // Kiểm tra trùng với database
        if (existingUsernamesLower.includes(usernameLower)) {
          duplicateUsernames.push(accountData.username);
          continue;
        }
        
        // Kiểm tra trùng trong cùng batch
        if (seenUsernames.has(usernameLower)) {
          duplicateUsernames.push(accountData.username);
          continue;
        }
        
        seenUsernames.add(usernameLower);
        validAccounts.push(accountData);
      }
      
      // Hiển thị thông báo về username trùng lặp
      if (duplicateUsernames.length > 0) {
        showNotification('info', `⚠️ Đã bỏ qua ${duplicateUsernames.length} tài khoản trùng lặp: ${duplicateUsernames.join(', ')}`);
      }
      
      // Nếu không có tài khoản nào để thêm
      if (validAccounts.length === 0) {
        showNotification('error', '❌ Tất cả tài khoản đều đã tồn tại!');
        return;
      }
      
      // Thêm từng tài khoản
      for (const accountData of validAccounts) {
        await accountAPI.create(`${accountData.username}:${accountData.password}:${accountData.proxy || ''}`, selectedWebsiteType);
      }
      
      setNewAccountData('');
      setSelectedWebsiteType('sgd666'); // Reset về mặc định
      setShowAddModal(false);
      loadAccounts();
      
      // Thông báo kết quả
      let message = `✅ Đã thêm thành công ${validAccounts.length} tài khoản!`;
      if (duplicateUsernames.length > 0) {
        message += ` (Bỏ qua ${duplicateUsernames.length} tài khoản trùng lặp)`;
      }
      if (invalidProxies.length > 0) {
        message += ` (Bỏ qua ${invalidProxies.length} proxy không hợp lệ)`;
      }
      showNotification('success', message);
    } catch (error) {
      console.error('Error adding accounts:', error);
      showNotification('error', '❌ Có lỗi xảy ra khi thêm tài khoản');
    }
  };

  // Xóa account
  const handleDeleteAccount = async (id: string) => {
    showConfirmDialog(
      '🗑️ Xóa tài khoản',
      'Bạn có chắc chắn muốn xóa tài khoản này không? Hành động này không thể hoàn tác.',
      async () => {
        try {
          await accountAPI.delete(id);
          loadAccounts();
          showNotification('success', '✅ Đã xóa tài khoản thành công!');
        } catch {
          showNotification('error', '❌ Không thể xóa tài khoản');
        }
      }
    );
  };

  // Sửa account
  const handleEditAccount = async () => {
    if (!editingAccount) return;
    
    // Kiểm tra proxy hợp lệ trước khi cập nhật
    if (editingAccount.proxy && !validateProxy(editingAccount.proxy)) {
      showNotification('error', '❌ Proxy không hợp lệ! Định dạng: ip:port hoặc ip:port:username:pass');
      return;
    }
    
    try {
      // Tìm tài khoản gốc để so sánh username
      const originalAccount = accounts.find(acc => acc._id === editingAccount._id);
      
      const usernameChanged = originalAccount && editingAccount.username.toLowerCase() !== originalAccount.username.toLowerCase();
      const websiteChanged = originalAccount && editingAccount.websiteType !== originalAccount.websiteType;
      
      // Nếu username thay đổi, kiểm tra trùng lặp
      if (usernameChanged || websiteChanged) {
        const { exists } = await accountAPI.checkUsername(
          editingAccount.username, 
          editingAccount.websiteType
        );
        
        if (exists) {
          showNotification(
            'error', 
            `❌ Username "${editingAccount.username}" đã tồn tại cho website ${editingAccount.websiteType.toUpperCase()}!`
          );
          return;
        }
      }
      
      await accountAPI.update(editingAccount._id, {
        username: editingAccount.username,
        password: editingAccount.password,
        proxy: editingAccount.proxy,
        points: editingAccount.points,
        status: editingAccount.status,
        websiteType: editingAccount.websiteType
      });
      
      setShowEditModal(false);
      setEditingAccount(null);
      loadAccounts();
      showNotification('success', '✅ Đã cập nhật tài khoản thành công!');
    } catch (error) {
      console.error('Error updating account:', error);
      showNotification('error', '❌ Không thể cập nhật tài khoản');
    }
  };

  // Thêm function xóa tất cả tài khoản
  const handleDeleteAllAccounts = async () => {
    showConfirmDialog(
      '⚠️ Xóa tất cả tài khoản',
      'Bạn có chắc chắn muốn xóa TẤT CẢ tài khoản không? Hành động này sẽ xóa vĩnh viễn tất cả dữ liệu và không thể hoàn tác!',
      async () => {
      try {
        // Xóa từng tài khoản
        for (const account of accounts) {
          await accountAPI.delete(account._id);
        }
        loadAccounts();
        showNotification('success', '✅ Đã xóa tất cả tài khoản thành công!');
      } catch {
        showNotification('error', '❌ Có lỗi xảy ra khi xóa tài khoản');
        }
      }
    );
  };

  // Hàm xử lý sắp xếp
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Nếu đang sắp xếp cùng cột, đổi chiều
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nếu sắp xếp cột mới, mặc định là tăng dần
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Hàm sắp xếp dữ liệu
  const sortedAccounts = React.useMemo(() => {
    if (!sortField) return filteredAccounts;
    
    return [...filteredAccounts].sort((a, b) => {
      let aValue = a[sortField as keyof Account];
      let bValue = b[sortField as keyof Account];
      
      // Xử lý đặc biệt cho cột điểm (points)
      if (sortField === 'points') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Xử lý cho các cột chữ
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      return 0;
    });
  }, [filteredAccounts, sortField, sortDirection]);

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Đang tải danh sách...</div>
        </div>
      </div>
    );
  }

  // Thêm hàm validation proxy
  const validateProxy = (proxy: string): boolean => {
    const parts = proxy.trim().split(':');
    
    // Kiểm tra định dạng ip:port hoặc ip:port:username:pass
    if (parts.length !== 2 && parts.length !== 4) {
      return false;
    }
    
    const ip = parts[0];
    const port = parts[1];
    
    // Kiểm tra IP (IPv4 cơ bản)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return false;
    }
    
    // Kiểm tra từng octet của IP (0-255)
    const octets = ip.split('.');
    for (const octet of octets) {
      const num = parseInt(octet, 10);
      if (num < 0 || num > 255) {
        return false;
      }
    }
    
    // Kiểm tra port (1-65535)
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return false;
    }
    
    // Nếu có username:pass, kiểm tra không được rỗng
    if (parts.length === 4) {
      const username = parts[2];
      const password = parts[3];
      if (!username.trim() || !password.trim()) {
        return false;
      }
    }
    
    return true;
  };

  return (
    <div className="px-4 py-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[60] p-4 rounded-lg shadow-lg border-l-4 transition-all duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-500 text-green-800' 
            : notification.type === 'error'
            ? 'bg-red-50 border-red-500 text-red-800'
            : 'bg-blue-50 border-blue-500 text-blue-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{notification.message}</span>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Quản lý tài khoản</h1>
        <div className="flex gap-3">
          <button
            onClick={handleCheckAllAccounts}
            disabled={filteredAccounts.length === 0 || checkingAll}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg flex items-center gap-2"
          >
            {checkingAll ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Đang kiểm tra...
              </>
            ) : (
              <>
                🔍 Kiểm tra tất cả
              </>
            )}
          </button>
          <button
            onClick={handleDeleteAllAccounts}
            disabled={accounts.length === 0}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg flex items-center gap-2"
          >
            🗑️ Xóa tất cả
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg flex items-center gap-2"
          >
            ➕ Thêm tài khoản
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm theo username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        
        <div>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Không hoạt động</option>
            <option value="proxy_error">Proxy không hoạt động</option>
          </select>
        </div>
      </div>

      {/* Status Filter Tabs - Updated Design */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => setActiveFilter('all')}
          className={`p-4 rounded-lg shadow border cursor-pointer transition-all ${
            activeFilter === 'all' 
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' 
              : 'bg-white hover:bg-gray-50 hover:shadow-md'
          }`}
        >
          <div className="text-2xl font-bold text-blue-600">{accounts.length}</div>
          <div className="text-sm text-gray-600">Tất cả tài khoản</div>
        </div>
        
        <div 
          onClick={() => setActiveFilter('one789')}
          className={`p-4 rounded-lg shadow border cursor-pointer transition-all ${
            activeFilter === 'one789' 
              ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200' 
              : 'bg-white hover:bg-gray-50 hover:shadow-md'
          }`}
        >
          <div className="text-2xl font-bold text-purple-600">{accounts.filter(a => a.websiteType === 'one789').length}</div>
          <div className="text-sm text-gray-600">Tài khoản ONE789</div>
        </div>
        
        <div 
          onClick={() => setActiveFilter('sgd666')}
          className={`p-4 rounded-lg shadow border cursor-pointer transition-all ${
            activeFilter === 'sgd666' 
              ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-200' 
              : 'bg-white hover:bg-gray-50 hover:shadow-md'
          }`}
        >
          <div className="text-2xl font-bold text-yellow-600">{accounts.filter(a => a.websiteType === 'sgd666').length}</div>
          <div className="text-sm text-gray-600">Tài khoản SGD666</div>
        </div>
        
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('username')}
              >
                <div className="flex items-center gap-1">
                  Tên đăng nhập
                  {sortField === 'username' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('password')}
              >
                <div className="flex items-center gap-1">
                  Mật khẩu
                  {sortField === 'password' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('proxy')}
              >
                <div className="flex items-center gap-1">
                  Proxy
                  {sortField === 'proxy' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('points')}
              >
                <div className="flex items-center gap-1">
                  Điểm
                  {sortField === 'points' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('websiteType')}
              >
                <div className="flex items-center gap-1">
                  Website
                  {sortField === 'websiteType' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Trạng thái
                  {sortField === 'status' && (
                    <span className="text-blue-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAccounts.map((account, index) => (
              <tr key={account._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{account.username}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{account.password}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="text-green-600">{account.proxy}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatPoints(account.points)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    account.websiteType === 'sgd666' 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {account.websiteType?.toUpperCase() || 'SGD666'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    account.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : account.status === 'proxy_error'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {account.status === 'active' 
                      ? 'Đang hoạt động' 
                      : account.status === 'proxy_error'
                      ? 'Proxy không hoạt động'
                      : 'Không hoạt động'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button 
                    onClick={() => {
                      setEditingAccount(account);
                      setShowEditModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Sửa
                  </button>
                  <button 
                    onClick={() => handleDeleteAccount(account._id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAccounts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Không tìm thấy tài khoản nào phù hợp với tiêu chí tìm kiếm.
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex-shrink-0">
              <h3 className="text-xl font-bold text-white">Thêm tài khoản mới</h3>
              <p className="text-blue-100 text-sm mt-1">Có thể thêm nhiều tài khoản cùng lúc, mỗi tài khoản một dòng</p>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🌐 Chọn Website
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div 
                    onClick={() => setSelectedWebsiteType('one789')}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedWebsiteType === 'one789'
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">ONE789</div>
                      <div className="text-sm text-gray-600">Website One789</div>
                    </div>
                  </div>

                  <div 
                    onClick={() => setSelectedWebsiteType('sgd666')}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedWebsiteType === 'sgd666'
                        ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold text-yellow-600">SGD666</div>
                      <div className="text-sm text-gray-600">Website SGD666</div>
                    </div>
                  </div>
                  
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Danh sách tài khoản
                </label>
                <div className="bg-gray-50 p-3 rounded-lg mb-3">
                  <p className="text-sm text-gray-600 mb-1">📝 <strong>Định dạng:</strong></p>
                  <p className="text-sm text-gray-600 mb-1">• <code className="bg-white px-1 rounded">username:password:proxy</code></p>
                  <p className="text-sm text-gray-600 mb-1">🌐 <strong>Proxy:</strong></p>
                  <p className="text-sm text-gray-600 mb-1">• <code className="bg-white px-1 rounded">ip:port</code> (VD: 192.168.1.1:8080)</p>
                  <p className="text-sm text-gray-600">• <code className="bg-white px-1 rounded">ip:port:username:password</code> (VD: 192.168.1.1:8080:username:password)</p>
                </div>
                
                <textarea
                  value={newAccountData}
                  onChange={(e) => setNewAccountData(e.target.value)}
                  placeholder={`Ví dụ:\nuser1:pass1:192.168.1.1:8080\nuser2:pass2:192.168.1.2:8080:proxyuser:proxypass\n`}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg h-40 sm:h-48 md:h-56 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  style={{ lineHeight: '1.5' }}
                />
                
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    📊 Số dòng: {newAccountData.trim().split('\n').filter(line => line.trim()).length}
                  </div>
                  <button
                    onClick={() => setNewAccountData('')}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Xóa tất cả
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 border-t flex-shrink-0">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium order-2 sm:order-1"
              >
                ❌ Hủy
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!newAccountData.trim()}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg order-1 sm:order-2"
              >
                ✅ Thêm tài khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && editingAccount && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEditModal(false);
            setEditingAccount(null);
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                ✏️ Chỉnh sửa tài khoản
              </h3>
              <p className="text-green-100 text-sm mt-1">Cập nhật thông tin tài khoản</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {/* Website Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🌐 Website
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div 
                      onClick={() => setEditingAccount({...editingAccount, websiteType: 'sgd666'})}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        editingAccount.websiteType === 'sgd666'
                          ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200'
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-sm font-bold text-yellow-600">SGD666</div>
                      </div>
                    </div>
                    
                    <div 
                      onClick={() => setEditingAccount({...editingAccount, websiteType: 'one789'})}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        editingAccount.websiteType === 'one789'
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-sm font-bold text-purple-600">ONE789</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👤 Username
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập username"
                    value={editingAccount.username}
                    onChange={(e) => setEditingAccount({...editingAccount, username: e.target.value})}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔒 Password
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập password"
                    value={editingAccount.password}
                    onChange={(e) => setEditingAccount({...editingAccount, password: e.target.value})}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🌐 Proxy
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập proxy"
                    value={editingAccount.proxy || ''}
                    onChange={(e) => setEditingAccount({...editingAccount, proxy: e.target.value || null})}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium flex items-center gap-2"
              >
                ❌ Hủy
              </button>
              <button
                onClick={handleEditAccount}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all font-medium shadow-lg flex items-center gap-2"
              >
                💾 Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Dialog */}
      {confirmDialog?.show && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeConfirmDialog}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-red-600 to-pink-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {confirmDialog.title}
              </h3>
            </div>
            
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-gray-700 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeConfirmDialog}
                className="px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium flex items-center gap-2"
              >
                ❌ Hủy bỏ
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-700 hover:to-pink-700 transition-all font-medium shadow-lg flex items-center gap-2"
                autoFocus
              >
                🗑️ Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListPage;
