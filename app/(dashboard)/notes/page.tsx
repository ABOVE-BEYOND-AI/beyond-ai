"use client";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass,
  X,
  Plus,
  NotePencil,
  Trash,
  User,
  FileArrowUp,
  CaretDown,
  CaretUp,
  Check,
  Warning,
  Spinner,
  Note,
} from "@phosphor-icons/react";
import type { ABNoteExpanded } from "@/lib/salesforce-types";
import { formatRelativeTime } from "@/lib/constants";

// ── Types ──

interface ContactPickerItem {
  Id: string;
  Name: string;
  Email: string | null;
  Account: { Name: string } | null;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  unmatchedContacts: string[];
  errors: string[];
}

type TabKey = "all" | "mine" | "search";

// ── Tabs ──

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Notes" },
  { key: "mine", label: "My Notes" },
  { key: "search", label: "Search Results" },
];

// ── Note Card ──

function NoteCard({
  note,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  note: ABNoteExpanded;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (note: ABNoteExpanded) => void;
  onDelete: (note: ABNoteExpanded) => void;
}) {
  const bodyText = note.Body__c || "";
  const isLong = bodyText.length > 200;
  const previewText = isLong && !isExpanded ? bodyText.slice(0, 200) + "..." : bodyText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-all duration-200 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {note.Contact__r?.Name ? (
            <span className="text-sm font-semibold text-foreground truncate">
              {note.Contact__r.Name}
            </span>
          ) : (
            <span className="text-sm font-medium text-muted-foreground/60 italic">
              No linked contact
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground/50">
            {note.Owner?.Name || note.Owner?.Alias || "Unknown"}
          </span>
          <span className="text-muted-foreground/30">&middot;</span>
          <span className="text-[10px] font-medium text-muted-foreground/50">
            {formatRelativeTime(note.CreatedDate)}
          </span>
          {/* Action buttons - show on hover */}
          <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(note); }}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Edit note"
            >
              <NotePencil className="size-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(note); }}
              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
              title="Delete note"
            >
              <Trash className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div onClick={isLong ? onToggle : undefined} className={isLong ? "cursor-pointer" : ""}>
        <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
          {previewText}
        </p>
        {isLong && (
          <button className="text-xs text-primary/70 hover:text-primary mt-1.5 font-medium flex items-center gap-1 transition-colors">
            {isExpanded ? (
              <>Show less <CaretUp className="size-3" /></>
            ) : (
              <>Show more <CaretDown className="size-3" /></>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Create/Edit Note Modal ──

function NoteModal({
  isOpen,
  onClose,
  onSave,
  editingNote,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contactId: string | null, content: string) => Promise<void>;
  editingNote: ABNoteExpanded | null;
}) {
  const [content, setContent] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<ContactPickerItem[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactPickerItem | null>(null);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const contactDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editingNote) {
        setContent(editingNote.Body__c || "");
        if (editingNote.Contact__r) {
          setSelectedContact({
            Id: editingNote.Contact__c || "",
            Name: editingNote.Contact__r.Name,
            Email: null,
            Account: null,
          });
        }
      } else {
        setContent("");
        setSelectedContact(null);
      }
      setContactSearch("");
      setContactResults([]);
      setShowContactPicker(false);
    }
  }, [isOpen, editingNote]);

  // Search contacts
  useEffect(() => {
    if (contactDebounceRef.current) clearTimeout(contactDebounceRef.current);
    if (!contactSearch || contactSearch.length < 2) {
      setContactResults([]);
      return;
    }
    contactDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/notes?mode=contacts&search=${encodeURIComponent(contactSearch)}`);
        const json = await res.json();
        if (json.success) setContactResults(json.data);
      } catch {
        // Silently fail
      }
    }, 300);
    return () => {
      if (contactDebounceRef.current) clearTimeout(contactDebounceRef.current);
    };
  }, [contactSearch]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onSave(selectedContact?.Id || null, content.trim());
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold mb-4">
            {editingNote ? "Edit Note" : "Create Note"}
          </h3>

          {/* Contact Picker */}
          {!editingNote && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Link to Contact (optional)
              </label>
              {selectedContact ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <User className="size-4 text-primary" />
                  <span className="text-sm font-medium flex-1">{selectedContact.Name}</span>
                  <button
                    onClick={() => { setSelectedContact(null); setShowContactPicker(true); }}
                    className="p-1 hover:bg-muted/50 rounded transition-colors"
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => { setContactSearch(e.target.value); setShowContactPicker(true); }}
                    onFocus={() => setShowContactPicker(true)}
                    placeholder="Search contacts..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {showContactPicker && contactResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                      {contactResults.map((contact) => (
                        <button
                          key={contact.Id}
                          onClick={() => {
                            setSelectedContact(contact);
                            setContactSearch("");
                            setShowContactPicker(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm flex items-center gap-2"
                        >
                          <User className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{contact.Name}</span>
                          {contact.Account?.Name && (
                            <span className="text-xs text-muted-foreground/60 truncate">
                              {contact.Account.Name}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Note Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter note content..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Saving...
                </>
              ) : editingNote ? (
                "Update Note"
              ) : (
                "Create Note"
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Import Modal ──

function ImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/notes/import", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        if (json.data.successCount > 0) {
          onImportComplete();
        }
      } else {
        setError(json.error || "Import failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold mb-2">Import Notes from FreshSales</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a CSV export from FreshSales. The importer will auto-detect columns for contact name, email, and note body.
          </p>

          {/* File Upload */}
          {!result && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <FileArrowUp className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click to select a CSV file
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </>
          )}

          {/* Import Result */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-500">{result.successCount}</p>
                  <p className="text-[10px] font-semibold text-emerald-500/70 uppercase tracking-wider">Imported</p>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <p className="text-lg font-bold text-red-400">{result.failedCount}</p>
                  <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wider">Failed</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                  <p className="text-lg font-bold text-amber-400">{result.skippedCount}</p>
                  <p className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-wider">Skipped</p>
                </div>
              </div>
              {result.unmatchedContacts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm">
                  <p className="font-medium text-amber-400 mb-1 flex items-center gap-1.5">
                    <Warning className="size-4" />
                    {result.unmatchedContacts.length} contacts not matched in Salesforce
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.unmatchedContacts.slice(0, 5).join(", ")}
                    {result.unmatchedContacts.length > 5 && ` +${result.unmatchedContacts.length - 5} more`}
                  </p>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400 max-h-24 overflow-y-auto">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <Spinner className="size-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FileArrowUp className="size-4" />
                    Import Notes
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Component ──

export default function NotesPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  // Data state
  const [notes, setNotes] = useState<ABNoteExpanded[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedOnce = useRef(false);

  // UI state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingNote, setEditingNote] = useState<ABNoteExpanded | null>(null);
  const [loadedCount, setLoadedCount] = useState(50);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/signin");
  }, [user, loading, router]);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      if (search.trim()) {
        setActiveTab("search");
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Fetch notes
  const fetchNotes = useCallback(
    async (silent = false) => {
      if (!silent && !hasFetchedOnce.current) setInitialLoading(true);
      if (silent) setIsRefreshing(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (activeTab === "mine" && user?.email) params.set("ownerId", user.email);
        params.set("limit", "200");

        const res = await fetch(`/api/notes?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch notes");
        const json = await res.json();
        if (json.success) {
          setNotes(json.data as ABNoteExpanded[]);
          hasFetchedOnce.current = true;
        } else {
          throw new Error(json.error || "Unknown error");
        }
      } catch (err) {
        console.error("Error fetching notes:", err);
        setError("Failed to load notes. Please try again.");
      } finally {
        setInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, activeTab, user?.email]
  );

  useEffect(() => {
    if (user) fetchNotes(hasFetchedOnce.current);
  }, [user, fetchNotes]);

  // Create or update note
  const handleSaveNote = async (contactId: string | null, content: string) => {
    if (editingNote) {
      // Update
      const res = await fetch(`/api/notes/${editingNote.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to update note");
    } else {
      // Create
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, content }),
      });
      if (!res.ok) throw new Error("Failed to create note");
    }
    setEditingNote(null);
    fetchNotes(true);
  };

  // Delete note
  const handleDeleteNote = async (note: ABNoteExpanded) => {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/notes/${note.Id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
      fetchNotes(true);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Toggle note expansion
  const toggleExpanded = (noteId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  // Displayed notes (with load more)
  const displayedNotes = notes.slice(0, loadedCount);
  const hasMore = notes.length > loadedCount;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background p-6 pl-24 lg:p-8 lg:pl-32">
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {notes.length > 0
                ? `${notes.length} note${notes.length !== 1 ? "s" : ""}${debouncedSearch ? ` matching "${debouncedSearch}"` : ""}`
                : "Search and manage notes across all contacts"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/50 transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <FileArrowUp className="size-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => { setEditingNote(null); setShowCreateModal(true); }}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-2"
            >
              <Plus className="size-4" weight="bold" />
              <span className="hidden sm:inline">New Note</span>
            </button>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-4"
        >
          <div className="relative max-w-md">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes by keyword... (e.g. Formula One, hotel, upgrade)"
              className="w-full pl-10 pr-9 py-2.5 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setActiveTab("all"); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex items-center gap-1 mb-6 border-b border-border"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            if (tab.key === "search" && !debouncedSearch) return null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="notes-active-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
          {/* Refresh indicator */}
          {isRefreshing && (
            <div className="ml-auto">
              <Spinner className="size-4 animate-spin text-muted-foreground/50" />
            </div>
          )}
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              onClick={() => fetchNotes()}
              className="text-xs font-medium hover:text-red-300 underline underline-offset-2"
            >
              Try again
            </button>
          </motion.div>
        )}

        {/* Notes List */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {initialLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-card border border-border/50 animate-pulse"
                >
                  <div className="flex justify-between mb-3">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-4/5 bg-muted rounded" />
                    <div className="h-3 w-3/5 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedNotes.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground/40">
              <Note className="size-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">
                {debouncedSearch
                  ? `No notes found for "${debouncedSearch}"`
                  : "No notes yet"}
              </p>
              <p className="text-sm mt-1">
                {debouncedSearch
                  ? "Try a different keyword"
                  : "Create your first note or import from FreshSales"}
              </p>
              {!debouncedSearch && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    onClick={() => { setEditingNote(null); setShowCreateModal(true); }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-2"
                  >
                    <Plus className="size-4" weight="bold" />
                    Create Note
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/50 transition-colors flex items-center gap-2"
                  >
                    <FileArrowUp className="size-4" />
                    Import CSV
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                <div className="space-y-2">
                  {displayedNotes.map((note) => (
                    <NoteCard
                      key={note.Id}
                      note={note}
                      isExpanded={expandedNotes.has(note.Id)}
                      onToggle={() => toggleExpanded(note.Id)}
                      onEdit={(n) => { setEditingNote(n); setShowCreateModal(true); }}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </div>
              </AnimatePresence>

              {/* Load More */}
              {hasMore && (
                <div className="text-center mt-6">
                  <button
                    onClick={() => setLoadedCount((prev) => prev + 50)}
                    className="px-6 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    Load more ({notes.length - loadedCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <NoteModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setEditingNote(null); }}
        onSave={handleSaveNote}
        editingNote={editingNote}
      />
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => fetchNotes(true)}
      />
    </div>
  );
}
