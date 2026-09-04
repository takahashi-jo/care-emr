import { useState } from 'react';
import 'dayjs/locale/ja';
import { ArrowRightOnRectangleIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import LoginScreen from './components/LoginScreen';
import ResidentForm from './components/ResidentForm';
import SearchPanel from './components/SearchPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      className={value === index ? 'block' : 'hidden'}
    >
      {children}
    </div>
  );
}

const MainApp = () => {
  const { user, logout, loading } = useAuth();
  const [tabValue, setTabValue] = useState(0);


  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Logout error handled silently
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600 font-medium">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-blue-600 tracking-tight">
                  CareEMR
                </h1>
                <span className="text-sm text-gray-600 font-medium hidden sm:block">
                  介護施設電子カルテシステム
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700 hidden sm:block">
                  {user.displayName}
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setTabValue(0)}
                className={`px-6 py-4 text-sm font-medium transition-colors duration-200 border-b-2 ${
                  tabValue === 0
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center">
                  <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                  入所者検索
                </span>
              </button>
              <button
                onClick={() => setTabValue(1)}
                className={`px-6 py-4 text-sm font-medium transition-colors duration-200 border-b-2 ${
                  tabValue === 1
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  新規登録
                </span>
              </button>
            </nav>
          </div>
        </div>

        <TabPanel value={tabValue} index={0}>
          <SearchPanel active={tabValue === 0} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ResidentForm />
        </TabPanel>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;