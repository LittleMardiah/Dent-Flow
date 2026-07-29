'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { ChevronLeft, ChevronRight, Heart, Shield, Smile, Activity } from 'lucide-react';

interface HealthTip {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const defaultTips: HealthTip[] = [
  {
    id: '1',
    title: 'Sikat Gigi 2 Kali Sehari',
    description: 'Sikat gigi di pagi hari setelah sarapan dan malam sebelum tidur untuk mencegah gigi berlubang.',
    icon: <Activity size={32} className="text-primary" />,
  },
  {
    id: '2',
    title: 'Kontrol Gigi Rutin 6 Bulan',
    description: 'Lakukan pemeriksaan gigi setiap 6 bulan untuk mendeteksi masalah sejak dini.',
    icon: <Heart size={32} className="text-primary" />,
  },
  {
    id: '3',
    title: 'Hindari Makanan Manis Berlebihan',
    description: 'Kurangi konsumsi gula dan makanan lengket yang dapat menyebabkan gigi berlubang.',
    icon: <Smile size={32} className="text-primary" />,
  },
  {
    id: '4',
    title: 'Gunakan Benang Gigi',
    description: 'Bersihkan sela-sela gigi dengan benang gigi untuk mencegah karang gigi.',
    icon: <Shield size={32} className="text-primary" />,
  },
];

interface HealthTipsCarouselProps {
  tips?: HealthTip[];
}

export const HealthTipsCarousel: React.FC<HealthTipsCarouselProps> = ({ tips = defaultTips }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % tips.length);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  useEffect(() => {
    const interval = setInterval(next, 5000);
    return () => clearInterval(interval);
  }, [tips.length]);

  if (!tips.length) return null;

  const currentTip = tips[currentIndex];

  return (
    <Card className="relative p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-3 bg-white rounded-xl shadow-sm">
          {currentTip.icon}
        </div>
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-800">{currentTip.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{currentTip.description}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-center gap-2 mt-4">
        {tips.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentIndex ? 'w-6 bg-primary' : 'w-2 bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Arrow buttons */}
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white shadow-md hover:bg-neutral transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white shadow-md hover:bg-neutral transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </Card>
  );
};
