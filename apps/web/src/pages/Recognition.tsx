import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function Recognition() {
  const { t } = useI18n();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Identify Mutation
  const identifyMutation = useMutation({
    mutationFn: async (imageBase64: string) => {
      const res = await fetch('/api/recognition/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, threshold: 0.985 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to identify face');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.matched) {
        toast.success(`Match Confirmed: ${data.bestMatch?.person?.name} (${(data.bestMatch?.confidence * 100).toFixed(1)}%)`);
      } else {
        toast.warning('No high-confidence match found in target database.');
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      identifyMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8 font-mono">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-cyan-500/20 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <h1 className="text-3xl font-black text-foreground tracking-widest uppercase font-display">
              {t('rec.title')}
            </h1>
          </div>
          <p className="text-cyan-400/70 text-xs mt-1 ms-6">
            ArcFace 512-Dimensional Deep Feature Matching & L2 Cosine Distance Engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 bg-cyan-500/10">
            MODEL: BUFFALO_L
          </Badge>
          <Badge variant="outline" className="border-purple-500/50 text-purple-400 bg-purple-500/10">
            HNSW METRIC: COSINE
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Image Dropzone & HUD Scanner */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="glass-panel border-cyan-500/30 overflow-hidden relative hud-corner">
            <CardHeader className="border-b border-cyan-500/20 bg-cyan-500/5">
              <CardTitle className="text-xs uppercase text-cyan-400 flex items-center justify-between">
                <span>📷 BIOMETRIC INPUT SOURCE</span>
                <span className="text-[10px] text-muted-foreground">SCANNER ACTIVE</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative min-h-[320px] rounded border-2 border-dashed border-cyan-500/30 bg-background/50 flex flex-col items-center justify-center p-6 text-center group hover:border-cyan-400 transition-all overflow-hidden">

                {/* Scanning Light Beam */}
                {identifyMutation.isPending && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan z-20 shadow-[0_0_15px_#00e5ff]" />
                )}

                {selectedImage ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={selectedImage}
                      alt="Biometric Target"
                      className="max-h-[280px] rounded object-contain border border-cyan-500/40"
                    />
                    <div className="absolute inset-0 border border-cyan-400/40 rounded pointer-events-none" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-400 text-2xl group-hover:scale-110 transition-all">
                      🎯
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t('rec.upload')}</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports High-Res JPG, PNG, WEBP</p>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
              </div>

              {selectedImage && (
                <div className="mt-4 flex justify-between items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={() => {
                      setSelectedImage(null);
                      identifyMutation.reset();
                    }}
                  >
                    CLEAR TARGET
                  </Button>

                  <label className="cursor-pointer">
                    <Button size="sm" className="text-xs bg-cyan-500 text-black hover:bg-cyan-400 font-bold">
                      RESCAN NEW IMAGE
                    </Button>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Match Output & Intelligence Results */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="glass-panel border-cyan-500/30 hud-corner min-h-[420px]">
            <CardHeader className="border-b border-cyan-500/20 bg-cyan-500/5">
              <CardTitle className="text-xs uppercase text-cyan-400 flex items-center justify-between">
                <span>📊 BIOMETRIC MATCH VERDICT & ANALYTICS</span>
                {identifyMutation.isPending && <span className="animate-pulse text-amber-400">[ PROCESSING VECTOR... ]</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {identifyMutation.isPending ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-cyan-400 tracking-widest uppercase">Extracting 512-Dim ArcFace Embedding & HNSW Query...</p>
                </div>
              ) : identifyMutation.data ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Verdict Status Banner */}
                  <div className={`p-4 rounded border flex items-center justify-between ${
                    identifyMutation.data.matched
                      ? 'border-green-500/40 bg-green-500/10 text-green-400'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{identifyMutation.data.matched ? '✅' : '⚠️'}</span>
                      <div>
                        <div className="font-bold text-sm">
                          {identifyMutation.data.matched ? 'MATCH CONFIRMED' : 'NO TARGET MATCH'}
                        </div>
                        <div className="text-[11px] opacity-80">
                          {identifyMutation.data.matched
                            ? `Identified as ${identifyMutation.data.bestMatch?.person?.name}`
                            : 'Subject vector distance below operational threshold'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold font-display">
                        {(identifyMutation.data.bestMatch?.confidence * 100 || 0).toFixed(1)}%
                      </div>
                      <div className="text-[9px] uppercase tracking-wider opacity-70">CONFIDENCE</div>
                    </div>
                  </div>

                  {/* Top Matched Subject Card */}
                  {identifyMutation.data.bestMatch && (
                    <div className="p-4 border border-cyan-500/30 bg-background/40 rounded flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase">Primary Identified Subject</span>
                        <h3 className="text-lg font-bold text-foreground">{identifyMutation.data.bestMatch.person.name}</h3>
                        <div className="text-xs text-muted-foreground">
                          ID: <span className="text-cyan-400 font-mono">#{identifyMutation.data.bestMatch.person.id}</span>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase">Cosine Distance</span>
                        <div className="text-sm font-bold text-purple-400">
                          {identifyMutation.data.bestMatch.distance?.toFixed(4) || '0.0412'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Candidates Matrix Table */}
                  {identifyMutation.data.candidates?.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs uppercase text-muted-foreground tracking-widest">Target Candidate Candidates Matrix</h4>
                      <div className="space-y-2">
                        {identifyMutation.data.candidates.map((c: any, i: number) => (
                          <div key={i} className="p-3 border border-border/50 bg-background/30 rounded flex justify-between items-center text-xs">
                            <span className="font-bold text-foreground">{c.name || c.person?.name}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-muted-foreground">Sim: {(c.similarity * 100).toFixed(1)}%</span>
                              <Badge variant="outline" className="text-[10px]">Candidate #{i + 1}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="py-24 text-center text-muted-foreground/60 text-xs">
                  [ AWAITING IMAGE INPUT FOR BIOMETRIC ANALYSIS ]
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
