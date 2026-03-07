"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { LogIn, Lock, User, Package, TrendingUp, ShoppingCart, BarChart3 } from "lucide-react";
import { loginUser } from "./actions";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const user = await loginUser(username, password);
      toast.success(`Welcome back, ${user.Username}!`);
      localStorage.setItem("authUser", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
  }

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-22px) scale(1.05); }
        }
        @keyframes floatReverse {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(22px) scale(0.95); }
        }
        @keyframes spinSlow {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes spinSlowReverse {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(-360deg); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .orb-1 { animation: float 7s ease-in-out infinite; }
        .orb-2 { animation: floatReverse 9s ease-in-out infinite; }
        .orb-3 { animation: float 11s ease-in-out infinite; animation-delay: 2s; }
        .orb-4 { animation: floatReverse 6s ease-in-out infinite; animation-delay: 1s; }
        .ring-1 { animation: spinSlow 14s linear infinite; }
        .ring-2 { animation: spinSlowReverse 20s linear infinite; }
        .panel-left { animation: slideInLeft 0.7s ease-out forwards; }
        .panel-right { animation: slideInRight 0.7s ease-out forwards; }
        .feat-1 { animation: fadeInUp 0.6s ease-out 0.4s both; }
        .feat-2 { animation: fadeInUp 0.6s ease-out 0.6s both; }
        .feat-3 { animation: fadeInUp 0.6s ease-out 0.8s both; }
        .feat-4 { animation: fadeInUp 0.6s ease-out 1.0s both; }
        .brand-anim { animation: fadeInUp 0.6s ease-out 0.1s both; }
        .tagline-anim { animation: fadeInUp 0.6s ease-out 0.2s both; }
        .input-focus:focus { box-shadow: 0 0 0 2px #F54927; outline: none; }
        .btn-primary { background: #F54927; }
        .btn-primary:hover { background: #d63d1f; }
      `}</style>

      <Toaster position="top-right" />

      <div className="min-h-screen w-full flex">

        {/* ── LEFT PANEL ── */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center panel-left" style={{ background: "#0a0a0f" }}>

          {/* Radial glow bg */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse at 25% 50%, rgba(245,73,39,0.22) 0%, transparent 55%), radial-gradient(ellipse at 80% 15%, rgba(245,73,39,0.12) 0%, transparent 50%)"
          }} />

          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(rgba(245,73,39,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,73,39,1) 1px, transparent 1px)",
            backgroundSize: "56px 56px"
          }} />

          {/* Floating orbs */}
          <div className="orb-1 absolute top-[12%] left-[8%] w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,73,39,0.35), transparent 70%)", filter: "blur(50px)" }} />
          <div className="orb-2 absolute bottom-[15%] right-[6%] w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,73,39,0.2), transparent 70%)", filter: "blur(70px)" }} />
          <div className="orb-3 absolute top-[55%] left-[25%] w-56 h-56 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,73,39,0.15), transparent 70%)", filter: "blur(40px)" }} />
          <div className="orb-4 absolute top-[5%] right-[18%] w-40 h-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(245,73,39,0.25), transparent 70%)", filter: "blur(30px)" }} />

          {/* Spinning rings */}
          <div className="ring-1 absolute" style={{ top: "50%", left: "50%", width: 520, height: 520, borderRadius: "50%", border: "1px solid rgba(245,73,39,0.12)" }} />
          <div className="ring-2 absolute" style={{ top: "50%", left: "50%", width: 380, height: 380, borderRadius: "50%", border: "1px solid rgba(245,73,39,0.1)" }} />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center px-14">

            {/* Brand */}
            <div className="brand-anim flex items-center gap-3 mb-3">
              <div className="w-13 h-13 rounded-2xl flex items-center justify-center shadow-xl" style={{ background: "#F54927", padding: "10px" }}>
                <LogIn className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-5xl font-bold text-white tracking-tight">EssenceFit</h1>
            </div>

            <p className="tagline-anim text-gray-400 text-base mb-12">All-in-one Inventory & Finance System</p>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              <div className="feat-1 flex flex-col items-center gap-2 rounded-2xl p-4 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Package className="w-6 h-6" style={{ color: "#F54927" }} />
                <span className="text-white text-sm font-semibold">Inventory</span>
                <span className="text-gray-500 text-xs">Track stock levels</span>
              </div>
              <div className="feat-2 flex flex-col items-center gap-2 rounded-2xl p-4 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <ShoppingCart className="w-6 h-6" style={{ color: "#F54927" }} />
                <span className="text-white text-sm font-semibold">Orders</span>
                <span className="text-gray-500 text-xs">Manage orders</span>
              </div>
              <div className="feat-3 flex flex-col items-center gap-2 rounded-2xl p-4 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <TrendingUp className="w-6 h-6" style={{ color: "#F54927" }} />
                <span className="text-white text-sm font-semibold">Finance</span>
                <span className="text-gray-500 text-xs">Track expenses</span>
              </div>
              <div className="feat-4 flex flex-col items-center gap-2 rounded-2xl p-4 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <BarChart3 className="w-6 h-6" style={{ color: "#F54927" }} />
                <span className="text-white text-sm font-semibold">Reports</span>
                <span className="text-gray-500 text-xs">Deep insights</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-900 px-6 py-12 panel-right">
          <div className="w-full max-w-md">

            {/* Mobile brand */}
            <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F54927" }}>
                <LogIn className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">EssenceFit</span>
            </div>

            <h2 className="text-3xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-gray-400 mb-8 text-sm">Sign in to your account to continue</p>

            <form onSubmit={handleLogin} className="space-y-5">

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <input
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-focus w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-gray-500" />
                  </div>
                  <input
                    placeholder="Enter your password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-focus w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3 rounded-xl font-semibold text-white shadow-lg transition-all mt-2"
              >
                Sign In
              </button>
            </form>

            <p className="mt-6 text-sm text-center text-gray-500">
              Don't have an account?{" "}
              <a href="/register" className="font-medium" style={{ color: "#F54927" }}>
                Register
              </a>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
