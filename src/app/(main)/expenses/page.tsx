"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
} from "./actions";
import { Receipt, Edit, Trash2, Save, X } from "lucide-react";

type Expense = {
  Id: string;
  Category: string;
  Description: string;
  Amount: number;
  ExpenseDate: string;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({
    id: "",
    category: "",
    description: "",
    amount: "",
    date: "",
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (e: any) {
      toast.error("Failed to load expenses");
    }
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!form.category || !form.amount) {
      toast.error("Category and amount are required");
      return;
    }
    try {
      if (editing) {
        await updateExpense(form.id, form);
        toast.success("Expense updated");
      } else {
        await addExpense(form);
        toast.success("Expense added");
      }
      setForm({ id: "", category: "", description: "", amount: "", date: "" });
      setEditing(false);
      loadExpenses();
    } catch (e: any) {
      toast.error("Failed to save expense");
    }
  }

  function handleCancel() {
    setForm({ id: "", category: "", description: "", amount: "", date: "" });
    setEditing(false);
  }

  async function handleEdit(exp: Expense) {
    setForm({
      id: exp.Id,
      category: exp.Category,
      description: exp.Description || "",
      amount: exp.Amount.toString(),
      date: exp.ExpenseDate.substring(0, 10),
    });
    setEditing(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await deleteExpense(id);
      toast.success("Expense deleted");
      loadExpenses();
    } catch {
      toast.error("Failed to delete expense");
    }
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.Amount, 0);

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg">
            <Receipt className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Expenses</h1>
        </div>
        {expenses.length > 0 && (
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">Rs {totalExpenses.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          {editing ? (
            <>
              <Edit className="w-5 h-5 text-primary" />
              Edit Expense
            </>
          ) : (
            <>
              <Receipt className="w-5 h-5 text-primary" />
              Add New Expense
            </>
          )}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Rent, Utilities"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <input
                type="text"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount (Rs)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors"
            >
              <Save className="w-4 h-4" />
              {editing ? "Update" : "Add"} Expense
            </button>
            {editing && (
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {expenses.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No expenses found. Add your first expense above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Category</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Description</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.Id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 font-medium">{exp.Category}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{exp.Description || '-'}</td>
                    <td className="p-4 font-semibold text-red-600 dark:text-red-400">Rs {exp.Amount.toFixed(2)}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {new Date(exp.ExpenseDate).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(exp)}
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-1 text-sm font-medium transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(exp.Id)}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-1 text-sm font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
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
    </div>
  );
}