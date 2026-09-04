import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { BeakerIcon, UserIcon, MagnifyingGlassIcon, XMarkIcon, EyeIcon, DocumentTextIcon, PencilSquareIcon, TrashIcon, ExclamationTriangleIcon, CheckIcon } from '@heroicons/react/24/outline';
import ModalHeader from './common/ModalHeader';
import { residentService, medicationService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../services/logger';
import type { Resident, Medication } from '../types';
import MedicalRecordsManager from './MedicalRecordsManager';
import MedicationsManager from './MedicationsManager';
import ResidentEditForm from './ResidentEditForm';

type SearchType = 'name' | 'room' | 'careLevel' | 'medication';

const SearchPanel = ({ active = true }: { active?: boolean }) => {
  const [searchType, setSearchType] = useState<SearchType>('name');
  const [nameSearch, setNameSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [medicationSearch, setMedicationSearch] = useState('');
  const [careLevelSearch, setCareLevelSearch] = useState<number | 0>(0);
  const [roomNumberError, setRoomNumberError] = useState('');

  const [searchResults, setSearchResults] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 回診ビュー（一覧ファースト）
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [sortKey, setSortKey] = useState<'room' | 'name' | 'careLevel'>('room');
  const [showDischarged, setShowDischarged] = useState(false);
  const [medsByResident, setMedsByResident] = useState<Map<string, Medication[]>>(new Map());

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
  const [medicationsOpen, setMedicationsOpen] = useState(false);
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
  const { user } = useAuth();
  const author = { uid: user?.uid ?? '', name: user?.displayName ?? user?.email ?? '不明' };

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

  // 全入所者を取得（回診の既定ビュー）
  const loadAllResidents = useCallback(async () => {
    setListLoading(true);
    try {
      const [residents, meds] = await Promise.all([
        residentService.getAll(),
        medicationService.getContinuingByAllResidents(),
      ]);
      setAllResidents(residents);
      setMedsByResident(meds);
    } finally {
      setListLoading(false);
    }
  }, []);

  // 検索タブが表示されるたびに最新化（新規登録・編集の反映）
  useEffect(() => {
    if (active) loadAllResidents();
  }, [active, loadAllResidents]);

  const roomNum = (r: Resident) => parseInt((r.roomNumber || '').replace(/\D/g, ''), 10) || 0;
  const sortResidents = (list: Resident[]) => {
    const arr = [...list];
    if (sortKey === 'room') arr.sort((a, b) => roomNum(a) - roomNum(b) || a.name.localeCompare(b.name, 'ja'));
    else if (sortKey === 'name') arr.sort((a, b) => (a.furigana || '').localeCompare(b.furigana || '', 'ja'));
    else arr.sort((a, b) => (a.careLevel || 0) - (b.careLevel || 0));
    return arr;
  };
  const baseList = hasSearched ? searchResults : allResidents;
  const displayed = sortResidents(baseList.filter(r => showDischarged || !r.dischargeDate));
  const initialLoading = listLoading && allResidents.length === 0; // 初回（データ無し）
  const refreshing = listLoading && allResidents.length > 0;       // 再取得（データ有り）

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
        case 'medication': {
          // 継続中の投薬（一覧で取得済み）から部分一致でクライアント側フィルタ
          const term = medicationSearch.trim();
          results = allResidents.filter(r =>
            (medsByResident.get(r.id) ?? []).some(m => m.name.includes(term))
          );
          break;
        }
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

  const handleViewMedications = (resident: Resident) => {
    setCurrentResident(resident);
    setMedicationsOpen(true);
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
        () => residentService.delete(resident.id, author),
        'delete_resident'
      );

      setSearchResults(prev => prev.filter(r => r.id !== resident.id));
      setAllResidents(prev => prev.filter(r => r.id !== resident.id));
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
            <MagnifyingGlassIcon className="w-6 h-6 text-blue-600" />
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
                <option value="careLevel">要介護度</option>
                <option value="medication">継続中の薬剤</option>
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
                <XMarkIcon className="w-4 h-4" />
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
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    検索
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {(
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  {hasSearched ? '検索結果' : '入所者一覧'}
                  {refreshing && (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-400">
                      <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></span>
                      更新中
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-600">
                  {hasSearched && lastSearchValue ? `「${lastSearchValue}」の結果: ` : '入所中 '}{displayed.length}名
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1 text-gray-700">
                  並べ替え
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as 'room' | 'name' | 'careLevel')}
                    className="px-2 py-1 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="room">部屋順</option>
                    <option value="name">氏名順</option>
                    <option value="careLevel">要介護度順</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-gray-700">
                  <input type="checkbox" checked={showDischarged} onChange={(e) => setShowDischarged(e.target.checked)} />
                  退所者も表示
                </label>
              </div>
            </div>

            {(loading || initialLoading) ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-600 font-medium">{hasSearched ? '該当する入所者が見つかりませんでした' : '入所者がいません'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[100px]">氏名</th>
                      {showDischarged && (
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[80px]">状態</th>
                      )}
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[120px]">フリガナ</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[60px]">年齢</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[60px]">部屋</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[80px]">要介護度</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[180px]">継続中の薬剤</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[120px]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((resident) => (
                      <tr key={resident.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 ${resident.dischargeDate ? 'opacity-60' : ''}`}>
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">{resident.name}</span>
                        </td>
                        {showDischarged && (
                          <td className="py-3 px-4">
                            {resident.dischargeDate ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-full"
                                title={`退所日: ${dayjs(resident.dischargeDate).format('YYYY年MM月DD日')}`}
                              >
                                退所
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                入所中
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <span className="text-gray-600">{resident.furigana}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-700">{calculateAge(resident.birthDate)}歳</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                            {resident.roomNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            要介護{resident.careLevel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {(medsByResident.get(resident.id) ?? []).length === 0 ? (
                            <span className="text-sm text-gray-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {(medsByResident.get(resident.id) ?? []).map((m) => (
                                <span
                                  key={m.id}
                                  className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded"
                                  title={[m.dosage, m.frequency].filter(Boolean).join(' ')}
                                >
                                  {m.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 justify-center flex-wrap">
                            <button
                              onClick={() => handleViewResident(resident)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-150"
                              title="詳細表示"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleViewMedicalRecords(resident)}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors duration-150"
                              title="診療録"
                            >
                              <DocumentTextIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleViewMedications(resident)}
                              className="p-1.5 text-teal-600 hover:bg-teal-100 rounded-lg transition-colors duration-150"
                              title="投薬管理"
                            >
                              <BeakerIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditResident(resident)}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors duration-150"
                              title="編集"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteResident(resident)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-150"
                              title="削除"
                            >
                              <TrashIcon className="w-4 h-4" />
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

      {currentResident && (
        <MedicationsManager
          resident={currentResident}
          open={medicationsOpen}
          onClose={() => {
            setMedicationsOpen(false);
            setCurrentResident(null);
            loadAllResidents();
          }}
        />
      )}

      {editingResident && (
        <ResidentEditForm
          resident={editingResident}
          onComplete={() => {
            setEditingResident(null);
            loadAllResidents();
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
            <ModalHeader
              title={`${viewingResident.name}さんの詳細`}
              subtitle={`${viewingResident.gender} • ${calculateAge(viewingResident.birthDate)}歳 • 部屋${viewingResident.roomNumber}`}
              icon={UserIcon}
              onClose={() => setViewingResident(null)}
            />
            <div className="p-6">
              {viewingResident.dischargeDate ? (
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-200 text-gray-700 rounded-full">退所済み</span>
                  <span className="text-sm text-gray-500">退所日: {dayjs(viewingResident.dischargeDate).format('YYYY年MM月DD日')}</span>
                </div>
              ) : (
                <div className="mb-4">
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">入所中</span>
                </div>
              )}
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
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">
                    {viewingResident.roomNumber}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">要介護度</label>
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                    要介護{viewingResident.careLevel}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">入所日</label>
                  <p className="text-lg font-medium text-gray-900">
                    {dayjs(viewingResident.admissionDate).format('YYYY年MM月DD日')}
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 mb-1">アレルギー</label>
                {viewingResident.allergyStatus === 'あり' ? (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-red-100 text-red-800 rounded-full">
                    {viewingResident.allergies || 'あり'}
                  </span>
                ) : viewingResident.allergyStatus === 'なし' ? (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                    アレルギーなし
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-amber-100 text-amber-800 rounded-full">
                    未確認
                  </span>
                )}
              </div>
              {viewingResident.medicalHistory && (
                <div>
                  <hr className="my-4 border-gray-200" />
                  <label className="block text-sm font-medium text-gray-500 mb-2">既往歴</label>
                  <p className="text-gray-700">{viewingResident.medicalHistory}</p>
                </div>
              )}
              <div className="mt-6 pt-3 border-t border-gray-100 text-xs text-gray-400">
                作成: {viewingResident.createdBy?.name ?? '—'}（{dayjs(viewingResident.createdAt).format('YYYY/MM/DD HH:mm')}）
                {viewingResident.updatedBy && (
                  <> ／ 更新: {viewingResident.updatedBy.name}（{dayjs(viewingResident.updatedAt).format('YYYY/MM/DD HH:mm')}）</>
                )}
              </div>
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
                <ExclamationTriangleIcon className="w-5 h-5" />
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  真正性のため物理削除はしません。一覧から非表示になりますが、診療録・投薬を含む記録は保持されます（誰が削除したかも記録されます）。
                </p>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setDeleteConfirmDialog({ open: false, resident: null })}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
                キャンセル
              </button>
              <button
                onClick={confirmDeleteResident}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
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
                <CheckIcon className="w-5 h-5" />
              ) : (
                <XMarkIcon className="w-5 h-5" />
              )}
            </div>
            <span className="flex-1 font-medium">{snackbar.message}</span>
            <button
              onClick={handleCloseSnackbar}
              className="flex-shrink-0 text-current hover:opacity-70 transition-opacity"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPanel;