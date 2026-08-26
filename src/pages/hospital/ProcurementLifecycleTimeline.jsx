import React, { useState, useEffect } from 'react';
import { getProcurementAuditTrail, listQuotesForRequest, listReceivingRecords, listInvoiceMatches } from '../../services/ProcurementService';

const ProcurementLifecycleTimeline = ({ requestId, onNavigate }) => {
  const [request, setRequest] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [receivingRecords, setReceivingRecords] = useState([]);
  const [invoiceMatches, setInvoiceMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reached without a request id (`/procurement-timeline`), there is nothing to fetch and the
    // initial `loading: true` would otherwise spin for ever. Fall through to the empty state.
    if (requestId) fetchAllData();
    else setLoading(false);
  }, [requestId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [audit, quotesData, receiving, invoices] = await Promise.all([
        getProcurementAuditTrail(requestId),
        listQuotesForRequest(requestId),
        listReceivingRecords(requestId),
        listInvoiceMatches(requestId)
      ]);
      setAuditTrail(audit || []);
      setQuotes(quotesData || []);
      setReceivingRecords(receiving || []);
      setInvoiceMatches(invoices || []);
      // Extract request info from audit trail
      if (audit && audit.length > 0) {
        const latest = audit[0];
        setRequest({
          requestCode: latest.requestCode || `REQ-${requestId}`,
          equipmentName: latest.equipmentName,
          quantity: latest.quantity,
          totalCost: latest.totalCost,
          status: latest.status,
          urgency: latest.urgency,
          category: latest.category,
          requestedAt: latest.requestedAt,
          requesterName: latest.requesterName,
          requesterEmail: latest.requesterEmail
        });
      }
    } catch (err) {
      console.error('Error fetching lifecycle data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'REQUESTED': 'bg-blue-100 text-blue-800',
      'AWAITING_APPROVAL': 'bg-amber-100 text-amber-800',
      'APPROVED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'ORDERED': 'bg-purple-100 text-purple-800',
      'PARTIALLY_RECEIVED': 'bg-orange-100 text-orange-800',
      'RECEIVED': 'bg-teal-100 text-teal-800',
      'INVOICE_PENDING': 'bg-indigo-100 text-indigo-800',
      'INVOICE_MATCHED': 'bg-cyan-100 text-cyan-800',
      'CLOSED': 'bg-gray-100 text-gray-800',
      'CANCELLED': 'bg-gray-100 text-gray-600'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action) => {
    const icons = {
      'REQUEST_CREATED': '📝',
      'APPROVAL_STEP_DECIDED': '✅',
      'QUOTE_SUBMITTED': '💰',
      'QUOTE_ACCEPTED': '✅',
      'ORDER_CREATED': '📦',
      'RECEIVING_RECORDED': '📥',
      'INVOICE_MATCHED': '🧾',
      'REQUEST_CANCELLED': '❌',
      'REQUEST_CLOSED': '🔒'
    };
    return icons[action] || '📌';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  };

  const buildTimelineEvents = () => {
    const events = [];

    if (request) {
      events.push({
        id: 'start',
        timestamp: request.requestedAt,
        title: 'Request Created',
        description: `${request.equipmentName} × ${request.quantity} — ${request.category} — ${request.urgency}`,
        actor: request.requesterName,
        type: 'REQUEST_CREATED',
        status: 'completed'
      });
    }

    auditTrail.forEach(log => {
      events.push({
        id: log.id,
        timestamp: log.createdAt,
        title: log.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        description: log.detail,
        actor: log.actor,
        type: log.action,
        status: 'completed'
      });
    });

    quotes.forEach(quote => {
      events.push({
        id: `quote-${quote.id}`,
        timestamp: quote.submittedAt,
        title: quote.status === 'ACCEPTED' ? 'Quote Accepted' : 'Quote Submitted',
        description: `${quote.supplierName} — ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(quote.quoteAmount)} — ${quote.leadTimeDays} days`,
        actor: quote.supplierName,
        type: quote.status === 'ACCEPTED' ? 'QUOTE_ACCEPTED' : 'QUOTE_SUBMITTED',
        status: quote.status === 'ACCEPTED' ? 'completed' : 'pending'
      });
    });

    receivingRecords.forEach(record => {
      events.push({
        id: `receiving-${record.id}`,
        timestamp: record.receivedAt,
        title: 'Receiving Recorded',
        description: `${record.quantityReceived} units — ${record.condition} ${record.discrepancyNotes ? `— ${record.discrepancyNotes}` : ''}`,
        actor: record.receivedBy,
        type: 'RECEIVING_RECORDED',
        status: 'completed'
      });
    });

    invoiceMatches.forEach(invoice => {
      events.push({
        id: `invoice-${invoice.id}`,
        timestamp: invoice.matchedAt || invoice.createdAt,
        title: invoice.status === 'MATCHED' ? 'Invoice Matched' : 'Invoice Recorded',
        description: `Invoice ${invoice.invoiceNumber} — ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.invoiceAmount)} — ${invoice.status}`,
        actor: invoice.matchedBy,
        type: 'INVOICE_MATCHED',
        status: invoice.status === 'MATCHED' ? 'completed' : 'pending'
      });
    });

    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  const timelineEvents = buildTimelineEvents();

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Procurement Lifecycle</h2>
            <p className="text-sm text-secondary mt-1">{request?.requestCode || `Request ${requestId}`}</p>
          </div>
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Request header card */}
        {request && (
          <div className="bg-card rounded-xl shadow-sm border border-subtle p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-secondary">Equipment</p>
                <p className="font-medium text-gray-800">{request.equipmentName}</p>
              </div>
              <div>
                <p className="text-sm text-secondary">Quantity</p>
                <p className="font-medium text-gray-800">{request.quantity}</p>
              </div>
              <div>
                <p className="text-sm text-secondary">Total Cost</p>
                <p className="font-bold text-blue-700 text-lg">
                  {request.totalCost ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(request.totalCost) : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-secondary">Current Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                  {request.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-secondary">Urgency:</span> <span className="font-medium ml-1 capitalize">{request.urgency?.toLowerCase()}</span></div>
              <div><span className="text-secondary">Category:</span> <span className="font-medium ml-1 capitalize">{request.category?.toLowerCase().replace('_', ' ')}</span></div>
              <div><span className="text-secondary">Requested:</span> <span className="font-medium ml-1">{formatDate(request.requestedAt)}</span></div>
              <div><span className="text-secondary">Requester:</span> <span className="font-medium ml-1">{request.requesterName} ({request.requesterEmail})</span></div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-card rounded-xl shadow-sm border border-subtle p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Timeline</h3>

          {timelineEvents.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-secondary">No timeline events yet</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
              {timelineEvents.map((event, index) => (
                <div key={event.id} className="relative pl-16 pb-8 last:pb-0">
                  <div className="absolute left-6 top-1 w-3 h-3 rounded-full border-2 border-white flex-shrink-0"
                    style={{
                      backgroundColor: event.status === 'completed' ? '#22c55e' : '#f59e0b',
                      borderColor: event.status === 'completed' ? '#22c55e' : '#f59e0b'
                    }}
                  />
                  <div className="bg-gray-50 rounded-lg p-4 border border-subtle/50">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getActionIcon(event.type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-800">{event.title}</h4>
                          <span className="text-xs text-secondary">{formatDate(event.timestamp)}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
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
    </div>
  );
};

export default ProcurementLifecycleTimeline;