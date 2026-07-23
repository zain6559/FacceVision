import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function Projects() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Fetch Projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/enterprise/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
  });

  // Create Project Mutation
  const createProject = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/enterprise/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Project created successfully');
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Fetch Collections for selected project
  const { data: collections = [] } = useQuery({
    queryKey: ['collections', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/enterprise/projects/${selectedProjectId}/collections`);
      if (!res.ok) throw new Error('Failed to fetch collections');
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h1 className="text-2xl font-bold text-primary uppercase tracking-widest">{t('projects.title')}</h1>
          </div>
          <p className="text-muted-foreground text-sm ms-5">{t('projects.subtitle')}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Create Project Form */}
        <Card className="border-primary/30 bg-card/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm uppercase flex items-center gap-2">
              <span className="text-primary">⊕</span> {t('projects.create_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">{t('projects.name')}</label>
              <Input
                placeholder="e.g. Security-Gate-Alpha"
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-background/50 border-primary/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">{t('projects.description')}</label>
              <Input
                placeholder="e.g. Primary biometric access control"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-background/50 border-primary/30"
              />
            </div>
            <Button
              className="w-full font-mono text-xs mt-2"
              disabled={!name.trim() || createProject.isPending}
              onClick={() => createProject.mutate()}
            >
              {createProject.isPending ? t('projects.creating') : t('projects.submit')}
            </Button>
          </CardContent>
        </Card>

        {/* Projects List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">{t('projects.active_workspaces')} ({projects.length})</h2>
          {isLoading ? (
            <div className="text-xs text-muted-foreground animate-pulse">[ LOADING PROJECTS... ]</div>
          ) : projects.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 border border-dashed border-primary/20 p-8 text-center uppercase">
              {t('projects.no_projects')}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.map((p: any) => (
                <motion.div
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  whileHover={{ scale: 1.01 }}
                  className={`p-4 border cursor-pointer transition-all ${selectedProjectId === p.id ? 'border-primary bg-primary/10' : 'border-border/60 bg-card/40 hover:border-primary/40'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-foreground">{p.name}</h3>
                    <Badge variant={p.status === 'active' ? 'default' : 'outline'} className="text-[9px]">
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{p.description || 'No description provided.'}</p>
                  <div className="flex justify-between text-[10px] text-muted-foreground/60">
                    <span>TENANT: {p.tenantId}</span>
                    <span>ID: #{p.id}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Selected Project Collections */}
          {selectedProjectId && (
            <Card className="border-primary/40 bg-card/80 mt-6">
              <CardHeader>
                <CardTitle className="text-xs uppercase text-primary">
                  {t('projects.collections_in')} #{selectedProjectId}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {collections.length === 0 ? (
                  <div className="text-xs text-muted-foreground/50 py-4">{t('projects.no_collections')}</div>
                ) : (
                  <div className="space-y-2">
                    {collections.map((c: any) => (
                      <div key={c.id} className="flex justify-between items-center p-2 border border-border/40 bg-background/50">
                        <div>
                          <div className="text-xs font-bold">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">{c.description}</div>
                        </div>
                        <Badge variant="outline" className="text-[9px]">
                          {c.subjectCount} Subjects
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
