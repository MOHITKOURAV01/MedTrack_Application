import React, { useEffect, useState } from "react";
import {
  getAllEquipment,
  deleteEquipment,
  getEquipmentById,
  importEquipmentCsv,
  previewEquipmentImport,
  getEquipmentImportHistory,
  getEquipmentQrCode,
  getEquipmentLifecycle,
  getEquipmentTimeline,
  createEquipmentLifecycleAction,
  approveEquipmentLifecycleAction,
  rejectEquipmentLifecycleAction,
  completeEquipmentLifecycleAction,
  // Retirement / disposal workflow (issue #744)
  requestEquipmentDisposal,
  getEquipmentDisposals,
  approveDisposal,
  rejectDisposal,
  recordDataSanitization,
  completeDisposal,
  downloadDisposalCertificate,
  // Facility locations (issue #745): the tree feeds the filter and the assign form, and the
  // history/assign calls back the location panel on the detail drawer.
  getLocationTree,
  getEquipmentLocationHistory,
  assignEquipmentToLocation,
} from "../../services/EquipmentService";
import { getBreadcrumbPath } from "../../components/hospital/LocationPicker";
import {
  IMPORT_HEADERS,
  IMPORT_COLUMN_GUIDANCE,
  parseImportFile,
  rowsToCsv,
  exportEquipmentCsv,
  exportEquipmentXlsx,
  buildImportTemplate,
} from "../../utils/equipmentImportExport";
import { useAuth } from "../../context/AuthContext";
import Pagination from "../../components/common/Pagination";
import QrScannerModal from "../../components/common/QrScannerModal";
import { computeEquipmentHealthScore, getEquipmentFailureRisk } from "../../services/AnalyticsService";
/* ===========================
   DEFAULT PUBLIC EQUIPMENT
   Visible to ALL users
=========================== */
const PUBLIC_EQUIPMENT = [
  {
    id: "EQ-001",
    name: "MRI Scanner",
    model: "GE Signa HDxt",
    department: "Radiology",
    status: "Operational",
  },
  {
    id: "EQ-002",
    name: "Ventilator",
    model: "Philips Trilogy",
    department: "ICU",
    status: "Operational",
  },
  {
    id: "EQ-003",
    name: "X-Ray Machine",
    model: "Siemens AX",
    department: "Emergency",
    status: "Maintenance",
  },
  {
    id: "EQ-004",
    name: "Ultrasound",
    model: "Sonosite Edge",
    department: "Cardiology",
    status: "Operational",
  },
  {
    id: "EQ-005",
    name: "First Aid Kit",
    model: "FA-PRO-500",
    department: "Emergency",
    status: "Operational",
  },
  {
    id: "EQ-006",
    name: "Stethoscope",
    model: "ST-CLASSIC",
    department: "Cardiology",
    status: "Operational",
  },
  {
    id: "EQ-007",
    name: "Blood Pressure Monitor",
    model: "BP-AUTO",
    department: "General Ward",
    status: "Operational",
  },
  {
    id: "EQ-008",
    name: "Digital Thermometer",
    model: "TEMP-001",
    department: "Nursing Station",
    status: "Operational",
  },
];

/* ===========================
   EQUIPMENT IMAGES
=========================== */
const EQUIPMENT_IMAGES = {
  mri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQl7fPv3AGiTlskFg0Ehetmi5OPa-grbbDihw&s",
  ventilator: "https://cpimg.tistatic.com/08907627/b/4/Ventilator-NICU-Eqp.jpg",
  "x-ray": "https://images.unsplash.com/photo-1581595220892-b0739db3ba8c",
  ultrasound: "https://images.unsplash.com/photo-1516549655169-df83a0774514",
  stethoscope: "https://m.media-amazon.com/images/I/51i5-G3clqS.jpg",
  default: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae",
};

export default function EquipmentList({ onNavigate }) {
  const { user } = useAuth();

  const formatMoney = (val) => {
    if (val === null || val === undefined || val === "") return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(val));
  };

  // Warranty status badge (issue #703). The backend serialises warrantyStatus with each item;
  // the local fallback keeps demo/default items rendering correctly when the field is absent.
  const resolveWarrantyStatus = (item) => {
    if (item.warrantyStatus) return item.warrantyStatus;
    if (!item.warrantyExpiry) return "NO_COVERAGE";
    const days = Math.floor((new Date(item.warrantyExpiry) - new Date()) / 86400000);
    if (days < 0) return "EXPIRED";
    if (days <= 90) return "EXPIRING_SOON";
    return "ACTIVE";
  };

  const warrantyBadgeLabel = (item) => {
    const status = resolveWarrantyStatus(item);
    if (status === "ACTIVE") return "Warranty Active";
    if (status === "EXPIRING_SOON") return "Warranty Expiring Soon";
    if (status === "EXPIRED") return "Warranty Expired";
    return "No Coverage";
  };

  const warrantyBadgeClass = (item) => {
    const status = resolveWarrantyStatus(item);
    if (status === "ACTIVE") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    if (status === "EXPIRING_SOON") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    if (status === "EXPIRED") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  };

  // Visual timeline styling (issue #704): per-event-type icon + dot colour.
  const timelineMeta = (type) => {
    const meta = {
      PURCHASED: { icon: "🛒", dot: "bg-blue-500" },
      REGISTERED: { icon: "📋", dot: "bg-sky-400" },
      ASSIGNED: { icon: "👤", dot: "bg-emerald-500" },
      MOVED: { icon: "🚚", dot: "bg-amber-500" },
      RETIRED: { icon: "🏁", dot: "bg-slate-500" },
      DISPOSED: { icon: "🗑️", dot: "bg-red-500" },
      REPLACED: { icon: "🔄", dot: "bg-indigo-500" },
      DEPRECIATION_SNAPSHOT: { icon: "💹", dot: "bg-teal-500" },
      MAINTENANCE_SCHEDULED: { icon: "🛠️", dot: "bg-orange-500" },
      MAINTENANCE_COMPLETED: { icon: "✅", dot: "bg-green-500" },
      MAINTENANCE_OVERDUE: { icon: "⚠️", dot: "bg-red-600" },
      WARRANTY_ALERT: { icon: "🛡️", dot: "bg-amber-400" },
      STATUS_CHANGED: { icon: "🔁", dot: "bg-violet-500" },
    };
    return meta[type] || { icon: "📌", dot: "bg-slate-400" };
  };

  const formatTimelineDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const [equipment, setEquipment] = useState([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [hoveredCard, setHoveredCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [equipmentDetails, setEquipmentDetails] = useState(null);
  const [detailsError, setDetailsError] = useState(null);
  const [lifecycleActions, setLifecycleActions] = useState([]);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState(null);
  const [lifecycleSaving, setLifecycleSaving] = useState(false);
  // Issue #704: aggregated visual timeline (purchase, maintenance, lifecycle, system events).
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState(null);
  const [lifecycleForm, setLifecycleForm] = useState({
    actionType: "TRANSFER",
    newDepartment: "",
    roomLocation: "",
    wardLocation: "",
    custodian: "",
    effectiveDate: "",
    replacementEquipmentId: "",
    depreciationAmount: "",
    notes: "",
  });

  // Retirement / disposal workflow (issue #744)
  const [disposalOpen, setDisposalOpen] = useState(false);
  const [disposalTarget, setDisposalTarget] = useState(null);
  const [disposalStep, setDisposalStep] = useState(1);
  const [disposalForm, setDisposalForm] = useState({
    disposalMethod: "SCRAP",
    disposalReason: "",
    effectiveDate: "",
    storesPatientData: false,
    dataSanitizationDetails: "",
    notes: "",
  });
  const [disposalSaving, setDisposalSaving] = useState(false);
  const [disposalError, setDisposalError] = useState(null);
  const [disposalSuccess, setDisposalSuccess] = useState(null);
  const [disposalRecords, setDisposalRecords] = useState([]);
  const [disposalRecordsLoading, setDisposalRecordsLoading] = useState(false);
  const [certDownloading, setCertDownloading] = useState(false);

  // CSV/Excel Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [importStep, setImportStep] = useState("select"); // select | preview | done
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Failure Risk
  const [failureRisk, setFailureRisk] = useState(null);
  const [failureRiskLoading, setFailureRiskLoading] = useState(false);

  // QR Code States
  const [qrCode, setQrCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);

  // Scanner States
  const [scannerOpen, setScannerOpen] = useState(false);

  // Facility Location tree, filter and assignment (issue #745)
  const [locationTree, setLocationTree] = useState([]);
  const [locationFilter, setLocationFilter] = useState(null);
  const [assignLocationId, setAssignLocationId] = useState("");
  const [assignEffectiveDate, setAssignEffectiveDate] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignMessage, setAssignMessage] = useState(null);
  const [assignError, setAssignError] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [locationHistoryLoading, setLocationHistoryLoading] = useState(false);

  useEffect(() => {
    fetchEquipment();
    loadLocationTree();
  }, []);

  const openImportModal = () => {
    setImportFile(null);
    setParsedRows([]);
    setImportStep("select");
    setImportPreview(null);
    setImportSummary(null);
    setImportError(null);
    setShowImportModal(true);
    fetchImportHistory();
  };

  const fetchImportHistory = async () => {
    try {
      setImportHistory(await getEquipmentImportHistory());
    } catch (err) {
      console.error("Failed to load import history", err);
    }
  };

  const downloadTemplate = (format) => buildImportTemplate(format);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const acceptFile = (file) => {
    const extension = file.name.split(".").pop().toLowerCase();
    if (["csv", "xlsx", "xls"].includes(extension)) {
      setImportFile(file);
      setImportError(null);
      setImportStep("select");
      setImportPreview(null);
      setImportSummary(null);
      parseImportFile(file).then((result) => {
        if (result.error) {
          setImportError(result.error);
          setParsedRows([]);
          return;
        }
        setParsedRows(result.rows);
        if (result.unknownHeaders.length > 0) {
          setImportError(
            `Ignored unrecognised column(s): ${result.unknownHeaders.join(", ")}. ` +
              "Make sure the required columns are named correctly (see template)."
          );
        } else {
          setImportError(null);
        }
      });
    } else {
      setImportError("Please upload a valid .csv or .xlsx file.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      acceptFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      acceptFile(e.target.files[0]);
    }
  };

  // The backend consumes one canonical CSV regardless of the uploaded format,
  // so the client-side parse normalises .xlsx/.xls/.csv before upload.
  const buildUploadFile = () => {
    const originalName = importFile ? importFile.name.replace(/\.(csv|xlsx|xls)$/i, "") : "equipment";
    // formulaSafe: false - this file goes to the import endpoint, not to a spreadsheet. The
    // anti-formula apostrophe is not interpreted by a CSV parser, so leaving the guard on would
    // store it as part of the value and every equipment code beginning with a dash would arrive one
    // character longer than the user typed it.
    return new File([rowsToCsv(parsedRows, { formulaSafe: false })], `${originalName}.csv`, {
      type: "text/csv",
    });
  };

  const handlePreviewSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) {
      setImportError("Please select a file first.");
      return;
    }
    if (parsedRows.length === 0) {
      setImportError("No data rows were found in the file.");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const preview = await previewEquipmentImport(buildUploadFile());
      setImportPreview(preview);
      setImportStep("preview");
    } catch (err) {
      console.error("Preview failed:", err);
      setImportError(err.response?.data?.message || "Failed to preview import. Please check template columns.");
    } finally {
      setImporting(false);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile || parsedRows.length === 0) {
      setImportError("Please select a valid file first.");
      return;
    }
    setImporting(true);
    setImportSummary(null);
    setImportError(null);
    try {
      const summary = await importEquipmentCsv(buildUploadFile());
      setImportSummary(summary);
      setImportStep("done");
      if (summary.successCount > 0) {
        fetchEquipment();
      }
      fetchImportHistory();
    } catch (err) {
      console.error("Import failed:", err);
      setImportError(err.response?.data?.message || "Failed to process import. Please check template columns.");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = (format) => {
    setExportMenuOpen(false);
    if (filtered.length === 0) {
      alert("No equipment matches the current filters to export.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "xlsx") {
      exportEquipmentXlsx(filtered, `equipment_inventory_${stamp}.xlsx`);
    } else {
      exportEquipmentCsv(filtered, `equipment_inventory_${stamp}.csv`);
    }
  };

  const mergeEquipment = (fetchedEquipment = []) => {
    const equipmentMap = new Map();

    PUBLIC_EQUIPMENT.forEach((item) => {
      equipmentMap.set(String(item.id), item);
    });

    fetchedEquipment.forEach((item) => {
      equipmentMap.set(String(item.id), item);
    });

    return Array.from(equipmentMap.values());
  };

  const loadLocationTree = async () => {
    try {
      setLocationTree(await getLocationTree());
    } catch (error) {
      console.error("Failed to load location tree", error);
      setLocationTree([]);
    }
  };

  const fetchEquipment = async (pageNum = 0, locationId = locationFilter) => {
    try {
      setLoading(true);
      const response = await getAllEquipment(pageNum, pageSize, locationId);
      const items = response?.content || response?.data || [];
      setEquipment(Array.isArray(items) ? mergeEquipment(items) : PUBLIC_EQUIPMENT);
      if (response?.totalPages) setTotalPages(response.totalPages);
      if (response?.page !== undefined) setPage(response.page);
    } catch (error) {
      console.error("Failed to fetch equipment", error);
      setEquipment(PUBLIC_EQUIPMENT);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    fetchEquipment(newPage);
  };

  const handleViewDetails = async (id) => {
    setSelectedEquipmentId(id);
    setDetailsLoading(true);
    setDetailsError(null);
    setEquipmentDetails(null);
    setQrCode(null);
    setQrError(null);
    setLifecycleActions([]);
    setLifecycleError(null);

    const isFallbackItem = String(id).startsWith("EQ-00");

    try {
      const publicEquipmentDetails = PUBLIC_EQUIPMENT.find(
        (item) => String(item.id) === String(id)
      );

      if (publicEquipmentDetails) {
        setEquipmentDetails(publicEquipmentDetails);
      } else {
        const data = await getEquipmentById(id);
        setEquipmentDetails(data);
      }

      // Fetch QR Code if it's a database item
      if (!isFallbackItem) {
        refreshLifecycle(id);
        refreshTimeline(id);
        refreshDisposalRecords(id);
        refreshFailureRisk(id);
        setQrLoading(true);
        try {
          const qrData = await getEquipmentQrCode(id);
          setQrCode(qrData.qrCode);
        } catch (err) {
          console.error("Failed to load QR code", err);
          setQrError("QR Code generation failed");
        } finally {
          setQrLoading(false);
        }
      }
    } catch (error) {
      console.error("Error fetching equipment details:", error);
      const errMsg =
        error.response?.data?.message || `Equipment not found with id: ${id}`;
      setDetailsError(errMsg);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleScanResult = (parsed) => {
    setScannerOpen(false);
    if (!parsed?.id) return;

    const match = equipment.find(
      (item) => String(item.id).toLowerCase() === String(parsed.id).toLowerCase()
    );

    // Open details for a local match, otherwise let the details fetch attempt
    // resolve it via the API (covers items on other pages).
    handleViewDetails(match ? match.id : parsed.id);
  };

  const refreshLifecycle = async (id = selectedEquipmentId) => {
    if (!id || String(id).startsWith("EQ-00")) return;
    setLifecycleLoading(true);
    setLifecycleError(null);
    try {
      setLifecycleActions(await getEquipmentLifecycle(id));
    } catch (error) {
      console.error("Failed to fetch equipment lifecycle", error);
      setLifecycleError(error.response?.data?.message || "Failed to load lifecycle history.");
    } finally {
      setLifecycleLoading(false);
    }
  };

  const refreshFailureRisk = async (id) => {
    setFailureRiskLoading(true);
    setFailureRisk(null);
    try {
      setFailureRisk(await getEquipmentFailureRisk(id));
    } catch (err) {
      console.error("Failed to load failure risk", err);
    } finally {
      setFailureRiskLoading(false);
    }
  };

  // Location history (issue #745): every assignment to a facility node, newest first.
  const refreshLocationHistory = async (id = selectedEquipmentId) => {
    if (!id || String(id).startsWith("EQ-00")) return;
    setLocationHistoryLoading(true);
    setLocationHistory([]);
    try {
      setLocationHistory(await getEquipmentLocationHistory(id));
    } catch (error) {
      console.error("Failed to fetch location history", error);
    } finally {
      setLocationHistoryLoading(false);
    }
  };

  // Flattened location options (indented by depth) for the assign + filter selects.
  const flattenedLocations = () => {
    const rows = [];
    const byParent = new Map();
    byParent.set("root", []);
    locationTree.forEach((loc) => {
      const key = loc.parentId == null ? "root" : loc.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(loc);
    });
    const walk = (parent, depth) => {
      (byParent.get(parent == null ? "root" : parent) || []).forEach((loc) => {
        rows.push({ ...loc, depth });
        walk(loc.id, depth + 1);
      });
    };
    walk(null, 0);
    return rows;
  };

  const handleLocationFilterChange = (e) => {
    const value = e.target.value ? Number(e.target.value) : null;
    setLocationFilter(value);
    fetchEquipment(0, value);
  };

  const handleAssignLocation = async () => {
    const equipmentId = selectedEquipmentId;
    if (!equipmentId || String(equipmentId).startsWith("EQ-00")) return;
    if (!assignLocationId) {
      setAssignError("Please choose a location.");
      setAssignMessage(null);
      return;
    }
    setAssignSaving(true);
    setAssignError(null);
    setAssignMessage(null);
    try {
      await assignEquipmentToLocation(equipmentId, {
        locationId: Number(assignLocationId),
        effectiveDate: assignEffectiveDate || null,
        notes: assignNotes || null,
      });
      setAssignMessage("Location updated.");
      setAssignNotes("");
      setAssignEffectiveDate("");
      setAssignLocationId("");
      refreshLocationHistory(equipmentId);
      fetchEquipment(page, locationFilter);
      const details = await getEquipmentById(equipmentId);
      if (equipmentDetails && equipmentDetails.id === equipmentId) {
        setEquipmentDetails(details);
      }
    } catch (error) {
      console.error("Failed to assign location", error);
      setAssignError(error.response?.data?.message || "Failed to update location.");
    } finally {
      setAssignSaving(false);
    }
  };

  // Issue #704: aggregated read-only timeline. Loaded with the details so the modal opens with
  // the full history; Refresh on the panel re-fetches both views.
  const refreshTimeline = async (id = selectedEquipmentId) => {
    if (!id || String(id).startsWith("EQ-00")) return;
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      setTimelineEntries(await getEquipmentTimeline(id));
    } catch (error) {
      console.error("Failed to fetch equipment timeline", error);
      setTimelineError(error.response?.data?.message || "Failed to load asset timeline.");
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleLifecycleChange = (field, value) => {
    setLifecycleForm((current) => ({ ...current, [field]: value }));
  };

  const handleLifecycleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedEquipmentId || String(selectedEquipmentId).startsWith("EQ-00")) return;
    setLifecycleSaving(true);
    setLifecycleError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(lifecycleForm).filter(([, value]) => value !== "")
      );
      if (payload.replacementEquipmentId) {
        payload.replacementEquipmentId = Number(payload.replacementEquipmentId);
      }
      if (payload.depreciationAmount) {
        payload.depreciationAmount = Number(payload.depreciationAmount);
      }
      await createEquipmentLifecycleAction(selectedEquipmentId, payload);
      setLifecycleForm({
        actionType: "TRANSFER",
        newDepartment: "",
        roomLocation: "",
        wardLocation: "",
        custodian: "",
        effectiveDate: "",
        replacementEquipmentId: "",
        depreciationAmount: "",
        notes: "",
      });
      await refreshLifecycle(selectedEquipmentId);
      await refreshTimeline(selectedEquipmentId);
    } catch (error) {
      console.error("Failed to save lifecycle action", error);
      setLifecycleError(error.response?.data?.message || "Failed to save lifecycle action.");
    } finally {
      setLifecycleSaving(false);
    }
  };

  const handleLifecycleWorkflow = async (actionId, action) => {
    setLifecycleSaving(true);
    setLifecycleError(null);
    try {
      if (action === "approve") await approveEquipmentLifecycleAction(actionId);
      if (action === "reject") await rejectEquipmentLifecycleAction(actionId, "Rejected from lifecycle panel");
      if (action === "complete") await completeEquipmentLifecycleAction(actionId);
      await refreshLifecycle(selectedEquipmentId);
      await refreshTimeline(selectedEquipmentId);
      if (selectedEquipmentId) {
        const data = await getEquipmentById(selectedEquipmentId);
        setEquipmentDetails(data);
      }
      fetchEquipment(page);
    } catch (error) {
      console.error("Failed to update lifecycle action", error);
      setLifecycleError(error.response?.data?.message || "Failed to update lifecycle action.");
    } finally {
      setLifecycleSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteEquipment(id);
        fetchEquipment();
      } catch (error) {
        alert("Failed to delete equipment. It might be linked to maintenance tasks.");
      }
    }
  };

  // ---------------------------------------------------------------------
  // Retirement / disposal workflow (issue #744)
  // ---------------------------------------------------------------------
  const openDisposalModal = (item) => {
    setDisposalTarget(item);
    setDisposalStep(1);
    setDisposalForm({
      disposalMethod: "SCRAP",
      disposalReason: "",
      effectiveDate: "",
      storesPatientData: false,
      dataSanitizationDetails: "",
      notes: "",
    });
    setDisposalError(null);
    setDisposalSuccess(null);
    setDisposalOpen(true);
  };

  const handleDisposalChange = (field, value) => {
    setDisposalForm((current) => ({ ...current, [field]: value }));
  };

  const handleDisposalSubmit = async (event) => {
    event.preventDefault();
    if (!disposalTarget) return;
    setDisposalSaving(true);
    setDisposalError(null);
    setDisposalSuccess(null);
    try {
      const payload = {
        ...disposalForm,
        effectiveDate: disposalForm.effectiveDate || undefined,
        dataSanitizationDetails: disposalForm.dataSanitizationDetails || undefined,
        notes: disposalForm.notes || undefined,
        disposalReason: disposalForm.disposalReason || undefined,
      };
      await requestEquipmentDisposal(disposalTarget.id, payload);
      setDisposalStep(3);
      setDisposalSuccess(
        "Disposal request submitted for manager approval. Once approved and completed, a certificate of disposal is generated automatically."
      );
      fetchEquipment(page);
    } catch (error) {
      console.error("Failed to submit disposal request", error);
      setDisposalError(error.response?.data?.message || "Failed to submit the disposal request.");
    } finally {
      setDisposalSaving(false);
    }
  };

  const refreshDisposalRecords = async (id = selectedEquipmentId) => {
    if (!id || String(id).startsWith("EQ-00")) return;
    setDisposalRecordsLoading(true);
    try {
      setDisposalRecords(await getEquipmentDisposals(id));
    } catch (error) {
      console.error("Failed to fetch disposal records", error);
      setDisposalRecords([]);
    } finally {
      setDisposalRecordsLoading(false);
    }
  };

  const handleDisposalWorkflow = async (disposalId, action) => {
    setDisposalSaving(true);
    setDisposalError(null);
    try {
      if (action === "approve") await approveDisposal(disposalId);
      if (action === "reject") await rejectDisposal(disposalId, "Rejected from equipment panel");
      if (action === "sanitize") await recordDataSanitization(disposalId, "Data wipe confirmed on device");
      if (action === "complete") await completeDisposal(disposalId);
      await refreshDisposalRecords(selectedEquipmentId);
      await refreshLifecycle(selectedEquipmentId);
      await refreshTimeline(selectedEquipmentId);
      if (selectedEquipmentId) {
        const data = await getEquipmentById(selectedEquipmentId);
        setEquipmentDetails(data);
      }
      fetchEquipment(page);
    } catch (error) {
      console.error("Failed to update disposal record", error);
      setDisposalError(error.response?.data?.message || "Failed to update the disposal record.");
    } finally {
      setDisposalSaving(false);
    }
  };

  const handleCertificateDownload = async (disposal) => {
    setCertDownloading(true);
    setDisposalError(null);
    try {
      const blob = await downloadDisposalCertificate(disposal.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `disposal-certificate-${disposal.certificateNumber || disposal.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download certificate", error);
      setDisposalError(error.response?.data?.message || "Failed to download the certificate of disposal.");
    } finally {
      setCertDownloading(false);
    }
  };

  const getImage = (name = "") => {
    const lower = name.toLowerCase();

    for (const key in EQUIPMENT_IMAGES) {
      if (lower.includes(key)) {
        return EQUIPMENT_IMAGES[key];
      }
    }

    return EQUIPMENT_IMAGES.default;
  };

  const departmentOptions = [
    "All",
    ...new Set(equipment.map((item) => item.department).filter(Boolean)),
  ];

  const statusOptions = [
    "All",
    ...new Set(equipment.map((item) => item.status || "Unknown").filter(Boolean)),
  ];

  const filtered = equipment.filter((item) => {
    const searchValue = search.toLowerCase().trim();
    const itemStatus = item.status || "Unknown";

    const matchesSearch =
      !searchValue ||
      item.name?.toLowerCase().includes(searchValue) ||
      String(item.id).toLowerCase().includes(searchValue) ||
      item.model?.toLowerCase().includes(searchValue) ||
      item.department?.toLowerCase().includes(searchValue) ||
      itemStatus.toLowerCase().includes(searchValue);

    const matchesDepartment =
      departmentFilter === "All" || item.department === departmentFilter;

    const matchesStatus = statusFilter === "All" || itemStatus === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-surface p-10 font-sans text-primary">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8 flex-wrap gap-5">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 m-0">
          Medical Equipment Inventory
        </h1>

        <div className="flex gap-4 items-center flex-wrap">
          <button
            onClick={() => setScannerOpen(true)}
            className="px-5 py-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-base font-semibold cursor-pointer shadow-sm transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50"
            title="Scan an equipment QR tag"
          >
            📷 Scan QR
          </button>

          <input
            type="text"
            placeholder="Search by name, ID, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-5 py-3 rounded-lg border border-subtle bg-surface text-primary w-72 text-base shadow-sm outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-5 py-3 rounded-lg border border-subtle bg-surface text-primary text-base shadow-sm outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          >
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department === "All" ? "All Departments" : department}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-5 py-3 rounded-lg border border-subtle bg-surface text-primary text-base shadow-sm outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "All" ? "All Statuses" : status}
              </option>
            ))}
          </select>

          {/* Hierarchical facility-location filter (issue #745): choosing a floor or facility
              also matches assets in every node beneath it. */}
          <select
            value={locationFilter ?? ""}
            onChange={handleLocationFilterChange}
            className="px-5 py-3 rounded-lg border border-subtle bg-surface text-primary text-base shadow-sm outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          >
            <option value="">All Locations</option>
            {flattenedLocations().map((loc) => (
              <option key={loc.id} value={loc.id}>
                {"\u00A0\u00A0".repeat(loc.depth)}
                {loc.name}
              </option>
            ))}
          </select>

          {user?.role === "hospital" && (
            <div className="flex gap-2 items-center">
              <div className="relative">
                <button
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-subtle px-6 py-3 rounded-lg text-base font-semibold cursor-pointer shadow-sm transition-colors flex items-center gap-2"
                  onClick={() => setExportMenuOpen((open) => !open)}
                  title="Export the current filtered view"
                >
                  📤 Export
                  <span className="text-xs">{exportMenuOpen ? "▲" : "▼"}</span>
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-xl border border-subtle bg-card shadow-xl z-40 overflow-hidden">
                    <button
                      className="w-full text-left px-5 py-3 text-sm font-semibold text-primary hover:bg-hover border-none bg-transparent cursor-pointer flex items-center gap-2"
                      onClick={() => handleExport("csv")}
                    >
                      📄 CSV
                    </button>
                    <button
                      className="w-full text-left px-5 py-3 text-sm font-semibold text-primary hover:bg-hover border-none bg-transparent cursor-pointer flex items-center gap-2"
                      onClick={() => handleExport("xlsx")}
                    >
                      📊 Excel
                    </button>
                  </div>
                )}
              </div>
              <button
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-subtle px-6 py-3 rounded-lg text-base font-semibold cursor-pointer shadow-sm transition-colors"
                onClick={openImportModal}
              >
                📥 Bulk Import
              </button>
              <button
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-subtle px-6 py-3 rounded-lg text-base font-semibold cursor-pointer shadow-sm transition-colors"
                onClick={() => onNavigate("retired-assets")}
                title="Searchable archive of decommissioned assets"
              >
                🏁 Retired Assets
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white border-none px-6 py-3 rounded-lg text-base font-semibold cursor-pointer shadow-md transition-colors"
                onClick={() => onNavigate("add-equipment")}
              >
                + Add Equipment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Result Summary */}
      <div className="mb-6 rounded-xl border border-subtle bg-card p-4 shadow-sm">
        <p className="text-primary font-semibold">
          Showing {filtered.length} of {equipment.length} equipment items (Page {page + 1} of {totalPages})
        </p>
        <p className="text-secondary text-sm mt-1">
          Department: {departmentFilter === "All" ? "All Departments" : departmentFilter}
          {" | "}
          Status: {statusFilter === "All" ? "All Statuses" : statusFilter}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-10 text-secondary font-semibold">
          Loading equipment inventory...
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-10 text-secondary">
          No equipment items match your current search or filters.
        </div>
      )}

      {/* Grid Section */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`bg-card rounded-xl overflow-hidden shadow-sm transition-all border border-subtle flex flex-col ${
                hoveredCard === item.id ? "transform -translate-y-1 shadow-lg" : ""
              }`}
              onMouseEnter={() => setHoveredCard(item.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <img
                src={getImage(item.name)}
                alt={item.name}
                className="w-full h-48 object-cover border-b border-subtle"
              />

              <div className="p-5 flex-grow flex flex-col">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {(() => {
                    const health = computeEquipmentHealthScore(item);
                    if (!health) return null;
                    const healthBadgeClass = health.color === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                             health.color === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                             'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
                    return (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase inline-block w-fit ${healthBadgeClass}`}>
                        Health: {health.score}
                      </span>
                    );
                  })()}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase inline-block w-fit ${
                      item.status === "Operational" || item.status === "ACTIVE"
                        ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                        : item.status === "Maintenance" || item.status === "NEEDS_MAINTENANCE" || item.status === "UNDER_MAINTENANCE"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {item.status || "Unknown"}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase inline-block w-fit ${warrantyBadgeClass(item)}`}>
                    {warrantyBadgeLabel(item)}
                  </span>
                </div>

                <h3 className="text-xl font-semibold mb-2 text-primary">
                  {item.name}
                </h3>

                <div className="text-sm text-secondary mb-1.5 flex items-center">
                  <span>
                    <strong>ID:</strong> {item.id}
                  </span>
                </div>

                <div className="text-sm text-secondary mb-1.5 flex items-center">
                  <span>
                    <strong>Department:</strong> {item.department || "N/A"}
                  </span>
                </div>

                <div className="text-sm text-secondary mb-1.5 flex items-center">
                  <span>
                    <strong>Model:</strong> {item.model || "N/A"}
                  </span>
                </div>

                <div className="mt-auto pt-4 border-t border-subtle flex justify-between items-center gap-2">
                  <button
                    onClick={() => handleViewDetails(item.id)}
                    className="flex-1 py-2 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer font-semibold text-sm transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  >
                    Details
                  </button>

                  {item.status !== "RETIRED" && item.status !== "DISPOSED" && (
                    <button
                      onClick={() => onNavigate("schedule-maintenance")}
                      className="flex-1 py-2 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer font-semibold text-sm transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    >
                      Schedule Service
                    </button>
                  )}

                  {/* Hide delete button for default public items */}
                  {user?.role === "hospital" &&
                    !String(item.id).startsWith("EQ-00") && (
                      <>
                        <button
                          onClick={() => onNavigate("edit-equipment", item.id)}
                          className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white border-none rounded-lg cursor-pointer font-semibold text-sm transition-colors shadow-sm"
                        >
                          Edit
                        </button>
                        {item.status !== "RETIRED" && item.status !== "DISPOSED" && (
                          <button
                            onClick={() => openDisposalModal(item)}
                            className="py-2 px-3 bg-slate-700 hover:bg-slate-800 text-white border-none rounded-lg cursor-pointer font-semibold text-sm transition-colors shadow-sm"
                            title="Start the retirement / disposal workflow for this asset"
                          >
                            🏁 Retire
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="py-2 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg cursor-pointer font-semibold text-sm transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
                        >
                          Delete
                        </button>
                      </>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}

      {/* Equipment Details Modal */}
      {selectedEquipmentId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-card rounded-3xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative border border-subtle">
            <button
              onClick={() => setSelectedEquipmentId(null)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-hover text-secondary border-none flex items-center justify-center text-xl font-bold cursor-pointer transition-colors hover:bg-subtle"
            >
              &times;
            </button>

            {detailsLoading && (
              <div className="text-center py-10 px-5">
                <div className="inline-block w-10 h-10 border-4 border-subtle border-t-blue-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-secondary font-semibold">
                  Fetching equipment details...
                </p>
              </div>
            )}

            {detailsError && (
              <div className="text-center p-5">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-primary mb-2">Not Found</h3>
                <p className="text-red-500 text-sm mb-6 font-medium">
                  {detailsError}
                </p>
                <button
                  onClick={() => setSelectedEquipmentId(null)}
                  className="bg-red-500 hover:bg-red-600 text-white border-none py-3 px-6 rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  Close
                </button>
              </div>
            )}

            {equipmentDetails && (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
                    ⚙️
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-primary m-0">
                      {equipmentDetails.name}
                    </h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide inline-block mt-1.5 ${
                        equipmentDetails.status === "Operational" || equipmentDetails.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : equipmentDetails.status === "Maintenance" || equipmentDetails.status === "NEEDS_MAINTENANCE" || equipmentDetails.status === "UNDER_MAINTENANCE"
                          ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {equipmentDetails.status || "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-4 bg-hover p-5 rounded-2xl mb-6">
                  <div>
                    <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                      Equipment ID
                    </span>
                    <p className="text-[15px] text-primary font-bold m-1 font-mono">
                      {equipmentDetails.id}
                    </p>
                  </div>
                  <div className="w-full h-px bg-subtle"></div>
                  <div>
                    <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                      Model Details
                    </span>
                    <p className="text-[15px] text-primary font-semibold m-1">
                      {equipmentDetails.model || "N/A"}
                    </p>
                  </div>
                  <div className="w-full h-px bg-subtle"></div>
                  <div>
                    <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                      Department / Location
                    </span>
                    <p className="text-[15px] text-primary font-semibold m-1">
                      {equipmentDetails.department || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Facility Location (issue #745): breadcrumb, reassignment and history */}
                <div className="mt-6 mb-6 p-5 bg-hover rounded-2xl border border-subtle">
                  <h3 className="text-lg font-extrabold text-primary m-0 mb-4">Facility Location</h3>

                  {/* Breadcrumb of the current location, walked up the parentId chain */}
                  {(() => {
                    const crumb = getBreadcrumbPath(locationTree, equipmentDetails.location?.id ?? null);
                    if (!crumb.length) {
                      return (
                        <p className="text-sm text-secondary font-medium">
                          No facility location assigned.
                        </p>
                      );
                    }
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        {crumb.map((node, index) => (
                          <React.Fragment key={node.id}>
                            {index > 0 && (
                              <span className="text-slate-400 font-bold select-none">›</span>
                            )}
                            <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-100 dark:border-blue-900">
                              {node.name}
                            </span>
                          </React.Fragment>
                        ))}
                        {equipmentDetails.locationEffectiveDate && (
                          <span className="text-xs text-secondary font-medium">
                            since {equipmentDetails.locationEffectiveDate}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={assignLocationId}
                      onChange={(e) => setAssignLocationId(e.target.value)}
                      className="px-4 py-3 rounded-xl border border-subtle bg-surface text-primary text-sm shadow-sm outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Reassign to location...</option>
                      {flattenedLocations().map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {"\u00A0\u00A0".repeat(loc.depth)}
                          {loc.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={assignEffectiveDate}
                      onChange={(e) => setAssignEffectiveDate(e.target.value)}
                      className="px-4 py-3 rounded-xl border border-subtle bg-surface text-primary text-sm shadow-sm outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                    <select
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      className="px-4 py-3 rounded-xl border border-subtle bg-surface text-primary text-sm shadow-sm outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Note (optional)</option>
                      <option value="Initial placement">Initial placement</option>
                      <option value="Transferred between departments">Transferred between departments</option>
                      <option value="Returned after maintenance">Returned after maintenance</option>
                      <option value="Relocated for renovation">Relocated for renovation</option>
                    </select>
                  </div>

                  {assignError && (
                    <p className="mt-3 text-sm text-red-500 font-medium">{assignError}</p>
                  )}
                  {assignMessage && (
                    <p className="mt-3 text-sm text-emerald-600 font-medium">{assignMessage}</p>
                  )}

                  <button
                    onClick={handleAssignLocation}
                    disabled={assignSaving}
                    className="mt-3 bg-blue-600 hover:bg-blue-700 text-white border-none px-6 py-3 rounded-xl text-sm font-bold cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                  >
                    {assignSaving ? "Updating..." : "Update Location"}
                  </button>

                  {/* Assignment history, newest first */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-primary m-0">Location History</h4>
                      <button
                        onClick={() => refreshLocationHistory(equipmentDetails.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-transparent border-none cursor-pointer"
                      >
                        Refresh
                      </button>
                    </div>
                    {locationHistoryLoading && (
                      <p className="text-sm text-secondary font-medium">Loading history...</p>
                    )}
                    {!locationHistoryLoading && locationHistory.length === 0 && (
                      <p className="text-sm text-secondary font-medium">
                        No location changes recorded.
                      </p>
                    )}
                    {!locationHistoryLoading &&
                      locationHistory.length > 0 && (
                        <ul className="space-y-2">
                          {locationHistory.map((entry) => {
                            const entryCrumb = getBreadcrumbPath(locationTree, entry.location?.id ?? null);
                            return (
                              <li
                                key={entry.id}
                                className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-subtle"
                              >
                                <span className="mt-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-primary m-0">
                                    {entry.location?.name || "Unknown location"}
                                  </p>
                                  {entryCrumb.length > 1 && (
                                    <p className="text-xs text-secondary font-medium m-0 truncate">
                                      {entryCrumb.slice(0, -1).map((node) => node.name).join(" / ")}
                                    </p>
                                  )}
                                  {(entry.notes || entry.movedBy || entry.effectiveDate) && (
                                    <p className="text-xs text-secondary font-medium m-0 mt-0.5">
                                      {[
                                        entry.effectiveDate,
                                        entry.movedBy ? `by ${entry.movedBy}` : null,
                                        entry.notes,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                  </div>
                </div>

                {/* Valuation Section (issue #702) */}
                {equipmentDetails.purchaseCost !== null && equipmentDetails.purchaseCost !== undefined && (
                  <div className="mt-6 mb-6 p-5 bg-hover rounded-2xl border border-subtle">
                    <h3 className="text-lg font-extrabold text-primary m-0 mb-4">Valuation</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Purchase Cost
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {formatMoney(equipmentDetails.purchaseCost)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Useful Life
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {equipmentDetails.usefulLifeYears ? `${equipmentDetails.usefulLifeYears} years` : "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Depreciation
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {(equipmentDetails.depreciationMethod || "STRAIGHT_LINE").replaceAll("_", " ")}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Book Value
                        </span>
                        <p className="text-[15px] text-emerald-600 font-black m-1">
                          {formatMoney(equipmentDetails.bookValue)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Depreciated To Date
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {formatMoney(equipmentDetails.accumulatedDepreciation)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Replacement Cost
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {formatMoney(equipmentDetails.projectedReplacementCost)}
                        </p>
                      </div>
                    </div>
                    {equipmentDetails.bookValue !== null && equipmentDetails.bookValue !== undefined
                      && Number(equipmentDetails.bookValue) === 0 && (
                      <p className="text-xs text-secondary font-semibold mt-4 mb-0">
                        This asset is fully depreciated.
                      </p>
                    )}
                  </div>
                )}

                {/* Health Score Drill-Down (issue #747) */}
                {(() => {
                  const health = computeEquipmentHealthScore(equipmentDetails);
                  if (!health) return null;
                  const healthColorClass = health.color === 'red' ? 'text-red-500' : health.color === 'amber' ? 'text-amber-500' : 'text-emerald-500';
                  return (
                    <div className="mt-6 mb-6 p-5 bg-hover rounded-2xl border border-subtle">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-extrabold text-primary m-0">Equipment Health Score</h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-black ${healthColorClass}`}>{health.score}</span>
                          <span className="text-sm font-bold text-secondary uppercase tracking-widest">/ 100</span>
                        </div>
                      </div>
                      <p className={`text-sm font-bold mb-4 ${healthColorClass}`}>
                        Status: {health.label}
                      </p>
                      <div className="space-y-3">
                        {health.factors.map((factor, idx) => (
                          <div key={idx} className="p-3 bg-surface border border-subtle rounded-xl flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-primary uppercase tracking-wider">{factor.label}</span>
                              <span className={`text-xs font-black ${parseInt(factor.impact) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {parseInt(factor.impact) > 0 ? '+' : ''}{factor.impact} pts
                              </span>
                            </div>
                            <span className="text-xs text-secondary font-medium">{factor.recommendation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Predictive Maintenance / Failure Risk (issue #793) */}
                {(() => {
                  if (failureRiskLoading) {
                    return (
                      <div className="mt-6 mb-6 p-5 bg-hover rounded-2xl border border-subtle flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    );
                  }
                  if (!failureRisk) return null;
                  
                  const getRiskColor = (tier) => {
                    switch(tier) {
                      case 'CRITICAL': return 'text-red-600 bg-red-100';
                      case 'HIGH': return 'text-amber-600 bg-amber-100';
                      case 'MODERATE': return 'text-yellow-600 bg-yellow-100';
                      default: return 'text-emerald-600 bg-emerald-100';
                    }
                  };

                  const getRiskBarColor = (tier) => {
                    switch(tier) {
                      case 'CRITICAL': return 'bg-red-500';
                      case 'HIGH': return 'bg-amber-500';
                      case 'MODERATE': return 'bg-yellow-500';
                      default: return 'bg-emerald-500';
                    }
                  };

                  return (
                    <div className="mt-6 mb-6 p-5 bg-hover rounded-2xl border border-subtle">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-extrabold text-primary m-0">Failure Prediction</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRiskColor(failureRisk.riskTier)}`}>
                          {failureRisk.riskTier} RISK
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-xs font-bold text-secondary mb-1">
                          <span>Failure Probability</span>
                          <span>{failureRisk.failureProbability}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className={`${getRiskBarColor(failureRisk.riskTier)} h-2 rounded-full`} style={{ width: `${failureRisk.failureProbability}%` }}></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="p-4 bg-surface border border-subtle rounded-xl">
                          <span className="text-[11px] text-secondary font-bold uppercase tracking-wider block mb-1">
                            Predicted Failure Date
                          </span>
                          <span className="text-[15px] font-black text-primary">
                            {formatTimelineDate(failureRisk.predictedFailureDate)}
                          </span>
                        </div>
                        <div className="p-4 bg-surface border border-subtle rounded-xl">
                          <span className="text-[11px] text-secondary font-bold uppercase tracking-wider block mb-1">
                            Recommendation
                          </span>
                          <span className="text-[13px] font-bold text-slate-700">
                            {failureRisk.recommendation}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Warranty & Contract Section (issue #703) */}
                <div className="mt-6 mb-6 p-5 bg-hover rounded-2xl border border-subtle">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-extrabold text-primary m-0">Warranty &amp; Service Contract</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase inline-block ${warrantyBadgeClass(equipmentDetails)}`}>
                      {warrantyBadgeLabel(equipmentDetails)}
                    </span>
                  </div>
                  {equipmentDetails.warrantyExpiry ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Provider
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {equipmentDetails.warrantyProvider || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Contract Number
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1 font-mono">
                          {equipmentDetails.warrantyContractNumber || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Coverage Type
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {(equipmentDetails.warrantyCoverageType || "").replaceAll("_", " ").toLowerCase() || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Coverage Start
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {equipmentDetails.warrantyStartDate || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Expires
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {equipmentDetails.warrantyExpiry}
                          {equipmentDetails.warrantyDaysRemaining !== null
                            && equipmentDetails.warrantyDaysRemaining !== undefined && (
                            <span className={`ml-2 text-xs font-bold ${
                              equipmentDetails.warrantyDaysRemaining < 0
                                ? "text-red-500"
                                : equipmentDetails.warrantyDaysRemaining <= 90
                                ? "text-amber-500"
                                : "text-emerald-600"
                            }`}>
                              ({equipmentDetails.warrantyDaysRemaining < 0
                                ? `${Math.abs(equipmentDetails.warrantyDaysRemaining)} days ago`
                                : equipmentDetails.warrantyDaysRemaining === 0
                                ? "expires today"
                                : `${equipmentDetails.warrantyDaysRemaining} days left`})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary font-bold uppercase tracking-wider">
                          Terms / Exclusions
                        </span>
                        <p className="text-[15px] text-primary font-bold m-1">
                          {equipmentDetails.warrantyTerms || "None recorded"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-secondary font-semibold m-0">
                      No warranty or service contract recorded for this asset. Add one to receive
                      expiry alerts and coverage details.
                    </p>
                  )}
                </div>

                {/* QR Code Section */}
                <div className="mt-6 mb-6 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-subtle flex flex-col items-center justify-center gap-3">
                  <span className="text-[11px] text-secondary font-bold uppercase tracking-wider text-center">
                    Physical Asset QR Tag
                  </span>
                  {qrLoading && (
                    <div className="w-32 h-32 flex items-center justify-center border border-dashed border-subtle rounded-xl bg-surface">
                      <div className="w-6 h-6 border-2 border-subtle border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                  )}
                  {qrError && (
                    <div className="w-32 h-32 flex flex-col items-center justify-center border border-dashed border-red-200 text-red-500 text-xs text-center p-2 rounded-xl bg-red-50/50">
                      <span>⚠️</span>
                      <span className="mt-1 font-semibold">{qrError}</span>
                    </div>
                  )}
                  {qrCode && (
                    <div className="flex flex-col items-center gap-3 w-full">
                      <img
                        src={`data:image/png;base64,${qrCode}`}
                        alt="Equipment QR Code"
                        className="w-40 h-40 object-contain border border-subtle p-2 rounded-xl bg-white shadow-sm"
                      />
                      <button
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = `data:image/png;base64,${qrCode}`;
                          link.download = `QR-${equipmentDetails.name.replace(/\s+/g, "-")}-${equipmentDetails.id}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white border-none rounded-lg cursor-pointer text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        📥 Download QR Tag
                      </button>
                    </div>
                  )}
                  {!qrCode && !qrLoading && !qrError && (
                    <span className="text-xs text-slate-400 font-medium">QR code not available for default public items</span>
                  )}
                </div>

                {!String(equipmentDetails.id).startsWith("EQ-00") && (
                  <div className="mt-6 mb-6 p-5 bg-hover rounded-2xl border border-subtle space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-primary m-0">Lifecycle Timeline</h3>
                        <p className="text-xs text-secondary mt-1 mb-0">
                          Full asset history — purchase, maintenance, lifecycle actions, and system events in chronological order.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            refreshLifecycle(equipmentDetails.id);
                            refreshTimeline(equipmentDetails.id);
                          }}
                          disabled={lifecycleLoading || timelineLoading}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-secondary text-xs font-bold hover:bg-subtle disabled:opacity-60"
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-secondary text-xs font-bold hover:bg-subtle"
                        >
                          Print
                        </button>
                      </div>
                    </div>

                    {user?.role === "hospital" && (
                      <form onSubmit={handleLifecycleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          value={lifecycleForm.actionType}
                          onChange={(event) => handleLifecycleChange("actionType", event.target.value)}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                        >
                          <option value="TRANSFER">Transfer</option>
                          <option value="ASSIGNMENT">Assignment</option>
                          <option value="RETIREMENT">Retirement</option>
                          <option value="DISPOSAL">Disposal</option>
                          <option value="REPLACEMENT">Replacement</option>
                          <option value="DEPRECIATION_SNAPSHOT">Depreciation Snapshot</option>
                        </select>
                        <input
                          type="date"
                          value={lifecycleForm.effectiveDate}
                          onChange={(event) => handleLifecycleChange("effectiveDate", event.target.value)}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                        />
                        <input
                          type="text"
                          placeholder="New department"
                          value={lifecycleForm.newDepartment}
                          onChange={(event) => handleLifecycleChange("newDepartment", event.target.value)}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Room / location"
                          value={lifecycleForm.roomLocation}
                          onChange={(event) => handleLifecycleChange("roomLocation", event.target.value)}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Ward"
                          value={lifecycleForm.wardLocation}
                          onChange={(event) => handleLifecycleChange("wardLocation", event.target.value)}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Custodian"
                          value={lifecycleForm.custodian}
                          onChange={(event) => handleLifecycleChange("custodian", event.target.value)}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Replacement equipment ID"
                          value={lifecycleForm.replacementEquipmentId}
                          onChange={(event) => handleLifecycleChange("replacementEquipmentId", event.target.value)}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Depreciation amount"
                          value={lifecycleForm.depreciationAmount}
                          onChange={(event) => handleLifecycleChange("depreciationAmount", event.target.value)}
                          className="px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                        />
                        <textarea
                          placeholder="Notes"
                          value={lifecycleForm.notes}
                          onChange={(event) => handleLifecycleChange("notes", event.target.value)}
                          className="md:col-span-2 px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm min-h-20"
                        />
                        <button
                          type="submit"
                          disabled={lifecycleSaving}
                          className="md:col-span-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-60"
                        >
                          {lifecycleSaving ? "Saving..." : "Request Lifecycle Action"}
                        </button>
                      </form>
                    )}

                    {lifecycleError && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm font-semibold border border-red-200 dark:border-red-900">
                        {lifecycleError}
                      </div>
                    )}

                    {timelineLoading ? (
                      <p className="text-sm text-secondary font-semibold">Loading asset history...</p>
                    ) : timelineEntries.length === 0 ? (
                      <p className="text-sm text-secondary font-semibold">No lifecycle events recorded yet.</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto pr-2">
                        <ol className="relative pl-6 space-y-5 border-l-2 border-slate-300 dark:border-slate-700">
                          {timelineEntries.map((entry, index) => {
                            const meta = timelineMeta(entry.type);
                            return (
                              <li key={`${entry.source}-${entry.sourceId ?? index}-${index}`} className="relative">
                                <span className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full ${meta.dot} ring-4 ring-hover`} />
                                <div className="rounded-xl border border-subtle bg-surface p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2 min-w-0">
                                      <span className="text-base leading-5">{meta.icon}</span>
                                      <div className="min-w-0">
                                        <p className="m-0 text-sm font-extrabold text-primary">{entry.title}</p>
                                        <p className="m-0 mt-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary">
                                          {entry.source} · {entry.type?.replaceAll("_", " ")}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="shrink-0 text-[10px] text-secondary font-semibold whitespace-nowrap">
                                      {formatTimelineDate(entry.date)}
                                    </span>
                                  </div>
                                  {entry.description && (
                                    <p className="m-0 mt-2 text-xs text-secondary">{entry.description}</p>
                                  )}
                                  {(entry.actor || entry.statusChange) && (
                                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold">
                                      {entry.actor && (
                                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                          By {entry.actor}
                                        </span>
                                      )}
                                      {entry.statusChange && (
                                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                          {entry.statusChange}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}

                    {user?.role === "hospital" &&
                      (() => {
                        const pending = lifecycleActions.filter(
                          (a) => a.status === "PENDING_APPROVAL" || a.status === "APPROVED"
                        );
                        if (pending.length === 0) return null;
                        return (
                          <div className="pt-2 border-t border-subtle space-y-2">
                            <p className="m-0 text-xs font-extrabold text-primary">Pending Approvals</p>
                            {pending.map((action) => (
                              <div key={action.id} className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-surface p-3">
                                <div className="min-w-0">
                                  <p className="m-0 text-xs font-extrabold text-primary">
                                    {action.actionType?.replaceAll("_", " ")}
                                  </p>
                                  <p className="m-0 text-[10px] text-secondary">
                                    {action.notes || `${action.newDepartment || action.custodian || "No details"} · ${action.status}`}
                                  </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  {action.status === "PENDING_APPROVAL" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleLifecycleWorkflow(action.id, "approve")}
                                        disabled={lifecycleSaving}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleLifecycleWorkflow(action.id, "reject")}
                                        disabled={lifecycleSaving}
                                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                  {action.status === "APPROVED" && (
                                    <button
                                      type="button"
                                      onClick={() => handleLifecycleWorkflow(action.id, "complete")}
                                      disabled={lifecycleSaving}
                                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-60"
                                    >
                                      Complete
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                    {/* Disposal records (issue #744) */}
                    <div className="pt-2 border-t border-subtle space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="m-0 text-xs font-extrabold text-primary">Disposal / Decommission Records</p>
                        <button
                          type="button"
                          onClick={() => refreshDisposalRecords(equipmentDetails.id)}
                          disabled={disposalRecordsLoading}
                          className="px-3 py-1.5 rounded-lg border border-subtle bg-surface text-secondary text-[10px] font-bold hover:bg-subtle disabled:opacity-60"
                        >
                          Refresh
                        </button>
                      </div>
                      {disposalRecordsLoading ? (
                        <p className="m-0 text-[10px] text-secondary">Loading disposal records...</p>
                      ) : disposalRecords.length === 0 ? (
                        <p className="m-0 text-[10px] text-secondary">
                          No decommission requests recorded for this asset.
                        </p>
                      ) : (
                        disposalRecords.map((disposal) => (
                          <div key={disposal.id} className="rounded-xl border border-subtle bg-surface p-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <p className="m-0 text-xs font-extrabold text-primary">
                                  {disposal.disposalMethod?.replaceAll("_", " ")}
                                  <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {disposal.status?.replaceAll("_", " ")}
                                  </span>
                                  {disposal.certificateNumber && (
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      {disposal.certificateNumber}
                                    </span>
                                  )}
                                </p>
                                <p className="m-0 mt-1 text-[10px] text-secondary">
                                  {disposal.disposalReason || "No reason recorded"}
                                  {disposal.storesPatientData
                                    ? ` · ${disposal.dataSanitizationConfirmed ? "Data sanitised" : "Sanitisation pending"}`
                                    : " · No stored patient data"}
                                </p>
                              </div>
                              <div className="flex gap-2 shrink-0 flex-wrap">
                                {disposal.status === "PENDING_APPROVAL" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleDisposalWorkflow(disposal.id, "approve")}
                                      disabled={disposalSaving}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDisposalWorkflow(disposal.id, "reject")}
                                      disabled={disposalSaving}
                                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {disposal.status === "APPROVED" && (
                                  <>
                                    {disposal.storesPatientData && !disposal.dataSanitizationConfirmed && (
                                      <button
                                        type="button"
                                        onClick={() => handleDisposalWorkflow(disposal.id, "sanitize")}
                                        disabled={disposalSaving}
                                        title="Confirm that patient / operational data was wiped from this device"
                                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-60"
                                      >
                                        Confirm Data Sanitisation
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDisposalWorkflow(disposal.id, "complete")}
                                      disabled={disposalSaving}
                                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-60"
                                    >
                                      Complete
                                    </button>
                                  </>
                                )}
                                {disposal.status === "COMPLETED" && (
                                  <button
                                    type="button"
                                    onClick={() => handleCertificateDownload(disposal)}
                                    disabled={certDownloading}
                                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-60"
                                  >
                                    ⬇ Certificate (PDF)
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedEquipmentId(null)}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-none py-3 px-7 rounded-xl cursor-pointer font-bold text-[15px] shadow-sm transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retirement / Disposal Workflow Modal (issue #744) */}
      {disposalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-card rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative border border-subtle">
            <button
              onClick={() => setDisposalOpen(false)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-hover text-secondary border-none flex items-center justify-center text-xl font-bold cursor-pointer transition-colors hover:bg-subtle"
            >
              &times;
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-700 text-white flex items-center justify-center text-2xl">
                🏁
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-primary m-0">
                  Retire / Dispose Equipment
                </h2>
                <p className="text-secondary text-sm mt-1">
                  Decommission{" "}
                  <strong className="text-primary">
                    {disposalTarget?.name} ({disposalTarget?.id})
                  </strong>{" "}
                  with a documented, approvable record and certificate of disposal.
                </p>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6 text-xs font-bold">
              {["Disposal Details", "Data Sanitisation", "Review & Submit"].map((label, index) => {
                const step = index + 1;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                        disposalStep >= step ? "bg-slate-700 text-white" : "bg-subtle text-secondary"
                      }`}
                    >
                      {step}
                    </span>
                    <span className={disposalStep >= step ? "text-primary" : "text-secondary"}>
                      {label}
                    </span>
                    {step < 3 && <span className="text-secondary">→</span>}
                  </div>
                );
              })}
            </div>

            {disposalSuccess ? (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                <p className="m-0 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  ✓ Disposal request submitted
                </p>
                <p className="m-0 mt-1 text-xs text-secondary">{disposalSuccess}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setDisposalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border-none cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDisposalSubmit}>
                {disposalStep === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">
                        Disposal Method *
                      </label>
                      <select
                        value={disposalForm.disposalMethod}
                        onChange={(event) => handleDisposalChange("disposalMethod", event.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                      >
                        <option value="SALE">Sale</option>
                        <option value="SCRAP">Scrap</option>
                        <option value="DONATION">Donation</option>
                        <option value="RETURN_TO_VENDOR">Return to Vendor</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">
                        Disposal Reason *
                      </label>
                      <textarea
                        required
                        value={disposalForm.disposalReason}
                        onChange={(event) => handleDisposalChange("disposalReason", event.target.value)}
                        placeholder="Why is this asset being decommissioned? (e.g. end of useful life, obsolete, beyond economical repair)"
                        className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm min-h-20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">
                        Effective Date
                      </label>
                      <input
                        type="date"
                        value={disposalForm.effectiveDate}
                        onChange={(event) => handleDisposalChange("effectiveDate", event.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">
                        Notes
                      </label>
                      <textarea
                        value={disposalForm.notes}
                        onChange={(event) => handleDisposalChange("notes", event.target.value)}
                        placeholder="Any additional context for the approver"
                        className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm min-h-16"
                      />
                    </div>
                  </div>
                )}

                {disposalStep === 2 && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-subtle bg-hover">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={disposalForm.storesPatientData}
                          onChange={(event) => handleDisposalChange("storesPatientData", event.target.checked)}
                          className="mt-1 w-4 h-4 accent-slate-700"
                        />
                        <span>
                          <span className="block text-sm font-bold text-primary">
                            This device stores patient or operational data
                          </span>
                          <span className="block text-xs text-secondary mt-0.5">
                            Imaging consoles, bedside monitors, lab analysers with internal storage,
                            and similar devices must have their data wiped or removed before
                            disposal can be completed.
                          </span>
                        </span>
                      </label>
                    </div>
                    {disposalForm.storesPatientData && (
                      <div>
                        <label className="block text-[11px] text-secondary font-bold uppercase tracking-wider mb-1">
                          Sanitisation Details
                        </label>
                        <textarea
                          value={disposalForm.dataSanitizationDetails}
                          onChange={(event) => handleDisposalChange("dataSanitizationDetails", event.target.value)}
                          placeholder="e.g. drives removed and destroyed, factory reset performed, cryptographic erase completed"
                          className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface text-primary text-sm min-h-20"
                        />
                        <p className="m-0 mt-2 text-[10px] text-amber-600 font-semibold">
                          ⚠ The sanitisation confirmation is recorded separately after manager
                          approval, with the acting user and timestamp.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {disposalStep === 3 && (
                  <div className="rounded-xl border border-subtle bg-hover p-5 space-y-2">
                    <p className="m-0 text-sm font-extrabold text-primary">
                      {disposalTarget?.name} ({disposalTarget?.id})
                    </p>
                    {[
                      ["Disposal Method", disposalForm.disposalMethod.replaceAll("_", " ")],
                      ["Reason", disposalForm.disposalReason],
                      ["Effective Date", disposalForm.effectiveDate || "Today"],
                      ["Stores Patient / Operational Data", disposalForm.storesPatientData ? "Yes" : "No"],
                      ["Sanitisation Details", disposalForm.dataSanitizationDetails || "N/A"],
                      ["Notes", disposalForm.notes || "N/A"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 text-xs">
                        <span className="text-secondary font-bold uppercase tracking-wide shrink-0">
                          {label}
                        </span>
                        <span className="text-primary font-semibold text-right">{value || "N/A"}</span>
                      </div>
                    ))}
                    <p className="m-0 pt-2 text-[10px] text-secondary">
                      Submitting creates a{" "}
                      <strong>PENDING_APPROVAL</strong> record. A manager must approve it; once the
                      asset is retired, the certificate of disposal is generated automatically.
                    </p>
                  </div>
                )}

                {disposalError && (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm font-semibold border border-red-200 dark:border-red-900">
                    {disposalError}
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setDisposalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-subtle bg-surface text-secondary text-xs font-bold hover:bg-subtle"
                  >
                    Cancel
                  </button>
                  <div className="flex gap-2">
                    {disposalStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setDisposalStep((step) => step - 1)}
                        className="px-4 py-2 rounded-lg border border-subtle bg-surface text-secondary text-xs font-bold hover:bg-subtle"
                      >
                        ← Back
                      </button>
                    )}
                    {disposalStep < 3 ? (
                      <button
                        type="button"
                        disabled={disposalStep === 1 && !disposalForm.disposalReason.trim()}
                        onClick={() => setDisposalStep((step) => step + 1)}
                        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold border-none disabled:opacity-50"
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={disposalSaving}
                        className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold border-none disabled:opacity-60"
                      >
                        {disposalSaving ? "Submitting..." : "Submit Disposal Request"}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-card rounded-3xl p-8 max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative border border-subtle">
            <button
              onClick={() => setShowImportModal(false)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-hover text-secondary border-none flex items-center justify-center text-xl font-bold cursor-pointer transition-colors hover:bg-subtle"
            >
              &times;
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
                📥
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-primary m-0">
                  Bulk Import
                </h2>
                <p className="text-secondary text-sm mt-1">
                  Onboard hundreds of medical assets from a CSV or Excel file in one batch.
                </p>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6 text-xs font-bold">
              {["Upload File", "Preview (Dry Run)", "Import Result"].map((label, index) => {
                const stepNames = ["select", "preview", "done"];
                const active = stepNames.indexOf(importStep) === index;
                const reached = stepNames.indexOf(importStep) >= index;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                        reached ? "bg-blue-600 text-white" : "bg-subtle text-secondary"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className={active ? "text-primary" : "text-secondary"}>{label}</span>
                    {index < 2 && <span className="text-secondary mx-1">→</span>}
                  </div>
                );
              })}
            </div>

            {importStep === "select" && (
              <form onSubmit={handlePreviewSubmit} className="space-y-6">
                <div
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${
                    dragActive ? "border-blue-600 bg-blue-50/20" : "border-subtle hover:bg-hover"
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("csv-file-input").click()}
                >
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <span className="text-4xl">📊</span>
                  {importFile ? (
                    <div className="text-center">
                      <p className="text-primary font-bold text-base">{importFile.name}</p>
                      <p className="text-secondary text-xs mt-1">
                        {(importFile.size / 1024).toFixed(2)} KB
                        {parsedRows.length > 0 && ` · ${parsedRows.length} data row(s) parsed`}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-primary font-bold text-sm">
                        Drag and drop your CSV or Excel file here, or click to browse
                      </p>
                      <p className="text-secondary text-xs mt-1">Supported: .csv, .xlsx, .xls</p>
                    </div>
                  )}
                </div>

                {/* Column guidance */}
                <div className="bg-hover p-4 rounded-xl">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-sm mb-3">
                    <span className="text-secondary font-medium">Need the correct column structure?</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => downloadTemplate("csv")}
                        className="text-blue-600 dark:text-blue-400 font-bold border-none bg-transparent hover:underline cursor-pointer"
                      >
                        📥 CSV Template
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTemplate("xlsx")}
                        className="text-blue-600 dark:text-blue-400 font-bold border-none bg-transparent hover:underline cursor-pointer"
                      >
                        📥 Excel Template
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                    {IMPORT_HEADERS.map((header) => (
                      <p key={header} className="text-xs text-secondary m-0">
                        <strong className="text-primary">{header}</strong> — {IMPORT_COLUMN_GUIDANCE[header]}
                      </p>
                    ))}
                  </div>
                </div>

                {importError && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-semibold">
                    ⚠️ {importError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-6 py-3 text-secondary font-bold hover:text-primary transition-colors bg-transparent border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importing || !importFile || parsedRows.length === 0}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl border-none cursor-pointer shadow-md transition-colors disabled:opacity-50"
                  >
                    {importing ? "Validating..." : "Preview Import"}
                  </button>
                </div>
              </form>
            )}

            {importStep === "preview" && importPreview && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 p-3 rounded-xl text-center">
                    <span className="text-blue-600 dark:text-blue-400 text-2xl font-extrabold">{importPreview.totalRows}</span>
                    <p className="text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold mt-1 mb-0">Total Rows</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 p-3 rounded-xl text-center">
                    <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-extrabold">{importPreview.validCount}</span>
                    <p className="text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold mt-1 mb-0">Will Import</p>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-3 rounded-xl text-center">
                    <span className="text-rose-600 dark:text-rose-400 text-2xl font-extrabold">{importPreview.failureCount}</span>
                    <p className="text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-bold mt-1 mb-0">Has Errors</p>
                  </div>
                </div>

                <div className="rounded-xl border border-subtle overflow-hidden">
                  <div className="px-4 py-3 bg-hover border-b border-subtle flex items-center justify-between">
                    <h4 className="text-sm font-bold text-primary m-0">
                      ✅ Rows that will be imported ({importPreview.validRows.length})
                    </h4>
                    <span className="text-[11px] text-secondary font-semibold">
                      Nothing is saved until you confirm
                    </span>
                  </div>
                  {importPreview.validRows.length === 0 ? (
                    <p className="text-sm text-secondary p-4 m-0">
                      No valid rows found. Fix the errors below or use a different file.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-surface text-secondary text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="text-left px-4 py-2">Row</th>
                            {["Equipment Code", "Name", "Model", "Department", "Category", "Status"].map((col) => (
                              <th key={col} className="text-left px-3 py-2">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.validRows.map((row) => (
                            <tr key={row.rowNumber} className="border-t border-subtle">
                              <td className="px-4 py-2 text-secondary">{row.rowNumber}</td>
                              <td className="px-3 py-2 font-mono text-xs">{row.data["Equipment Code"] || "auto"}</td>
                              <td className="px-3 py-2 font-semibold text-primary">{row.data.Name}</td>
                              <td className="px-3 py-2 text-secondary">{row.data.Model}</td>
                              <td className="px-3 py-2 text-secondary">{row.data.Department}</td>
                              <td className="px-3 py-2 text-secondary">{row.data.Category}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                                  {row.data.Status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {importPreview.failures.length > 0 && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900 overflow-hidden">
                    <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/20 border-b border-rose-200 dark:border-rose-900 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 m-0">
                        ⚠️ Rows with errors ({importPreview.failures.length})
                      </h4>
                      <span className="text-[11px] text-rose-500 font-semibold">
                        These rows will be skipped
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {importPreview.failures.map((f, i) => (
                        <div key={i} className="px-4 py-2.5 text-xs border-t border-rose-100 dark:border-rose-900/40 first:border-t-0">
                          <div className="flex justify-between gap-3 font-bold text-rose-600 dark:text-rose-400">
                            <span>Row {f.rowNumber}</span>
                            <span className="text-right">{f.reason}</span>
                          </div>
                          {f.rowData && (
                            <code className="block mt-1 text-slate-500 bg-surface p-1 rounded font-mono overflow-x-auto truncate">
                              {f.rowData}
                            </code>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setImportStep("select")}
                    className="px-6 py-3 text-secondary font-bold hover:text-primary transition-colors bg-transparent border-none cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    disabled={importing || importPreview.validCount === 0}
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-none cursor-pointer shadow-md transition-colors disabled:opacity-50"
                  >
                    {importing ? "Importing..." : `Confirm & Import ${importPreview.validCount} row(s)`}
                  </button>
                </div>
              </div>
            )}

            {importStep === "done" && importSummary && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 p-3 rounded-xl text-center">
                    <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-extrabold">{importSummary.successCount}</span>
                    <p className="text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold mt-1 mb-0">Imported</p>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-3 rounded-xl text-center">
                    <span className="text-rose-600 dark:text-rose-400 text-2xl font-extrabold">{importSummary.failureCount}</span>
                    <p className="text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-bold mt-1 mb-0">Skipped</p>
                  </div>
                </div>

                {importSummary.failures && importSummary.failures.length > 0 && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900 overflow-hidden">
                    <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/20 border-b border-rose-200 dark:border-rose-900">
                      <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 m-0">
                        ⚠️ Skipped rows ({importSummary.failures.length})
                      </h4>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {importSummary.failures.map((f, i) => (
                        <div key={i} className="px-4 py-2.5 text-xs border-t border-rose-100 dark:border-rose-900/40 first:border-t-0">
                          <div className="flex justify-between gap-3 font-bold text-rose-600 dark:text-rose-400">
                            <span>Row {f.rowNumber}</span>
                            <span className="text-right">{f.reason}</span>
                          </div>
                          {f.rowData && (
                            <code className="block mt-1 text-slate-500 bg-surface p-1 rounded font-mono overflow-x-auto truncate">
                              {f.rowData}
                            </code>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setParsedRows([]);
                      setImportPreview(null);
                      setImportSummary(null);
                      setImportError(null);
                      setImportStep("select");
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl border-none cursor-pointer shadow-md transition-colors"
                  >
                    📥 Import Another File
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-6 py-3 text-secondary font-bold hover:text-primary transition-colors bg-transparent border-none cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {importStep === "select" && importHistory.length > 0 && (
              <div className="mt-8 rounded-xl border border-subtle overflow-hidden">
                <div className="px-4 py-3 bg-hover border-b border-subtle">
                  <h4 className="text-sm font-bold text-primary m-0">
                    🕓 Recent Import Batches
                  </h4>
                  <p className="text-[11px] text-secondary mt-0.5 mb-0">
                    Every import is audit-logged (actor, file, row counts, failures).
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface text-secondary text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-4 py-2">Date</th>
                        <th className="text-left px-3 py-2">File</th>
                        <th className="text-left px-3 py-2">By</th>
                        <th className="text-left px-3 py-2">Imported</th>
                        <th className="text-left px-3 py-2">Skipped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importHistory.map((entry) => (
                        <tr key={entry.id} className="border-t border-subtle">
                          <td className="px-4 py-2 text-secondary text-xs">
                            {entry.importedAt?.replace("T", " ").slice(0, 16)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{entry.filename}</td>
                          <td className="px-3 py-2 text-secondary text-xs">{entry.actor}</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold text-xs">{entry.successCount}</td>
                          <td className="px-3 py-2 text-rose-600 font-bold text-xs">{entry.failureCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
        title="Scan Equipment Tag"
      />
    </div>
  );
}
