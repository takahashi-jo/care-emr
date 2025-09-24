import { useState } from 'react';
import dayjs from 'dayjs';
import { residentService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { logger } from '../services/logger';
import type { Resident } from '../types';
import MedicalRecordsManager from './MedicalRecordsManager';
import ResidentEditForm from './ResidentEditForm';

type SearchType = 'name' | 'room' | 'medication' | 'careLevel';

const SearchPanel = () => {
  const [searchType, setSearchType] = useState<SearchType>('name');
  const [nameSearch, setNameSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [medicationSearch, setMedicationSearch] = useState('');
  const [careLevelSearch, setCareLevelSearch] = useState<number | 0>(0);
  const [roomNumberError, setRoomNumberError] = useState('');

  const [searchResults, setSearchResults] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const convertSpacesToFullWidth = (text: string): string => {
    return text.replace(/ /g, '　');
  };

  const validateRoomNumber = (roomNumber: string): string => {
    if (!roomNumber) return '';
    if (!/^[0-9]+$/.test(roomNumber)) {
      return '部屋番号は半角数字のみで入力してください';
    }
    return '';
  };

  const [lastSearchValue, setLastSearchValue] = useState('');
  const [medicalRecordsOpen, setMedicalRecordsOpen] = useState(false);
  const [currentResident, setCurrentResident] = useState<Resident | null>(null);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [viewingResident, setViewingResident] = useState<Resident | null>(null);

  // 削除確認ダイアログ
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    open: false,
    resident: null as Resident | null
  });

  // 通知
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  // 統合エラーハンドリングとパフォーマンス監視
  const { handleFirestoreError } = useErrorHandler();
  const { measureAsyncOperation, measureInteraction } = usePerformanceMonitor('SearchPanel');

  const getCurrentSearchValue = () => {
    switch (searchType) {
      case 'name': return nameSearch;
      case 'room': return roomSearch;
      case 'medication': return medicationSearch;
      case 'careLevel': return careLevelSearch ? `要介護${careLevelSearch}` : '';
      default: return '';
    }
  };

  const calculateAge = (birthDate: Date): number => {
    return dayjs().diff(dayjs(birthDate), 'year');
  };

  const handleSearchTypeChange = (newType: SearchType) => {
    setSearchType(newType);
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleSearch = async () => {
    const searchValue = getCurrentSearchValue();
    if (!searchValue.trim() && searchType !== 'careLevel') return;
    if (searchType === 'careLevel' && careLevelSearch === 0) return;

    const endMeasurement = measureInteraction('search_residents', performance.now());
    setLoading(true);
    setHasSearched(true);
    setLastSearchValue(searchValue);

    try {
      logger.userAction('search_initiated', {
        component: 'SearchPanel',
        searchType,
        searchValue: searchType === 'careLevel' ? `level_${careLevelSearch}` : searchValue
      });

      let results: Resident[] = [];

      switch (searchType) {
        case 'name':
          results = await measureAsyncOperation(
            () => residentService.searchByName(nameSearch),
            'search_by_name'
          ) || [];
          break;
        case 'room':
          results = await measureAsyncOperation(
            () => residentService.getByRoomNumber(roomSearch),
            'search_by_room'
          ) || [];
          break;
        case 'medication':
          results = await measureAsyncOperation(
            () => residentService.getByMedication(medicationSearch),
            'search_by_medication'
          ) || [];
          break;
        case 'careLevel':
          results = await measureAsyncOperation(
            () => residentService.getByCareLevel(careLevelSearch),
            'search_by_care_level'
          ) || [];
          break;
      }

      setSearchResults(results);

      logger.userAction('search_completed', {
        component: 'SearchPanel',
        searchType,
        resultCount: results.length,
        searchValue: searchType === 'careLevel' ? `level_${careLevelSearch}` : searchValue
      });

    } catch (error: unknown) {
      const errorMessage = handleFirestoreError(error, 'read', {
        component: 'SearchPanel',
        searchType,
        searchValue
      });

      setSearchResults([]);
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
      endMeasurement();
    }
  };

  const handleClear = () => {
    setSearchType('name');
    setNameSearch('');
    setRoomSearch('');
    setMedicationSearch('');
    setCareLevelSearch(0);
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleViewMedicalRecords = (resident: Resident) => {
    setCurrentResident(resident);
    setMedicalRecordsOpen(true);
  };

  const handleEditResident = (resident: Resident) => {
    setEditingResident(resident);
  };

  const handleViewResident = (resident: Resident) => {
    setViewingResident(resident);
  };

  const handleDeleteResident = (resident: Resident) => {
    setDeleteConfirmDialog({
      open: true,
      resident: resident
    });
  };

  const confirmDeleteResident = async () => {
    if (!deleteConfirmDialog.resident) return;

    const resident = deleteConfirmDialog.resident;

    try {
      logger.userAction('resident_delete_initiated', {
        component: 'SearchPanel',
        residentId: resident.id,
        residentName: resident.name
      });

      await measureAsyncOperation(
        () => residentService.delete(resident.id),
        'delete_resident'
      );

      setSearchResults(prev => prev.filter(r => r.id !== resident.id));
      showSnackbar(`${resident.name}さんの情報を削除しました`, 'success');
      setDeleteConfirmDialog({ open: false, resident: null });

      logger.userAction('resident_deleted_success', {
        component: 'SearchPanel',
        residentId: resident.id,
        residentName: resident.name
      });

    } catch (error: unknown) {
      const errorMessage = handleFirestoreError(error, 'delete', {
        component: 'SearchPanel',
        residentId: resident.id,
        residentName: resident.name
      });

      showSnackbar(errorMessage, 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }));
    }, 4000);
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900">入所者検索</h2>
          </div>

          <div className="max-w-4xl">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">検索種別</label>
              <select
                value={searchType}
                onChange={(e) => handleSearchTypeChange(e.target.value as SearchType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              >
                <option value="name">氏名</option>
                <option value="room">部屋番号</option>
                <option value="medication">服薬中の薬剤</option>
                <option value="careLevel">要介護度</option>
              </select>
            </div>

            <div className="mb-6">
              {searchType === 'name' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    氏名またはフリガナ（前方一致検索）
                  </label>
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(convertSpacesToFullWidth(e.target.value))}
                    placeholder="例: 田中, タナカ"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    ※名前の最初から一致する文字で検索されます（スペースは自動的に全角に変換されます）
                  </p>
                </div>
              )}

              {searchType === 'room' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    部屋番号
                  </label>
                  <input
                    type="text"
                    value={roomSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRoomSearch(value);
                      setRoomNumberError(validateRoomNumber(value));
                    }}
                    placeholder="例: 101, 201"
                    onKeyDown={(e) => e.key === 'Enter' && !roomNumberError && handleSearch()}
                    className={`w-full px-3 py-2 border rounded-lg transition-colors duration-200 ${
                      roomNumberError
                        ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  <p className={`mt-1 text-sm ${
                    roomNumberError ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {roomNumberError || "※半角数字のみで入力してください"}
                  </p>
                </div>
              )}

              {searchType === 'medication' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    薬剤名
                  </label>
                  <input
                    type="text"
                    value={medicationSearch}
                    onChange={(e) => setMedicationSearch(e.target.value)}
                    placeholder="例: アリセプト, メマリー"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
              )}

              {searchType === 'careLevel' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    要介護度
                  </label>
                  <select
                    value={careLevelSearch}
                    onChange={(e) => setCareLevelSearch(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  >
                    <option value={0}>選択してください</option>
                    <option value={1}>要介護１</option>
                    <option value={2}>要介護２</option>
                    <option value={3}>要介護３</option>
                    <option value={4}>要介護４</option>
                    <option value={5}>要介護５</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 flex-wrap justify-end">
              <button
                onClick={handleClear}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200 gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                クリア
              </button>
              <button
                onClick={handleSearch}
                disabled={loading || (searchType === 'room' && !!roomNumberError)}
                className="inline-flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors duration-200 gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    検索中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    検索
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {hasSearched && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">検索結果</h3>
              {lastSearchValue && (
                <p className="text-sm text-gray-600">
                  「{lastSearchValue}」で検索した結果: {searchResults.length}件
                </p>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-200">
                <svg className="w-12 h-12 text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-blue-800 font-medium">該当する入所者が見つかりませんでした</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[100px]">氏名</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[120px]">フリガナ</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[60px]">年齢</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[60px]">部屋</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[80px]">要介護度</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[200px]">服薬</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[120px]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((resident) => (
                      <tr key={resident.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">{resident.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-600">{resident.furigana}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-700">{calculateAge(resident.birthDate)}歳</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                            {resident.roomNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            要介護{resident.careLevel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {resident.medications.length > 0 ? (
                              resident.medications.map((medication, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full"
                                >
                                  {medication}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500 italic">処方薬なし</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 justify-center flex-wrap">
                            <button
                              onClick={() => handleViewResident(resident)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-150"
                              title="詳細表示"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleViewMedicalRecords(resident)}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors duration-150"
                              title="診療録"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19.5 3H4.5C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3zM19 18H5V8h14v10zm-8-9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEditResident(resident)}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors duration-150"
                              title="編集"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteResident(resident)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-150"
                              title="削除"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {currentResident && (
        <MedicalRecordsManager
          resident={currentResident}
          open={medicalRecordsOpen}
          onClose={() => {
            setMedicalRecordsOpen(false);
            setCurrentResident(null);
          }}
        />
      )}

      {editingResident && (
        <ResidentEditForm
          resident={editingResident}
          onComplete={() => {
            setEditingResident(null);
            if (hasSearched) {
              handleSearch();
            }
          }}
          onCancel={() => setEditingResident(null)}
        />
      )}

      {viewingResident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">入所者詳細情報</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">氏名</label>
                  <p className="text-lg font-medium text-gray-900">{viewingResident.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">フリガナ</label>
                  <p className="text-lg font-medium text-gray-900">{viewingResident.furigana}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">生年月日</label>
                  <p className="text-lg font-medium text-gray-900">
                    {dayjs(viewingResident.birthDate).format('YYYY年MM月DD日')} ({calculateAge(viewingResident.birthDate)}歳)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">性別</label>
                  <p className="text-lg font-medium text-gray-900">{viewingResident.gender}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">部屋番号</label>
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-purple-100 text-purple-800 rounded-full">
                    {viewingResident.roomNumber}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">要介護度</label>
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                    要介護{viewingResident.careLevel}
                  </span>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-500 mb-2">服薬情報</label>
                <div className="flex flex-wrap gap-2">
                  {viewingResident.medications.length > 0 ? (
                    viewingResident.medications.map((medication, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full"
                      >
                        {medication}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">処方薬なし</p>
                  )}
                </div>
              </div>
              {viewingResident.medicalHistory && (
                <div>
                  <hr className="my-4 border-gray-200" />
                  <label className="block text-sm font-medium text-gray-500 mb-2">既往歴</label>
                  <p className="text-gray-700">{viewingResident.medicalHistory}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setViewingResident(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog.open && deleteConfirmDialog.resident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            {/* Dialog Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
              <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.46 0L4.354 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                入所者の削除確認
              </h3>
            </div>

            {/* Dialog Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-3">
                  以下の入所者を削除しますか？
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="text-lg font-medium text-gray-900 mb-2">
                    {deleteConfirmDialog.resident.name}さん
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>部屋番号: {deleteConfirmDialog.resident.roomNumber}</div>
                    <div>年齢: {calculateAge(deleteConfirmDialog.resident.birthDate)}歳</div>
                    <div>要介護度: {deleteConfirmDialog.resident.careLevel}</div>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium mb-2">
                  ⚠️ 重要な注意事項
                </p>
                <ul className="text-sm text-red-600 space-y-1">
                  <li>• この操作は取り消すことができません</li>
                  <li>• 診療録も含めて完全に削除されます</li>
                  <li>• すべての関連データが失われます</li>
                </ul>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setDeleteConfirmDialog({ open: false, resident: null })}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                キャンセル
              </button>
              <button
                onClick={confirmDeleteResident}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {snackbar.open && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[110]">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${
            snackbar.severity === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex-shrink-0">
              {snackbar.severity === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <span className="flex-1 font-medium">{snackbar.message}</span>
            <button
              onClick={handleCloseSnackbar}
              className="flex-shrink-0 text-current hover:opacity-70 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPanel;