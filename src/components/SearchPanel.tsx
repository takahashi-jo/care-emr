import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { UserIcon, MagnifyingGlassIcon, XMarkIcon, EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import ModalHeader from './common/ModalHeader';
import ConfirmDialog from './common/ConfirmDialog';
import Snackbar from './common/Snackbar';
import { residentService, medicationService } from '../services/firestore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../services/logger';
import type { Resident, Medication } from '../types';
import MedicalRecordsManager from './MedicalRecordsManager';
import MedicationsManager from './MedicationsManager';
import VitalsManager from './VitalsManager';
import ProblemsManager from './ProblemsManager';
import LabResultsManager from './LabResultsManager';
import RecordsMenu from './RecordsMenu';
import ResidentEditForm from './ResidentEditForm';

type SearchType = 'name' | 'room' | 'careLevel' | 'medication';

const SearchPanel = ({ active = true }: { active?: boolean }) => {
  const { t } = useTranslation();
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
      return t('resident.roomError');
    }
    return '';
  };

  const [lastSearchValue, setLastSearchValue] = useState('');
  const [medicalRecordsOpen, setMedicalRecordsOpen] = useState(false);
  const [medicationsOpen, setMedicationsOpen] = useState(false);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [labResultsOpen, setLabResultsOpen] = useState(false);
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
      case 'careLevel': return careLevelSearch ? t('resident.careLevelOption', { n: careLevelSearch }) : '';
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

  const handleViewVitals = (resident: Resident) => {
    setCurrentResident(resident);
    setVitalsOpen(true);
  };

  const handleViewProblems = (resident: Resident) => {
    setCurrentResident(resident);
    setProblemsOpen(true);
  };

  const handleViewLabs = (resident: Resident) => {
    setCurrentResident(resident);
    setLabResultsOpen(true);
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
      showSnackbar(t('roster.deletedOk', { name: resident.name }), 'success');
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
            <h2 className="text-xl font-semibold text-gray-900">{t('roster.searchTitle')}</h2>
          </div>

          <div className="max-w-4xl">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('roster.searchType')}</label>
              <select
                value={searchType}
                onChange={(e) => handleSearchTypeChange(e.target.value as SearchType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              >
                <option value="name">{t('resident.name')}</option>
                <option value="room">{t('resident.room')}</option>
                <option value="careLevel">{t('resident.careLevel')}</option>
                <option value="medication">{t('roster.medsColumn')}</option>
              </select>
            </div>

            <div className="mb-6">
              {searchType === 'name' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('roster.nameSearchLabel')}
                  </label>
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(convertSpacesToFullWidth(e.target.value))}
                    placeholder={t('roster.namePh')}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {t('roster.nameNote')}
                  </p>
                </div>
              )}

              {searchType === 'room' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('resident.room')}
                  </label>
                  <input
                    type="text"
                    value={roomSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRoomSearch(value);
                      setRoomNumberError(validateRoomNumber(value));
                    }}
                    placeholder={t('roster.roomPh')}
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
                    {roomNumberError || t('resident.roomNote')}
                  </p>
                </div>
              )}

              {searchType === 'medication' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('roster.drugName')}
                  </label>
                  <input
                    type="text"
                    value={medicationSearch}
                    onChange={(e) => setMedicationSearch(e.target.value)}
                    placeholder={t('roster.drugPh')}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
              )}

              {searchType === 'careLevel' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('resident.careLevel')}
                  </label>
                  <select
                    value={careLevelSearch}
                    onChange={(e) => setCareLevelSearch(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  >
                    <option value={0}>{t('roster.selectPlaceholder')}</option>
                    <option value={1}>{t('resident.careLevelOption', { n: 1 })}</option>
                    <option value={2}>{t('resident.careLevelOption', { n: 2 })}</option>
                    <option value={3}>{t('resident.careLevelOption', { n: 3 })}</option>
                    <option value={4}>{t('resident.careLevelOption', { n: 4 })}</option>
                    <option value={5}>{t('resident.careLevelOption', { n: 5 })}</option>
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
                {t('roster.clear')}
              </button>
              <button
                onClick={handleSearch}
                disabled={loading || (searchType === 'room' && !!roomNumberError)}
                className="inline-flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors duration-200 gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('common.searching')}
                  </>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    {t('roster.search')}
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
                  {hasSearched ? t('roster.searchResults') : t('roster.listTitle')}
                  {refreshing && (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-400">
                      <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></span>
                      {t('roster.refreshing')}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-600">
                  {hasSearched && lastSearchValue
                    ? t('roster.resultCount', { term: lastSearchValue, count: displayed.length })
                    : t('roster.activeCount', { count: displayed.length })}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1 text-gray-700">
                  {t('roster.sort')}
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as 'room' | 'name' | 'careLevel')}
                    className="px-2 py-1 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="room">{t('roster.sortRoom')}</option>
                    <option value="name">{t('roster.sortName')}</option>
                    <option value="careLevel">{t('roster.sortCareLevel')}</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-gray-700">
                  <input type="checkbox" checked={showDischarged} onChange={(e) => setShowDischarged(e.target.checked)} />
                  {t('roster.showDischarged')}
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
                <p className="text-gray-600 font-medium">{hasSearched ? t('roster.noResults') : t('roster.noResidents')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 whitespace-nowrap">{t('resident.name')}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 whitespace-nowrap">{t('resident.gender')}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 whitespace-nowrap">{t('roster.colAge')}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 whitespace-nowrap">{t('roster.colRoom')}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 whitespace-nowrap">{t('resident.careLevel')}</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[180px]">{t('roster.medsColumn')}</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[180px]">{t('roster.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((resident) => (
                      <tr key={resident.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 ${resident.dischargeDate ? 'opacity-60' : ''}`}>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full shrink-0 ${resident.dischargeDate ? 'bg-gray-400' : 'bg-green-500'}`}
                              title={resident.dischargeDate ? t('roster.dischargedTooltip', { date: dayjs(resident.dischargeDate).format('YYYY年MM月DD日') }) : t('roster.statusActive')}
                            />
                            <div className="leading-tight">
                              <div className="text-[11px] text-gray-500 leading-none">{resident.furigana}</div>
                              <div className="text-sm font-semibold text-gray-900">{resident.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-gray-700">{t(resident.gender === '男性' ? 'resident.male' : 'resident.female')}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-gray-700">{t('roster.ageValue', { age: calculateAge(resident.birthDate) })}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                            {resident.roomNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {t('resident.careLevelOption', { n: resident.careLevel })}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {(medsByResident.get(resident.id) ?? []).length === 0 ? (
                            <span className="text-sm text-gray-400">-</span>
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
                          <div className="flex gap-1 justify-center">
                            <RecordsMenu
                              resident={resident}
                              onRecords={handleViewMedicalRecords}
                              onProblems={handleViewProblems}
                              onVitals={handleViewVitals}
                              onLabs={handleViewLabs}
                              onMeds={handleViewMedications}
                            />
                            <button
                              onClick={() => handleViewResident(resident)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-150"
                              title={t('roster.actionDetail')}
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditResident(resident)}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors duration-150"
                              title={t('common.edit')}
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteResident(resident)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-150"
                              title={t('roster.actionDelete')}
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

      {currentResident && (
        <VitalsManager
          resident={currentResident}
          open={vitalsOpen}
          onClose={() => {
            setVitalsOpen(false);
            setCurrentResident(null);
          }}
        />
      )}

      {currentResident && (
        <ProblemsManager
          resident={currentResident}
          open={problemsOpen}
          onClose={() => {
            setProblemsOpen(false);
            setCurrentResident(null);
          }}
        />
      )}

      {currentResident && (
        <LabResultsManager
          resident={currentResident}
          open={labResultsOpen}
          onClose={() => {
            setLabResultsOpen(false);
            setCurrentResident(null);
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
              title={t('roster.detailTitle', { name: viewingResident.name })}
              subtitle={t('resident.subtitle', { gender: t(viewingResident.gender === '男性' ? 'resident.male' : 'resident.female'), age: calculateAge(viewingResident.birthDate), room: viewingResident.roomNumber })}
              icon={UserIcon}
              onClose={() => setViewingResident(null)}
            />
            <div className="p-6">
              <div className="mb-4">
                {viewingResident.dischargeDate ? (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-200 text-gray-700 rounded-full">{t('roster.dischargedFull')}</span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">{t('roster.statusActive')}</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.name')}</label>
                  <p className="text-lg font-medium text-gray-900">{viewingResident.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.furigana')}</label>
                  <p className="text-lg font-medium text-gray-900">{viewingResident.furigana}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.gender')}</label>
                  <p className="text-lg font-medium text-gray-900">{t(viewingResident.gender === '男性' ? 'resident.male' : 'resident.female')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.birthDate')}</label>
                  <p className="text-lg font-medium text-gray-900">
                    {t('roster.birthDateValue', { date: dayjs(viewingResident.birthDate).format('YYYY年MM月DD日'), age: calculateAge(viewingResident.birthDate) })}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.room')}</label>
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">
                    {viewingResident.roomNumber}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.careLevel')}</label>
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                    {t('resident.careLevelOption', { n: viewingResident.careLevel })}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.admissionDate')}</label>
                  <p className="text-lg font-medium text-gray-900">
                    {dayjs(viewingResident.admissionDate).format('YYYY年MM月DD日')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('roster.dischargeDate')}</label>
                  <p className="text-lg font-medium text-gray-900">
                    {viewingResident.dischargeDate ? dayjs(viewingResident.dischargeDate).format('YYYY年MM月DD日') : '-'}
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 mb-1">{t('resident.allergy')}</label>
                {viewingResident.allergyStatus === 'あり' ? (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-red-100 text-red-800 rounded-full">
                    {viewingResident.allergies || t('resident.allergyPresent')}
                  </span>
                ) : viewingResident.allergyStatus === 'なし' ? (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                    {t('roster.noAllergy')}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-amber-100 text-amber-800 rounded-full">
                    {t('resident.allergyUnknown')}
                  </span>
                )}
              </div>
              {viewingResident.medicalHistory && (
                <div>
                  <hr className="my-4 border-gray-200" />
                  <label className="block text-sm font-medium text-gray-500 mb-2">{t('resident.medicalHistory')}</label>
                  <p className="text-gray-700">{viewingResident.medicalHistory}</p>
                </div>
              )}
              <div className="mt-6 pt-3 border-t border-gray-100 text-xs text-gray-400">
                {t('common.createdBy', { name: viewingResident.createdBy?.name ?? '-', date: dayjs(viewingResident.createdAt).format('YYYY/MM/DD HH:mm') })}
                {viewingResident.updatedBy && (
                  <> / {t('common.updatedBy', { name: viewingResident.updatedBy.name, date: dayjs(viewingResident.updatedAt).format('YYYY/MM/DD HH:mm') })}</>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setViewingResident(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmDialog.open && !!deleteConfirmDialog.resident}
        title={t('roster.deleteConfirmTitle')}
        message={deleteConfirmDialog.resident
          ? t('roster.deleteConfirmMsg', { name: deleteConfirmDialog.resident.name, room: deleteConfirmDialog.resident.roomNumber, age: calculateAge(deleteConfirmDialog.resident.birthDate), care: deleteConfirmDialog.resident.careLevel })
          : ''}
        note={t('common.deleteNote')}
        confirmButtonText={t('common.delete')}
        confirmButtonVariant="danger"
        onConfirm={confirmDeleteResident}
        onCancel={() => setDeleteConfirmDialog({ open: false, resident: null })}
      />

      {/* Notification */}
      <Snackbar open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={handleCloseSnackbar} />
    </div>
  );
};

export default SearchPanel;