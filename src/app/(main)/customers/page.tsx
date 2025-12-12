"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getCustomers, getCustomerById, getCustomerOrders, deleteCustomer, updateCustomer } from "./actions";
import { Users, Phone, MapPin, Trash2, Edit, ShoppingBag, X, Search } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (e: any) {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.Name.toLowerCase().includes(search.toLowerCase()) ||
      (c.Phone && c.Phone.includes(search))
  );

  async function openDrawer(id: string) {
    try {
      const data = await getCustomerById(id);
      const orderList = await getCustomerOrders(id);
      setSelected(data);
      setOrders(orderList);
      setDrawerOpen(true);
    } catch (e: any) {
      toast.error("Failed to load customer details");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await deleteCustomer(id);
      toast.success("Customer deleted");
      load();
    } catch (e: any) {
      toast.error("Failed to delete customer");
    }
  }

  async function handleSave() {
    if (!selected) return;
    setUpdating(true);
    try {
      await updateCustomer(selected.Id, selected.Phone, selected.Address);
      toast.success("Customer updated");
      load();
    } catch (e: any) {
      toast.error("Failed to update customer");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="text-gray-900 dark:text-white relative">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Customers</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                  <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">Address</th>
                  <th className="text-center p-4 font-semibold text-gray-700 dark:text-gray-300">Orders</th>
                  <th className="text-center p-4 font-semibold text-gray-700 dark:text-gray-300">Total Spent</th>
                  <th className="text-center p-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>{search ? "No customers found matching your search" : "No customers yet"}</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.Id}
                      className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                      onClick={() => openDrawer(c.Id)}
                    >
                      <td className="p-4 font-medium">{c.Name}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">{c.Phone || "-"}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">{c.Address || "-"}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                          {c.OrderCount}
                        </span>
                      </td>
                      <td className="p-4 text-center font-semibold text-green-600 dark:text-green-400">
                        Rs {c.TotalSpent?.toFixed(2) || "0.00"}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(c.Id);
                          }}
                          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl overflow-y-auto animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                {selected.Name}
              </h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-6">
              {/* Editable Fields */}
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-primary" />
                  Contact Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone
                    </label>
                    <input
                      value={selected.Phone || ""}
                      onChange={(e) => setSelected({ ...selected, Phone: e.target.value })}
                      placeholder="Enter phone number"
                      className="w-full bg-white dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Address
                    </label>
                    <textarea
                      value={selected.Address || ""}
                      onChange={(e) => setSelected({ ...selected, Address: e.target.value })}
                      placeholder="Enter address"
                      rows={3}
                      className="w-full bg-white dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    />
                  </div>
                  <button
                    disabled={updating}
                    onClick={handleSave}
                    className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold disabled:opacity-60"
                  >
                    <Edit className="w-4 h-4" />
                    {updating ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Joined</span>
                    <span className="font-medium">{new Date(selected.CreatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total Orders</span>
                    <span className="font-medium">{selected.OrderCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total Spent</span>
                    <span className="font-bold text-green-600 dark:text-green-400">Rs {selected.TotalSpent?.toFixed(2) || "0.00"}</span>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  Recent Orders
                </h3>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No orders found</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                          <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                          <th className="p-3 text-center font-medium text-gray-700 dark:text-gray-300">Status</th>
                          <th className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => (
                          <tr key={o.Id} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="p-3 text-gray-600 dark:text-gray-400">
                              {new Date(o.OrderDate).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                o.PaymentStatus === 'Paid' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : o.PaymentStatus === 'Pending'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                              }`}>
                                {o.PaymentStatus}
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold text-green-600 dark:text-green-400">
                              Rs {o.Total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}