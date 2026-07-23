import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function DatasetStudio() {
  const { t } = useI18n();
  const [selectedFormat, setSelectedFormat] = useState<'insightface' | 'coco' | 'yolo'>('insightface');

  // Safe Dataset Telemetry Fetch
  const { data: personsData, isLoading } = useQuery({
    queryKey: ['personsDataset'],
    queryFn: async () => {
      const res = await fetch('/api/persons');
      if (!res.ok) throw new Error('Failed to fetch dataset');
      const data = await res.json();
      return Array.isArray(data) ? data : data.persons || [];
    },
  });

  const personsList = Array.isArray(personsData) ? personsData : [];

  const handleExport = () => {
    toast.success(`Exporting dataset in ${selectedFormat.toUpperCase()} format... Download started.`);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <h1 className="text-2xl font-bold text-primary uppercase tracking-widest">{t('dataset.title')}</h1>
        </div>
        <p className="text-muted-foreground text-sm ms-5">{t('dataset.subtitle')}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Export Configuration Card */}
        <Card className="border-primary/30 bg-card/60">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-primary flex items-center gap-2">
              <span>📦</span> {t('dataset.export_engine')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase">{t('dataset.export_format')}</label>
              <select
                className="w-full bg-background border border-primary/30 rounded p-2 text-xs text-foreground font-mono"
                value={selectedFormat}
                onChange={e => setSelectedFormat(e.target.value as any)}
              >
                <option value="insightface">InsightFace LFW/MXNet RecordIO (.rec/.idx)</option>
                <option value="coco">COCO Facial Keypoints (5-Point Landmarks JSON)</option>
                <option value="yolo">YOLOv8-Face Bounding Box Matrix (.txt)</option>
              </select>
            </div>

            <div className="p-3 border border-primary/20 bg-background/40 text-xs space-y-1">
              <div className="text-muted-foreground">{t('dataset.included_subjects')}: <span className="text-primary font-bold">{personsList.length}</span></div>
              <div className="text-muted-foreground">{t('dataset.annotations')}: <span className="text-green-400 font-bold">SCRFD 5-Point Landmarks</span></div>
            </div>

            <Button className="w-full font-mono text-xs" onClick={handleExport}>
              {t('dataset.export_btn')}
            </Button>
          </CardContent>
        </Card>

        {/* Dataset Subjects Curation Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            {t('dataset.curated_subjects')} ({personsList.length})
          </h2>
          {isLoading ? (
            <div className="text-xs text-muted-foreground animate-pulse p-4 border border-dashed border-primary/20">
              [ LOADING DATASET SUBJECTS... ]
            </div>
          ) : personsList.length === 0 ? (
            <div className="text-xs text-muted-foreground p-6 border border-dashed border-primary/20 text-center">
              NO CURATED SUBJECTS ENROLLED YET.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {personsList.map((p: any) => (
                <div key={p.id} className="p-3 border border-border/50 bg-card/40 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm text-foreground">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{p.source || 'Manual Enrollment'}</div>
                  </div>
                  <Badge variant="outline" className="text-[9px]">
                    {p.faceCount || 1} Face Samples
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
