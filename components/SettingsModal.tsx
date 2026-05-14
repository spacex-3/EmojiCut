import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onSave: () => void;
}

export const STORAGE_KEYS = {
  API_KEY: 'emojicut_api_key',
  API_URL: 'emojicut_api_url',
  MODEL_NAME: 'emojicut_model_name',
  NAMING_MODEL: 'emojicut_naming_model',
  CUT_THRESHOLD: 'emojicut_cut_threshold'
};

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSave }) => {
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [namingModel, setNamingModel] = useState('');
  const [threshold, setThreshold] = useState(15);
  const [showSaved, setShowSaved] = useState(false);
  const [serverConfigured, setServerConfigured] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    const savedUrl = localStorage.getItem(STORAGE_KEYS.API_URL);
    const savedModel = localStorage.getItem(STORAGE_KEYS.MODEL_NAME);
    const savedNaming = localStorage.getItem(STORAGE_KEYS.NAMING_MODEL);
    const savedThreshold = localStorage.getItem(STORAGE_KEYS.CUT_THRESHOLD);

    if (savedKey) setApiKey(savedKey);
    if (savedUrl) setApiUrl(savedUrl);
    if (savedModel) setModelName(savedModel);
    if (savedNaming) setNamingModel(savedNaming);
    if (savedThreshold) setThreshold(Number(savedThreshold));

    fetch('/api/config', {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/json')) return;
        const data = await response.json();
        setServerConfigured(Boolean(data.serverConfigured));
      })
      .catch(() => {
        setServerConfigured(false);
      });
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
    localStorage.setItem(STORAGE_KEYS.API_URL, apiUrl);
    localStorage.setItem(STORAGE_KEYS.MODEL_NAME, modelName);
    localStorage.setItem(STORAGE_KEYS.NAMING_MODEL, namingModel);
    localStorage.setItem(STORAGE_KEYS.CUT_THRESHOLD, threshold.toString());

    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);
      onSave();
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border-2 border-pink-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            ⚙️ 设置
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* API Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">API 配置</h3>

            {serverConfigured && (
              <div className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-xl p-3 leading-relaxed">
                当前 API 由服务器/Docker 环境变量提供。下面的浏览器本地配置仅用于非 Docker 静态部署或本地调试。
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Gemini API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key here..."
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-pink-300 focus:ring focus:ring-pink-100 focus:ring-opacity-50 transition-all outline-none text-sm"
              />
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <AlertCircle size={12} />
                Key is stored locally in your browser
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                API Base URL (可选)
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="默认使用 Google 官方地址"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-pink-300 focus:ring focus:ring-pink-100 focus:ring-opacity-50 transition-all outline-none text-sm font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Model Name (可选)
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="默认: gemini-3-pro-image-preview"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-pink-300 focus:ring focus:ring-pink-100 focus:ring-opacity-50 transition-all outline-none text-sm font-mono"
              />
              <p className="text-xs text-gray-400">
                用于生成贴纸的模型。
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Naming Model (可选)
              </label>
              <input
                type="text"
                value={namingModel}
                onChange={(e) => setNamingModel(e.target.value)}
                placeholder="默认: gemini-2.5-flash"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-pink-300 focus:ring focus:ring-pink-100 focus:ring-opacity-50 transition-all outline-none text-sm font-mono"
              />
              <p className="text-xs text-gray-400">
                用于分析和命名贴纸的模型。
              </p>
            </div>
          </div>

          <div className="h-px bg-gray-100"></div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">高级设置</h3>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label className="font-medium text-gray-700">切割灵敏度</label>
                <span className="text-pink-500 font-bold">{threshold}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-pink-400"
              />
              <p className="text-xs text-gray-400">
                数值越小，切割越精细；数值越大，越容易将相邻物体合并。
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={handleSave}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
              ${showSaved ? 'bg-green-500' : 'bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500'}
            `}
          >
            {showSaved ? (
              <>已保存!</>
            ) : (
              <>
                <Save size={18} /> 保存设置
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
