import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  status: 'ACTIVE' | 'COOLING_DOWN' | 'CHECKPOINT_REQUIRED';
  lastUsed: string;
}

export default function AdaptiveAgentPanel() {
  // Brain config state
  const [brainMode, setBrainMode] = useState<'EXTERNAL_API' | 'LOCAL_GGUF'>('EXTERNAL_API');
  const [gpuLayers, setGpuLayers] = useState(32);
  const [cpuThreads, setCpuThreads] = useState(4);
  const [contextSize, setContextSize] = useState(4096);
  const [temperature, setTemperature] = useState(0.2);

  // Social account CRUD state
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([
    { id: 'sa1', platform: 'Instagram', username: 'harvest_crawler_01', status: 'ACTIVE', lastUsed: '15 mins ago' },
    { id: 'sa2', platform: 'Facebook', username: 'meta_scout_live', status: 'ACTIVE', lastUsed: '2 hours ago' },
    { id: 'sa3', platform: 'Twitter/X', username: 'x_probe_stealth', status: 'COOLING_DOWN', lastUsed: '1 day ago' },
    { id: 'sa4', platform: 'LinkedIn', username: 'pro_indexer_ln', status: 'CHECKPOINT_REQUIRED', lastUsed: '3 days ago' },
  ]);

  const [newUsername, setNewUsername] = useState('');
  const [newPlatform, setNewPlatform] = useState('Instagram');

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    setSocialAccounts(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        platform: newPlatform,
        username: newUsername,
        status: 'ACTIVE',
        lastUsed: 'Just registered'
      }
    ]);
    setNewUsername('');
  };

  const handleToggleStatus = (id: string) => {
    setSocialAccounts(prev => prev.map(acc => {
      if (acc.id === id) {
        const nextStatus: SocialAccount['status'] =
          acc.status === 'ACTIVE' ? 'COOLING_DOWN' :
          acc.status === 'COOLING_DOWN' ? 'CHECKPOINT_REQUIRED' : 'ACTIVE';
        return { ...acc, status: nextStatus };
      }
      return acc;
    }));
  };

  const handleDeleteAccount = (id: string) => {
    setSocialAccounts(prev => prev.filter(acc => acc.id !== id));
  };

  return (
    <div className="space-y-6 font-mono text-slate-100">
      <div className="grid md:grid-cols-12 gap-6">

        {/* COLUMN 1: Agent Settings & Brain Panel (6 cols) */}
        <div className="md:col-span-6 space-y-6">
          <Card className="border-cyan-500/30 bg-slate-950/60 backdrop-blur-md">
            <CardHeader className="pb-2 border-b border-cyan-500/10">
              <CardTitle className="text-xs uppercase text-cyan-400 tracking-wider">
                // AGENT INFERENCE BRAIN SETUP
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Brain Mode Toggle */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-2 font-bold">
                  Inference Mode Selector
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1 rounded border border-cyan-500/10">
                  <button
                    onClick={() => setBrainMode('EXTERNAL_API')}
                    className={`text-xs py-1.5 font-bold uppercase rounded transition ${brainMode === 'EXTERNAL_API' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    External API (Cloud)
                  </button>
                  <button
                    onClick={() => setBrainMode('LOCAL_GGUF')}
                    className={`text-xs py-1.5 font-bold uppercase rounded transition ${brainMode === 'LOCAL_GGUF' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Local GGUF (llama-cpp)
                  </button>
                </div>
              </div>

              {brainMode === 'EXTERNAL_API' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase mb-1">API Endpoint</label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                      defaultValue="https://api.openai.com/v1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase mb-1">Secure Bearer Token</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••••••••••••••"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase mb-1">Active Model ID</label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                      defaultValue="gpt-4o-mini"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase mb-1">Local Model Path (.gguf)</label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                      defaultValue="./models/Qwen2-VL-7B-Instruct-Q4_K_M.gguf"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400 uppercase">GPU Offload Layers</span>
                        <span className="text-cyan-400 font-bold">{gpuLayers}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="64"
                        value={gpuLayers}
                        onChange={(e) => setGpuLayers(Number(e.target.value))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400 uppercase">CPU Threads</span>
                        <span className="text-cyan-400 font-bold">{cpuThreads}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="16"
                        value={cpuThreads}
                        onChange={(e) => setCpuThreads(Number(e.target.value))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400 uppercase">Context Size</span>
                        <span className="text-cyan-400 font-bold">{contextSize}</span>
                      </div>
                      <input
                        type="range"
                        min="1024"
                        max="16384"
                        step="1024"
                        value={contextSize}
                        onChange={(e) => setContextSize(Number(e.target.value))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400 uppercase">Temperature</span>
                        <span className="text-cyan-400 font-bold">{temperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                        className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMN 2: Social Accounts & Credentials Manager (6 cols) */}
        <div className="md:col-span-6 space-y-6">
          <Card className="border-cyan-500/30 bg-slate-950/60 backdrop-blur-md">
            <CardHeader className="pb-2 border-b border-cyan-500/10">
              <CardTitle className="text-xs uppercase text-cyan-400 tracking-wider">
                // SOCIAL ACCOUNTS MANAGER & CREDENTIALS
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Account Registration Form */}
              <form onSubmit={handleAddAccount} className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 text-slate-100"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Twitter/X">Twitter/X</option>
                    <option value="LinkedIn">LinkedIn</option>
                  </select>
                </div>
                <div className="col-span-5">
                  <input
                    type="text"
                    placeholder="account_handle"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="col-span-3">
                  <button
                    type="submit"
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold uppercase py-1.5 text-xs rounded transition"
                  >
                    REGISTER
                  </button>
                </div>
              </form>

              {/* Accounts CRUD table */}
              <div className="border border-slate-800 rounded overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-900/60 p-2 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                  <div className="col-span-3">Platform</div>
                  <div className="col-span-4">Username</div>
                  <div className="col-span-3 text-center">Status</div>
                  <div className="col-span-2 text-center">Actions</div>
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-slate-800">
                  {socialAccounts.map(acc => (
                    <div key={acc.id} className="grid grid-cols-12 p-2 text-xs items-center">
                      <div className="col-span-3 text-slate-300">{acc.platform}</div>
                      <div className="col-span-4 font-bold text-slate-100 truncate">@{acc.username}</div>
                      <div className="col-span-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(acc.id)}
                          className="focus:outline-none"
                        >
                          <Badge
                            variant={acc.status === 'ACTIVE' ? 'default' : acc.status === 'COOLING_DOWN' ? 'warning' : 'danger'}
                            className="text-[9px]"
                          >
                            {acc.status}
                          </Badge>
                        </button>
                      </div>
                      <div className="col-span-2 text-center">
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase"
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
