"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getSettings, saveSetting, deleteSetting } from "./actions";
import { Plus, Trash2, Edit3, Settings as SettingsIcon, X, Key, FileText } from "lucide-react";

type Setting = {
  Id: string;
  Key: string;
  Value: string | null;
  UpdatedAt: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Setting>>({});
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.Key) {
      toast.error("Key is required");
      return;
    }

    try {
      await saveSetting(form.Key, form.Value || null);
      toast.success(editing ? "Setting updated" : "Setting added");
      setShowForm(false);
      setForm({});
      setEditing(false);
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this setting?")) return;
    try {
      await deleteSetting(id);
      toast.success("Setting deleted");
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
        <button
          onClick={() => {
            setEditing(false);
            setForm({});
            setShowForm(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Setting
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : settings.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <SettingsIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No settings found. Add your first setting above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Key</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Value</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Last Updated</th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.Id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-900/50 rounded text-sm font-mono">
                        {s.Key}
                      </code>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400 max-w-md truncate">
                      {s.Value || <span className="text-gray-400 italic">empty</span>}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">
                      {new Date(s.UpdatedAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => {
                            setEditing(true);
                            setForm(s);
                            setShowForm(true);
                          }}
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.Id)}
                          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {editing ? (
                  <>
                    <Edit3 className="w-5 h-5 text-primary" />
                    Edit Setting
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-primary" />
                    Add Setting
                  </>
                )}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setForm({});
                  setEditing(false);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Key *
                </label>
                <input
                  value={form.Key || ""}
                  onChange={(e) => setForm({ ...form, Key: e.target.value })}
                  placeholder="e.g. app_name, api_key"
                  required
                  disabled={editing}
                  className={`w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono ${
                    editing ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
                {editing && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Key cannot be changed when editing
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Value
                </label>
                <textarea
                  value={form.Value || ""}
                  onChange={(e) => setForm({ ...form, Value: e.target.value })}
                  placeholder="Enter setting value"
                  rows={4}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setForm({});
                    setEditing(false);
                  }}
                  className="px-6 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 transition-colors px-6 py-2.5 rounded-lg font-semibold text-white"
                >
                  {editing ? "Update" : "Save"} Setting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}