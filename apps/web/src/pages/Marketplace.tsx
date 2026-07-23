import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function Marketplace() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Fetch Plugins & Catalog
  const { data: pluginData, isLoading } = useQuery({
    queryKey: ['pluginsData'],
    queryFn: async () => {
      const res = await fetch('/api/plugins');
      if (!res.ok) throw new Error('Failed to fetch plugins');
      return res.json();
    },
  });

  // Fetch Webhooks
  const { data: webhooks = [] } = useQuery({
    queryKey: ['webhooksData'],
    queryFn: async () => {
      const res = await fetch('/api/webhooks');
      if (!res.ok) throw new Error('Failed to fetch webhooks');
      return res.json();
    },
  });

  // Toggle Plugin Mutation
  const togglePlugin = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/plugins/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle plugin');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Plugin state updated');
      queryClient.invalidateQueries({ queryKey: ['pluginsData'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Register Webhook Mutation
  const createWebhook = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: webhookName, url: webhookUrl }),
      });
      if (!res.ok) throw new Error('Failed to register webhook');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Webhook registered successfully');
      setWebhookName('');
      setWebhookUrl('');
      queryClient.invalidateQueries({ queryKey: ['webhooksData'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
          <h1 className="text-2xl font-bold text-primary uppercase tracking-widest">{t('marketplace.title')}</h1>
        </div>
        <p className="text-muted-foreground text-sm ms-5">{t('marketplace.subtitle')}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Plugins & Marketplace */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-primary/30 bg-card/60">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-primary flex items-center gap-2">
                <span>🧩</span> {t('marketplace.catalog')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="text-xs text-muted-foreground animate-pulse">[ LOADING MARKETPLACE CATALOG... ]</div>
              ) : (
                <div className="space-y-3">
                  {pluginData?.marketplaceCatalog?.map((p: any) => (
                    <div key={p.id} className="p-4 border border-border/50 bg-background/40 flex justify-between items-start">
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">v{p.version}</span>
                          {p.official && <Badge variant="default" className="text-[8px]">OFFICIAL</Badge>}
                          <Badge variant="outline" className="text-[8px]">{p.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                        <div className="text-[9px] text-muted-foreground/60">AUTHOR: {p.author} · HOOKS: {p.hooks.join(', ')}</div>
                      </div>

                      <Button
                        size="sm"
                        variant={p.enabled ? "outline" : "default"}
                        className="text-xs shrink-0"
                        onClick={() => togglePlugin.mutate({ id: p.id, enabled: !p.enabled })}
                      >
                        {p.enabled ? t('marketplace.disable') : t('marketplace.enable')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Webhooks Manager */}
        <div className="space-y-6">
          <Card className="border-primary/30 bg-card/60">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-primary flex items-center gap-2">
                <span>🔔</span> {t('marketplace.register_webhook')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t('marketplace.endpoint_name')}</label>
                <Input
                  placeholder="e.g. SOC Event Sink"
                  value={webhookName}
                  onChange={e => setWebhookName(e.target.value)}
                  className="bg-background/50 border-primary/30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase">{t('marketplace.webhook_url')}</label>
                <Input
                  placeholder="https://api.yourdomain.com/webhooks/facevision"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  className="bg-background/50 border-primary/30"
                />
              </div>
              <Button
                className="w-full font-mono text-xs"
                disabled={!webhookName.trim() || !webhookUrl.trim() || createWebhook.isPending}
                onClick={() => createWebhook.mutate()}
              >
                {createWebhook.isPending ? t('marketplace.registering') : t('marketplace.register')}
              </Button>
            </CardContent>
          </Card>

          {/* Subscribed Webhooks */}
          <Card className="border-primary/30 bg-card/60">
            <CardHeader>
              <CardTitle className="text-xs uppercase text-primary">{t('marketplace.subscribed_webhooks')} ({webhooks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {webhooks.map((w: any) => (
                <div key={w.id} className="p-2.5 border border-border/40 bg-background/50 text-xs">
                  <div className="font-bold text-foreground">{w.name}</div>
                  <div className="text-[10px] text-primary/70 truncate">{w.url}</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-1">SECRET: {w.secret.slice(0, 12)}...</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
