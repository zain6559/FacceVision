import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function ApiKeys() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<number>(1);
  const [keyName, setKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Fetch Projects for dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/enterprise/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
  });

  // Fetch API Keys
  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['apiKeys', selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/enterprise/projects/${selectedProjectId}/api-keys`);
      if (!res.ok) throw new Error('Failed to fetch API keys');
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  // Generate Key Mutation
  const createKey = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/enterprise/projects/${selectedProjectId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName, role: 'SERVICE' }),
      });
      if (!res.ok) throw new Error('Failed to generate API Key');
      return res.json();
    },
    onSuccess: (data: any) => {
      toast.success('API Key generated!');
      setGeneratedKey(data.apiKey);
      setKeyName('');
      queryClient.invalidateQueries({ queryKey: ['apiKeys', selectedProjectId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h1 className="text-2xl font-bold text-primary uppercase tracking-widest">{t('apikeys.title')}</h1>
        </div>
        <p className="text-muted-foreground text-sm ms-5">{t('apikeys.subtitle')}</p>
      </div>

      {/* Generated Secret Modal / Alert */}
      {generatedKey && (
        <Card className="border-green-500 bg-green-500/10 p-4">
          <div className="text-xs font-bold text-green-400 mb-1">{t('apikeys.secret_generated')}</div>
          <div className="text-[10px] text-muted-foreground mb-2">{t('apikeys.secret_warning')}</div>
          <div className="flex gap-2">
            <Input readOnly value={generatedKey} className="font-mono text-xs bg-black text-green-400 border-green-500/50" />
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(generatedKey);
                toast.success('Copied to clipboard');
              }}
            >
              {t('apikeys.copy')}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Provision Form */}
        <Card className="border-primary/30 bg-card/60">
          <CardHeader>
            <CardTitle className="text-sm uppercase flex items-center gap-2">
              <span className="text-primary">🔑</span> {t('apikeys.provision_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">{t('apikeys.target_project')}</label>
              <select
                className="w-full bg-background border border-primary/30 rounded p-2 text-xs text-foreground"
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(Number(e.target.value))}
              >
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} (#{p.id})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">{t('apikeys.key_label')}</label>
              <Input
                placeholder="e.g. Production-SDK-Token"
                value={keyName}
                onChange={e => setKeyName(e.target.value)}
                className="bg-background/50 border-primary/30"
              />
            </div>
            <Button
              className="w-full font-mono text-xs"
              disabled={!keyName.trim() || createKey.isPending}
              onClick={() => createKey.mutate()}
            >
              {createKey.isPending ? t('apikeys.generating') : t('apikeys.generate')}
            </Button>
          </CardContent>
        </Card>

        {/* Active Keys List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">{t('apikeys.active_keys')} ({keys.length})</h2>
          {isLoading ? (
            <div className="text-xs text-muted-foreground animate-pulse">[ FETCHING KEYS... ]</div>
          ) : keys.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 border border-dashed border-primary/20 p-8 text-center uppercase">
              {t('apikeys.no_keys')}
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((k: any) => (
                <div key={k.id} className="flex justify-between items-center p-3 border border-border/50 bg-card/40">
                  <div>
                    <div className="text-xs font-bold">{k.keyName}</div>
                    <div className="text-[10px] text-primary/70 font-mono">{k.keyPrefix}...</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[9px]">{k.role}</Badge>
                    <span className="text-[9px] text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
