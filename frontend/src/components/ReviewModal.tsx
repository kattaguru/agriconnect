import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { api } from '../api';

interface ReviewModalProps {
  bookingId: number;
  workType: string;
  partnerName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  bookingId,
  workType,
  partnerName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.reviews.create({
        booking_id: bookingId,
        rating,
        comment: comment.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={22} />
        </button>

        <h3 style={{ fontSize: '1.35rem', marginBottom: 8 }}>Rate & Review</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>
          Work: <strong style={{ color: '#f8fafc' }}>{workType}</strong> with <strong style={{ color: '#f8fafc' }}>{partnerName}</strong>
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.88rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '20px 0' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <Star
                  size={36}
                  fill={(hoverRating || rating) >= star ? '#f59e0b' : 'none'}
                  stroke={(hoverRating || rating) >= star ? '#f59e0b' : '#64748b'}
                  style={{ transition: 'all 0.15s ease' }}
                />
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Feedback Comments (Optional)</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Was the work done punctually? Quality of work, communication..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
