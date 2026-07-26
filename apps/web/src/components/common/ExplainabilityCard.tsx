/**
 * FaceVision — Explainability Card
 * 
 * Shows why a recognition result was returned:
 * - Confidence score
 * - Matched features
 * - Model used
 * - Threshold used
 * - Evidence
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/common/QuickActions';

interface ExplanationFactor {
  category: 'QUALITY' | 'MATCH' | 'CONTEXT' | 'HISTORY';
  name: string;
  description: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  weight: number;
}

interface ExplainabilityCardProps {
  result: {
    identityId: number;
    name: string;
    confidence: number;
    decision: string;
    thumbnail?: string;
    threshold: number;
    model: string;
    embeddingVersion: string;
    factors: ExplanationFactor[];
  };
  className?: string;
}

export function ExplainabilityCard({ result, className }: ExplainabilityCardProps) {
  const categoryIcons = {
    QUALITY: 'eye',
    MATCH: 'check',
    CONTEXT: 'alert',
    HISTORY: 'chart',
  };

  const categoryColors = {
    QUALITY: 'border-blue-500/50',
    MATCH: 'border-green-500/50',
    CONTEXT: 'border-yellow-500/50',
    HISTORY: 'border-purple-500/50',
  };

  const impactColors = {
    POSITIVE: 'text-green-500',
    NEGATIVE: 'text-red-500',
    NEUTRAL: 'text-primary',
  };

  const decisionColors: Record<string, string> = {
    VERIFIED_MATCH: 'text-green-500 border-green-500/30',
    LIKELY_MATCH: 'text-yellow-500 border-yellow-500/30',
    UNLIKELY_MATCH: 'text-orange-500 border-orange-500/30',
    NO_MATCH: 'text-red-500 border-red-500/30',
    NEEDS_REVIEW: 'text-blue-500 border-blue-500/30',
  };

  return (
    <div className={cn("border bg-card/50 backdrop-blur-sm", className)}>
      {/* Header */}
      <div className="p-4 border-b border-primary/20">
        <div className="flex items-start gap-4">
          {result.thumbnail && (
            <img
              src={result.thumbnail}
              alt={result.name}
              className="w-16 h-16 object-cover border border-primary/30"
            />
          )}
          <div className="flex-1">
            <h3 className="text-lg font-mono font-semibold">{result.name}</h3>
            <p className="text-xs font-mono opacity-60">ID: {result.identityId}</p>
          </div>
          <div className={cn(
            "px-3 py-1 text-xs font-mono uppercase border",
            decisionColors[result.decision] || decisionColors.NO_MATCH
          )}>
            {result.decision.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Confidence Meter */}
      <div className="p-4 border-b border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase tracking-wider opacity-60">
            Confidence
          </span>
          <span className={cn(
            "text-lg font-mono font-bold",
            result.confidence >= result.threshold ? "text-green-500" : "text-yellow-500"
          )}>
            {(result.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-primary/20 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              result.confidence >= result.threshold ? "bg-green-500" : "bg-yellow-500"
            )}
            style={{ width: `${result.confidence * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-mono opacity-40">0%</span>
          <div className="relative">
            <div
              className="absolute -top-1 w-0.5 h-3 bg-primary"
              style={{ left: `${result.threshold * 100}%`, transform: 'translateX(-50%)' }}
            />
            <span className="text-[10px] font-mono opacity-40">
              Threshold: {(result.threshold * 100).toFixed(0)}%
            </span>
          </div>
          <span className="text-[10px] font-mono opacity-40">100%</span>
        </div>
      </div>

      {/* Model Info */}
      <div className="p-4 border-b border-primary/20">
        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <span className="opacity-60">Model</span>
            <p className="font-semibold mt-0.5">{result.model}</p>
          </div>
          <div>
            <span className="opacity-60">Version</span>
            <p className="font-semibold mt-0.5">{result.embeddingVersion}</p>
          </div>
        </div>
      </div>

      {/* Explanation Factors */}
      <div className="p-4">
        <h4 className="text-xs font-mono uppercase tracking-wider opacity-60 mb-3">
          Decision Factors
        </h4>
        <div className="space-y-2">
          {result.factors.map((factor, i) => (
            <div
              key={i}
              className={cn(
                "p-2 border-l-2 bg-card/30",
                categoryColors[factor.category]
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  name={categoryIcons[factor.category]}
                  className="w-3 h-3 opacity-60"
                />
                <span className="text-xs font-mono font-semibold">{factor.name}</span>
                <span className={cn(
                  "ml-auto text-[10px] font-mono",
                  impactColors[factor.impact]
                )}>
                  {factor.impact}
                </span>
              </div>
              <p className="text-[10px] font-mono opacity-60 mt-1">
                {factor.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono opacity-40">Weight:</span>
                <div className="flex-1 h-1 bg-primary/20">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${factor.weight * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono">{(factor.weight * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 border-t border-primary/20 bg-primary/5">
        <p className="text-xs font-mono text-center opacity-80">
          This match was{' '}
          <span className={cn(
            "font-semibold",
            result.confidence >= result.threshold ? "text-green-500" : "text-yellow-500"
          )}>
            {result.confidence >= result.threshold ? 'verified' : 'uncertain'}
          </span>{' '}
          based on {result.factors.length} factors.
        </p>
      </div>
    </div>
  );
}

// ─── Compact Result Card ────────────────────────────────────────────────────────

interface ResultCardProps {
  name: string;
  confidence: number;
  decision: string;
  thumbnail?: string;
  onClick?: () => void;
  className?: string;
}

export function ResultCard({ name, confidence, decision, thumbnail, onClick, className }: ResultCardProps) {
  const decisionColors: Record<string, string> = {
    VERIFIED_MATCH: 'border-green-500/50 text-green-500',
    LIKELY_MATCH: 'border-yellow-500/50 text-yellow-500',
    UNLIKELY_MATCH: 'border-orange-500/50 text-orange-500',
    NO_MATCH: 'border-red-500/50 text-red-500',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 border bg-card/50 hover:bg-card/80 transition-all text-left",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            className="w-10 h-10 object-cover border border-primary/30"
          />
        ) : (
          <div className="w-10 h-10 bg-primary/20 flex items-center justify-center">
            <Icon name="user" className="w-5 h-5 opacity-60" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold truncate">{name}</p>
          <p className="text-xs font-mono opacity-60">{(confidence * 100).toFixed(1)}%</p>
        </div>
        <div className={cn(
          "px-2 py-0.5 text-[10px] font-mono uppercase border",
          decisionColors[decision] || decisionColors.NO_MATCH
        )}>
          {decision.split('_')[0]}
        </div>
      </div>
    </button>
  );
}
