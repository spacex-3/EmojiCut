import React, { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import '../shojo.css';

interface LoginScreenProps {
  onAuthenticated: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '登录失败');
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="shojo-container min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-white/90 backdrop-blur-sm rounded-[32px] border-4 border-pink-100 shadow-2xl p-8 w-[90%] max-w-sm"
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-16 h-16 rounded-full bg-pink-100 text-pink-400 flex items-center justify-center">
            <Lock size={30} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-gray-800">EmojiCut 访问验证</h1>
            <p className="text-xs text-gray-400 mt-1">请输入管理员配置的访问密码</p>
          </div>
        </div>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="访问密码"
          autoFocus
          className="w-full px-4 py-3 rounded-2xl border-2 border-pink-100 focus:border-pink-300 focus:ring focus:ring-pink-100 focus:ring-opacity-50 transition-all outline-none text-sm"
        />

        {error && <div className="mt-3 text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2 text-center">{error}</div>}

        <button
          type="submit"
          disabled={!password || isSubmitting}
          className="w-full mt-5 py-3 rounded-2xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 disabled:opacity-60"
        >
          {isSubmitting ? <Sparkles size={18} className="animate-spin" /> : <Lock size={18} />}
          {isSubmitting ? '验证中...' : '进入'}
        </button>

        <p className="mt-4 text-[11px] text-gray-400 text-center">
          服务器不会保存上传图片、生成图片或生成记录。
        </p>
      </form>
    </div>
  );
};

export default LoginScreen;
