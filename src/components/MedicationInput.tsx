import { useState } from 'react';

interface MedicationInputProps {
  medications: string[];
  onChange: (medications: string[]) => void;
  error?: boolean;
  helperText?: string;
}

const MedicationInput = ({ medications, onChange, error, helperText }: MedicationInputProps) => {
  const [currentMedication, setCurrentMedication] = useState('');

  const handleAddMedication = () => {
    const trimmed = currentMedication.trim();
    if (trimmed && !medications.includes(trimmed)) {
      onChange([...medications, trimmed]);
      setCurrentMedication('');
    }
  };

  const handleRemoveMedication = (medicationToRemove: string) => {
    onChange(medications.filter(med => med !== medicationToRemove));
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddMedication();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        処方薬
      </label>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
          }`}
          value={currentMedication}
          onChange={(e) => setCurrentMedication(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="薬名を入力（例：アリセプト）"
        />
        <button
          onClick={handleAddMedication}
          disabled={!currentMedication.trim()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium transition-all duration-200 hover:bg-green-700 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:bg-green-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>

      {medications.length > 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600 mb-3">
            登録済み処方薬 ({medications.length}件)
          </p>
          <div className="flex flex-wrap gap-2">
            {medications.map((medication, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 transition-colors duration-200"
              >
                {medication}
                <button
                  onClick={() => handleRemoveMedication(medication)}
                  className="ml-2 text-green-600 hover:text-red-600 transition-colors duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {medications.length === 0 && (
        <div className="p-4 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <p className="text-sm font-medium text-gray-600">
            💊 処方薬が登録されていません
          </p>
          <p className="text-xs text-gray-500 mt-1">
            上記のフォームから薬名を追加してください
          </p>
        </div>
      )}

      {helperText && (
        <p className={`text-xs mt-2 ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};

export default MedicationInput;