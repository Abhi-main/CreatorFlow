import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import toast from 'react-hot-toast';

export default function ConnectMetaButton({ platform = 'facebook', onSuccess }) {
  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);
  const timerRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'META_CONNECTED') {
        finishedRef.current = true;
        clearInterval(timerRef.current);
        setLoading(false);
        onSuccess?.(event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(timerRef.current);
    };
  }, [onSuccess]);

  const handleConnect = async () => {
    setLoading(true);
    finishedRef.current = false;

    try {
      const endpoint = `/meta/${platform}/connect`;
      const { data } = await api.get(endpoint);
      const authUrl = data.data?.authUrl;

      if (!authUrl) throw new Error('No auth URL returned');

      popupRef.current = window.open(
        authUrl,
        'MetaOAuth',
        'width=600,height=700,left=200,top=100,scrollbars=yes'
      );

      timerRef.current = setInterval(() => {
        try {
          if (popupRef.current?.closed) {
            clearInterval(timerRef.current);
            if (!finishedRef.current) {
              setLoading(false);
            }
          }
        } catch {
          clearInterval(timerRef.current);
          setLoading(false);
        }
      }, 800);
    } catch {
      toast.error(`Failed to connect ${platform}. Try again.`);
      setLoading(false);
    }
  };

  const config = {
    facebook: {
      label: 'Connect Facebook',
      style: 'bg-[#1877F2] hover:bg-[#166fe5]',
      icon: '📘',
    },
    instagram: {
      label: 'Connect Instagram',
      style: 'bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] hover:opacity-90',
      icon: '📸',
    },
  };

  const { label, style, icon } = config[platform] || config.facebook;

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${style}`}
    >
      <span>{icon}</span>
      {loading ? (
        <span className="flex items-center gap-1">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Connecting...
        </span>
      ) : label}
    </button>
  );
}
