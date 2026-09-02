'use client';

import { useState } from 'react';
import { Star, Sparkles, Check, Heart, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CustomerFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableToken: string;
  tableLabel: string;
}

const FEEDBACK_TAGS = [
  '☕ Great Coffee',
  '⚡ Fast Service',
  '😋 Delicious Food',
  '✨ Clean & Cozy',
  '🙌 Friendly Staff',
  '💰 Value for Money',
];

export function CustomerFeedbackModal({
  isOpen,
  onClose,
  tableToken,
  tableLabel,
}: CustomerFeedbackModalProps) {
  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/customer/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: tableToken,
          rating,
          tags: selectedTags,
          comments,
        }),
      });

      // Confetti shower!
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch (e) {}

      setSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h2 className="text-base font-bold text-white">Rate Your Experience</h2>
            <p className="text-xs text-sky-400">Table {tableLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <Check className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Thank You for Your Feedback!</h3>
              <p className="text-xs text-gray-400 mt-1">
                We hope you loved your time with us. Here is a surprise reward for your next visit:
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Gift className="w-4 h-4" />
                <span>Next Visit Reward Coupon</span>
              </div>
              <p className="text-xl font-black text-white tracking-widest font-mono">CHAYA10FREE</p>
              <p className="text-[10px] text-gray-300">10% OFF or Free Cookie on your next order</p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs uppercase tracking-wider"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="py-4 space-y-4 overflow-y-auto">
            {/* Stars Picker */}
            <div className="text-center space-y-2">
              <p className="text-xs font-bold text-gray-300">How was your food and service?</p>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1 text-2xl transition-transform active:scale-125"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs font-semibold text-amber-400">
                {rating === 5 && '🌟 Outstanding! Loved everything.'}
                {rating === 4 && '😊 Great experience.'}
                {rating === 3 && '👍 Good, but room to improve.'}
                {rating <= 2 && '😔 We apologize. We will do better.'}
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 block">What stood out?</label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-gray-800/40 border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 block">Your Comments (Optional)</label>
              <textarea
                placeholder="Tell us what you liked or how we can improve..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-2xl bg-gray-800/80 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 hover:from-sky-600 hover:to-purple-600 text-white font-bold text-xs uppercase tracking-wider shadow-xl shadow-sky-500/25 transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review & Get Reward'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
