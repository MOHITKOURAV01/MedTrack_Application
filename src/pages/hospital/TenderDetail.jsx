import React, { useState, useEffect, useMemo } from 'react';
import {
  getTender,
  publishTender,
  closeTenderRound,
  openTenderRound,
  awardTender,
  cancelTender,
  getTenderAuditTrail
} from '../../services/TenderService';

const TenderDetail = ({ tenderId, onNavigate }) => {
  const [tender, setTender] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  // New round modal
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [roundForm, setRoundForm] = useState({ round: 0, deadline: '' });

  // Award modal
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardBidId, setAwardBidId] = useState(null);
  const [awardReason, setAwardReason] = useState('');

  useEffect(() => {
    if (tenderId) {
      fetchAll();
    } else {
      // Reached without a tender id (`/tender`), there is nothing to fetch and the initial
      // `loading: true` would otherwise spin for ever. Fall through to the empty state.
      setLoading(false);
    }
  }, [tenderId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tenderData, auditData] = await Promise.all([
        getTender(tenderId),
        getTenderAuditTrail(tenderId).catch(() => [])
      ]);
      setTender(tenderData);
      setAuditTrail(auditData || []);
      setError('');
    } catch (err) {
      console.error('Error fetching tender:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load tender.');
    } finally {
      setLoading(false);
    }
  };

  const run = async (key, fn, successMessage) => {
    setBusy(key);
    setError('');
    try {
      const result = await fn();
      await fetchAll();
      if (successMessage) alert(successMessage);
      return { ok: true, result };
    } catch (err) {
      console.error(`Error in ${key}:`, err);
      setError(err.response?.data?.message || err.message || 'Action failed.');
      return { ok: false, result: null };
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = () =>
    run('publish', () => publishTender(tenderId), 'Tender published. Suppliers can now bid.');

  const handleCloseRound = () => {
    if (!window.confirm('Close this round? Bids already submitted will be final.')) return;
    run('close', () => closeTenderRound(tenderId), `Round ${tender.currentRound} closed.`);
  };

  const handleOpenRound = (e) => {
    e.preventDefault();
    if (!roundForm.deadline) {
      setError('A deadline is required for the new round.');
      return;
    }
    run('openRound', () =>
      openTenderRound(tenderId, {
        round: Number(roundForm.round),
        deadline: new Date(roundForm.deadline).toISOString()
      }),
      `Round ${roundForm.round} opened for bidding.`
    ).then(({ ok }) => {
      if (ok) setShowRoundModal(false);
    });
  };

  const handleAward = (e) => {
    e.preventDefault();
    if (!awardBidId) return;
    run('award', () =>
      awardTender(tenderId, { bidId: awardBidId, reason: awardReason.trim() || null }),
      'Tender awarded. All other bids were rejected and the decision is in the audit log.'
    ).then(({ ok }) => {
      if (ok) {
        setShowAwardModal(false);
        setAwardReason('');
        setAwardBidId(null);
      }
    });
  };

  const handleCancel = () => {
    if (!window.confirm('Cancel this tender? This cannot be undone.')) return;
    run('cancel', () => cancelTender(tenderId), 'Tender cancelled.');
  };

  // ---- Derived comparison data ------------------------------------------

  const currentRoundBids = useMemo(() => {
    if (!tender) return [];
    return (tender.bids || []).filter(b => b.roundNumber === tender.currentRound && b.status === 'SUBMITTED');
  }, [tender]);

  const bestValue = useMemo(() => {
    if (currentRoundBids.length === 0) return null;
    // Weighted score: 50% price competitiveness, 25% lead time, 25% delivery+quality performance.
    return currentRoundBids
      .map(bid => {
        const minPrice = Math.min(...currentRoundBids.map(b => b.bidAmount));
        const minLead = Math.min(...currentRoundBids.map(b => b.leadTimeDays || 999));
        const priceScore = minPrice > 0 ? (minPrice / bid.bidAmount) * 100 : 100;
        const leadScore = bid.leadTimeDays ? Math.max(0, 100 - ((bid.leadTimeDays - minLead) / minLead) * 20) : 50;
        const performance = ((bid.qualityScore || 0) + (bid.deliveryScore || 0)) / 2;
        const total = priceScore * 0.5 + leadScore * 0.25 + performance * 0.25;
        return { bid, total: Math.round(total * 100) / 100 };
      })
      .sort((a, b) => b.total - a.total)[0];
  }, [currentRoundBids]);

  // ---- Render helpers -----------------------------------------------------

  const getStatusBadge = (status) => {
    const colors = {
      'DRAFT': 'bg-gray-100 text-gray-700',
      'OPEN': 'bg-green-100 text-green-800',
      'CLOSED': 'bg-amber-100 text-amber-800',
      'AWARDED': 'bg-purple-100 text-purple-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getBidStatusBadge = (status) => {
    const colors = {
      'SUBMITTED': 'bg-blue-100 text-blue-800',
      'WITHDRAWN': 'bg-gray-100 text-gray-600',
      'ACCEPTED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action) => {
    const icons = {
      'TENDER_CREATED': '📝',
      'TENDER_PUBLISHED': '📣',
      'ROUND_OPENED': '🔓',
      'ROUND_CLOSED': '🔒',
      'BID_SUBMITTED': '💰',
      'BID_WITHDRAWN': '↩️',
      'TENDER_AWARDED': '🏆',
      'TENDER_CANCELLED': '❌'
    };
    return icons[action] || '📌';
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  };

  const buttonClass = "px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";
  const primary = `${buttonClass} bg-purple-600 hover:bg-purple-700 text-white`;
  const secondary = `${buttonClass} bg-gray-100 hover:bg-gray-200 text-gray-700`;
  const danger = `${buttonClass} bg-red-50 hover:bg-red-100 text-red-700`;

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!tender) {
    return (
      <div className="min-h-screen bg-blue-50 p-6">
        <div className="max-w-3xl mx-auto bg-card rounded-xl shadow-sm border border-subtle p-12 text-center">
          <h2 className="text-lg font-medium text-gray-800 mb-1">Tender not found</h2>
          <p className="text-sm text-secondary mb-6">{error || `No tender with id ${tenderId}.`}</p>
          <button onClick={() => onNavigate('tenders')} className={secondary}>Back to Tenders</button>
        </div>
      </div>
    );
  }

  const bidCount = (tender.bids || []).length;
  const currentRoundLiveBids = (tender.bids || []).filter(b => b.status === 'SUBMITTED' && b.roundNumber === tender.currentRound);
  const bidWindowOpen = tender.biddingOpen;
  const isAwarded = tender.awarded;
  const awardedBid = isAwarded ? (tender.bids || []).find(b => b.id === tender.awardedBidId) : null;

  return (
    <div className="min-h-screen bg-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{tender.title}</h2>
            <p className="text-sm text-secondary mt-1">{tender.tenderCode}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {tender.status === 'DRAFT' && (
              <button onClick={handlePublish} disabled={busy === 'publish'} className={primary}>
                {busy === 'publish' ? 'Publishing...' : 'Publish Tender'}
              </button>
            )}
            {tender.status === 'OPEN' && (
              <button onClick={handleCloseRound} disabled={busy === 'close'} className={secondary}>
                {busy === 'close' ? 'Closing...' : 'Close Round'}
              </button>
            )}
            {(tender.status === 'CLOSED' || tender.status === 'OPEN') && (
              <button
                onClick={() => {
                  setRoundForm({ round: (tender.currentRound || 0) + 1, deadline: '' });
                  setShowRoundModal(true);
                }}
                className={secondary}
              >
                Open Next Round
              </button>
            )}
            {(tender.status === 'CLOSED' || tender.status === 'OPEN') && (
              <button
                onClick={() => setShowAwardModal(true)}
                disabled={currentRoundBids.length === 0}
                className={primary}
              >
                Award Tender
              </button>
            )}
            {(tender.status === 'DRAFT' || tender.status === 'OPEN' || tender.status === 'CLOSED') && (
              <button onClick={handleCancel} disabled={busy === 'cancel'} className={danger}>
                Cancel Tender
              </button>
            )}
            <button onClick={() => onNavigate('tenders')} className={secondary}>Back</button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Tender summary */}
        <div className="bg-card rounded-xl shadow-sm border border-subtle p-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold">Status</p>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusBadge(tender.status)}`}>
                {tender.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold">Current Round</p>
              <p className="text-lg font-bold text-gray-800 mt-1">Round {tender.currentRound}</p>
            </div>
            <div>
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold">Bid Deadline</p>
              <p className="text-sm font-medium text-gray-800 mt-1">{formatDate(tender.deadline)}</p>
              {tender.status === 'OPEN' && (
                <p className="text-xs font-semibold mt-1">
                  {bidWindowOpen ? <span className="text-green-600">● Accepting bids</span> : <span className="text-red-600">● Deadline passed</span>}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold">Est. Budget</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(tender.estimatedBudget)}</p>
            </div>
            <div>
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold">Quantity</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{tender.quantity ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-secondary uppercase tracking-wider font-semibold">Category</p>
              <p className="text-lg font-bold text-gray-800 capitalize mt-1">{tender.category || '—'}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            {tender.description && (
              <div>
                <p className="text-xs text-secondary uppercase tracking-wider font-semibold mb-1">Description</p>
                <p className="text-gray-700 whitespace-pre-wrap">{tender.description}</p>
              </div>
            )}
            {tender.specifications && (
              <div>
                <p className="text-xs text-secondary uppercase tracking-wider font-semibold mb-1">Specifications</p>
                <p className="text-gray-700 whitespace-pre-wrap">{tender.specifications}</p>
              </div>
            )}
          </div>

          <div className="mt-5 text-sm">
            <p className="text-xs text-secondary uppercase tracking-wider font-semibold mb-1">Invited Suppliers ({tender.invitedSupplierEmails?.length || 0})</p>
            {tender.invitedSupplierEmails && tender.invitedSupplierEmails.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tender.invitedSupplierEmails.map(email => (
                  <span key={email} className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    {email}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-secondary">Open to all registered suppliers.</p>
            )}
          </div>
        </div>

        {/* Awarded banner */}
        {isAwarded && awardedBid && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">🏆 Tender Awarded</h3>
            <p className="text-sm text-green-800 mt-1">
              Won by <span className="font-semibold">{awardedBid.supplierName}</span> ({awardedBid.supplierEmail}) with a bid
              of <span className="font-semibold">{formatCurrency(awardedBid.bidAmount)}</span> in round {awardedBid.roundNumber}.
            </p>
            {tender.awardReason && (
              <p className="text-sm text-green-800 mt-2">
                <span className="font-semibold">Reason:</span> {tender.awardReason}
              </p>
            )}
            <p className="text-xs text-green-700 mt-2">Awarded {formatDate(tender.awardedAt)}</p>
          </div>
        )}

        {/* Side-by-side comparison */}
        <div className="bg-card rounded-xl shadow-sm border border-subtle overflow-hidden">
          <div className="px-6 py-4 border-b border-subtle flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Bid Comparison — Round {tender.currentRound}</h3>
              <p className="text-sm text-secondary">Price · Lead time · Quality score · Delivery performance</p>
            </div>
            <span className="text-sm text-secondary">{currentRoundLiveBids.length} live bid{currentRoundLiveBids.length !== 1 ? 's' : ''} · {bidCount} total</span>
          </div>

          {tender.bids && tender.bids.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" />
              </svg>
              <h4 className="text-lg font-medium text-gray-800 mb-1">No bids submitted yet</h4>
              <p className="text-sm text-secondary">
                {tender.status === 'DRAFT'
                  ? 'Publish the tender so invited suppliers can start bidding.'
                  : tender.status === 'OPEN'
                    ? 'Invited suppliers are reviewing the requirement. Bids will appear here.'
                    : 'No bids were received for this tender.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-subtle">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Round</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Lead Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Quality</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Delivery</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Submitted</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-secondary uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {[...(tender.bids || [])]
                    .sort((a, b) => a.roundNumber - b.roundNumber || new Date(a.submittedAt) - new Date(b.submittedAt))
                    .map(bid => {
                      const isWinner = isAwarded && bid.id === tender.awardedBidId;
                      const isBestValue = !isAwarded && bestValue && bestValue.bid.id === bid.id && bid.status === 'SUBMITTED';
                      return (
                        <tr key={bid.id} className={`hover:bg-gray-50 ${isWinner ? 'bg-green-50' : isBestValue ? 'bg-blue-50/50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800 flex items-center gap-2">
                              {bid.supplierName}
                              {isWinner && <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded-full">WINNER</span>}
                              {isBestValue && <span className="inline-flex px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">BEST VALUE</span>}
                            </div>
                            <div className="text-xs text-secondary">{bid.supplierEmail}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">R{bid.roundNumber}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{formatCurrency(bid.bidAmount)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {bid.leadTimeDays != null ? `${bid.leadTimeDays} day${bid.leadTimeDays !== 1 ? 's' : ''}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {bid.qualityScore != null ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${bid.qualityScore >= 80 ? 'bg-green-500' : bid.qualityScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${bid.qualityScore}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-gray-700">{bid.qualityScore}</span>
                              </div>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {bid.deliveryScore != null ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${bid.deliveryScore >= 80 ? 'bg-green-500' : bid.deliveryScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${bid.deliveryScore}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-gray-700">{bid.deliveryScore}</span>
                              </div>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(bid.submittedAt)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate" title={bid.notes || ''}>
                            {bid.notes || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getBidStatusBadge(bid.status)}`}>
                              {bid.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(tender.status === 'OPEN' || tender.status === 'CLOSED') && bid.status === 'SUBMITTED' && (
                              <button
                                onClick={() => {
                                  setAwardBidId(bid.id);
                                  setShowAwardModal(true);
                                }}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                Award
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick comparison summary */}
        {currentRoundBids.length > 1 && (
          <div className="bg-card rounded-xl shadow-sm border border-subtle p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Round {tender.currentRound} — Quick Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-secondary">Lowest Price</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(Math.min(...currentRoundBids.map(b => b.bidAmount)))}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-secondary">Fastest Delivery</p>
                <p className="text-2xl font-bold text-blue-700">
                  {Math.min(...currentRoundBids.map(b => b.leadTimeDays ?? 999))} days
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-secondary">Best Combined Performance</p>
                <p className="text-2xl font-bold text-blue-700">
                  {Math.max(...currentRoundBids.map(b => ((b.qualityScore || 0) + (b.deliveryScore || 0)) / 2))}/100
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-secondary">Best Value (weighted)</p>
                <p className="text-2xl font-bold text-purple-700">
                  {bestValue ? `${bestValue.total}` : '—'}
                </p>
                <p className="text-xs text-secondary mt-1">by {bestValue?.bid.supplierName}</p>
              </div>
            </div>
          </div>
        )}

        {/* Audit trail */}
        <div className="bg-card rounded-xl shadow-sm border border-subtle p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Audit Trail</h3>
          {auditTrail.length === 0 ? (
            <p className="text-sm text-secondary text-center py-8">No audit events recorded yet.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
              {auditTrail.map(event => (
                <div key={event.id} className="relative pl-10 pb-6 last:pb-0">
                  <div className="absolute left-3 top-1 w-2.5 h-2.5 rounded-full border-2 border-white bg-purple-500" />
                  <div className="bg-gray-50 rounded-lg p-4 border border-subtle/50">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{getActionIcon(event.action)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-gray-800">{event.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</h4>
                          <span className="text-xs text-secondary">{formatDate(event.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{event.detail}</p>
                        <p className="text-xs text-secondary mt-1">By: {event.actor}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New round modal */}
      {showRoundModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Open Round {roundForm.round}</h3>
            <form onSubmit={handleOpenRound} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">Round Deadline *</label>
                <input
                  type="datetime-local"
                  value={roundForm.deadline}
                  onChange={(e) => setRoundForm({ ...roundForm, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-subtle rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white"
                />
                <p className="text-xs text-secondary mt-1">
                  Round {roundForm.round} invites suppliers to improve on round {tender.currentRound} bids.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowRoundModal(false)} className={secondary}>Cancel</button>
                <button type="submit" disabled={busy === 'openRound'} className={primary}>
                  {busy === 'openRound' ? 'Opening...' : 'Open Round'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Award modal */}
      {showAwardModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Award Tender</h3>
            <p className="text-sm text-secondary mb-4">
              {awardBidId
                ? `Award to ${(tender.bids || []).find(b => b.id === awardBidId)?.supplierName}? All other live bids will be rejected.`
                : 'Select a bid to award the tender to.'}
            </p>
            <form onSubmit={handleAward} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">Winning Bid *</label>
                <select
                  value={awardBidId || ''}
                  onChange={(e) => setAwardBidId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-subtle rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white"
                >
                  <option value="" disabled>Select a bid...</option>
                  {currentRoundBids.map(bid => (
                    <option key={bid.id} value={bid.id}>
                      {bid.supplierName} — {formatCurrency(bid.bidAmount)} (R{bid.roundNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">Award Reason *</label>
                <textarea
                  value={awardReason}
                  onChange={(e) => setAwardReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="e.g. Best total cost of ownership with compliant lead time and quality score."
                  className="w-full px-3 py-2 border border-subtle rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white"
                />
                <p className="text-xs text-secondary mt-1">Stored in the audit trail for full transparency.</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowAwardModal(false); setAwardBidId(null); }} className={secondary}>Cancel</button>
                <button type="submit" disabled={busy === 'award' || !awardBidId} className={primary}>
                  {busy === 'award' ? 'Awarding...' : 'Award Tender'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenderDetail;
